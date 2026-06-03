# Prod-Release Draft — Fix licensee RLS access (Track B)

> **Status:** DRAFT — not yet applied to any environment.
> **Type:** Schema migration + RLS policy rewrite (HIPAA-relevant).
> **Surfaced by:** Phase 3 integration tests ([../TEST_PHASE_3.md](../TEST_PHASE_3.md), PR #20).
> **Owner / sign-off required before prod:** _TBD_

---

## 1. Problem

Phase 3 integration tests proved that **regular licensees can read and write *no* companies**,
even ones correctly assigned to them. Only super-admins can access company data today.

This is a **functional blocker** for the product: a licensee who signs in sees nothing
(`loadConfig()` returns `null`), and cannot save edits (`saveConfig()` returns `false`).

It is **not a data-leak** — isolation still holds; no user can see another licensee's data.
The bug is the inverse (assigned data is invisible too).

## 2. Root cause

The `companies` SELECT/UPDATE policies in
[`supabase/migrations/20260508174403_initial_schema.sql`](../../supabase/migrations/20260508174403_initial_schema.sql)
authorize access with an inline `EXISTS` subquery over `licensee_companies` and `licensees`:

```sql
create policy "companies: licensee read access"
  on public.companies for select
  using (
    exists (
      select 1
      from public.licensee_companies lc
      join public.licensees l on l.id = lc.licensee_id
      join public.profiles p on p.email = l.name   -- temp join
      where lc.company_id = companies.id
        and p.id = auth.uid()
    )
  );
```

**PostgreSQL applies RLS *inside* policy subqueries.** Both `licensee_companies` and
`licensees` have RLS enabled with **super-admin-only** SELECT policies. So when a *regular*
user's `companies` policy is evaluated, the subquery sees **zero** rows in those tables →
the `EXISTS` is always false → the user is denied every company.

Secondary issue: `saveConfig()` uses `upsert` (`INSERT ... ON CONFLICT DO UPDATE`). There is
**no INSERT policy** for non-super-admins, so even when the row already exists the INSERT
`WITH CHECK` is evaluated first and denies the statement.

## 3. Fix — `SECURITY DEFINER` access helpers + rewritten policies

The standard remedy is to move the membership lookup into `SECURITY DEFINER` functions. They
run as the function owner, so the lookups over `licensees` / `licensee_companies` **bypass RLS**
on those tables — without exposing their rows to the user directly. The policies then call the
helpers instead of embedding the subquery.

This keeps the temporary `licensees.name = profiles.email` join intact (its replacement by a
real `licensee_id` FK on `profiles` is a separate, larger change — see §7).

### Proposed migration (draft)

`supabase/migrations/<timestamp>_fix_licensee_company_rls.sql`:

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER access helpers
-- Run as owner so they can read licensees / licensee_companies regardless of the
-- caller's RLS. `set search_path` is REQUIRED on security-definer functions to
-- prevent search-path hijacking.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_super_admin = true
  );
$$;

-- Returns the current user's role on a company ('editor' | 'read_only'), or NULL.
create or replace function public.user_company_role(p_company_id text)
returns text
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select lc.role
  from public.licensee_companies lc
  join public.licensees l on l.id = lc.licensee_id
  join public.profiles  p on p.email = l.name   -- temp join; replace with licensee_id FK
  where lc.company_id = p_company_id
    and p.id = auth.uid()
  limit 1;
$$;

revoke all on function public.is_super_admin()        from public, anon;
revoke all on function public.user_company_role(text) from public, anon;
grant execute on function public.is_super_admin()        to authenticated;
grant execute on function public.user_company_role(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Rewrite companies policies to use the helpers
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "companies: super admin full access"        on public.companies;
drop policy if exists "companies: licensee read access"           on public.companies;
drop policy if exists "companies: licensee editor write access"   on public.companies;

-- SELECT: super admins see all; licensees see assigned companies (any role).
create policy "companies: select"
  on public.companies for select
  using (public.is_super_admin() or public.user_company_role(id) is not null);

-- UPDATE: super admins, or editors on the assigned company.
create policy "companies: update"
  on public.companies for update
  using (public.is_super_admin() or public.user_company_role(id) = 'editor')
  with check (public.is_super_admin() or public.user_company_role(id) = 'editor');

-- INSERT: super admins (provisioning) OR an editor upserting an ALREADY-assigned
-- company. For a brand-new id no assignment exists yet, so user_company_role()
-- is NULL and the insert is denied — only super admins can create companies
-- (Model 1). This is what makes saveConfig()'s upsert work for editors without
-- letting them create arbitrary companies.
create policy "companies: insert"
  on public.companies for insert
  with check (public.is_super_admin() or public.user_company_role(id) = 'editor');
```

> Note: `licensees` and `licensee_companies` policies are unchanged — they stay
> super-admin-only for direct access. The helpers reach their rows via
> `SECURITY DEFINER`, which is exactly the intent.

## 4. Expected behavior after the fix

| Actor | Before | After |
|---|---|---|
| Regular licensee — `loadConfig()` on assigned company | `null` | v2 blob with the company |
| Editor — `UPDATE` / `saveConfig()` on assigned company | 0 rows / `false` | succeeds |
| read_only — `UPDATE` | 0 rows | 0 rows (correctly blocked) |
| Any licensee — another licensee's company | empty (isolation) | empty (isolation preserved) |
| Editor — create a brand-new company | denied | denied (only super-admin provisions) |
| Super admin | full access | full access |

## 5. Test impact (Phase 3 suite)

The Phase 3 tests pin current reality with `GAP:`-prefixed assertions. When this migration
lands, flip them to the intended behavior:

- `tests/integration/supabase.test.js`
  - `GAP 1: returns null even when a regular licensee IS assigned a company` → assert a v2 blob.
  - `GAP 1/2: returns false for a regular editor` → assert `true` + persisted row.
- `tests/integration/rls.test.js`
  - `GAP: an assigned editor cannot SELECT their own company` → assert the row is returned.
  - `GAP: an editor UPDATE affects 0 rows` → assert 1 row updated + value persisted.
- Unchanged (still must hold): cross-licensee isolation, read_only cannot write, profiles
  own/other-row rules, licensees super-admin-only.

## 6. Rollout plan (prod-release)

1. **Local first.** Add the migration file, `supabase db reset`, flip the Phase 3 assertions,
   run `npm run test:integration` — all green.
2. **Review.** RLS changes are HIPAA-relevant — require a second reviewer sign-off and confirm
   the isolation tests still pass (no widening of cross-licensee visibility).
3. **Staging.** Apply via `supabase db push` to a staging project; smoke-test a real licensee
   login end-to-end (sees only assigned companies, can save).
4. **Prod.** Apply during a low-traffic window. The change is **forward-only and additive**
   (creates functions, swaps policies) — no data migration, no downtime. Functions and policies
   are replaced transactionally within the migration.
5. **Rollback.** Keep a companion down-migration that restores the original three policies and
   drops the helper functions, in case post-deploy verification fails.

### Pre-deploy checklist

- [ ] Migration applies cleanly on a fresh `supabase db reset`.
- [ ] Phase 3 assertions flipped; `npm run test:integration` green.
- [ ] Cross-licensee isolation tests still pass (no regression).
- [ ] `is_super_admin()` / `user_company_role()` have `set search_path` and are not granted to `anon`.
- [ ] Manual staging smoke test: licensee sees only assigned companies and can save.
- [ ] Down-migration written and tested.

## 7. Follow-up (separate, larger change)

Replace the temporary `licensees.name = profiles.email` join with a real `licensee_id` FK on
`profiles` (called out in the schema and [../TEST_PHASE_3.md](../TEST_PHASE_3.md)). When that
lands, update `user_company_role()` to join on `p.licensee_id = lc.licensee_id` and backfill
existing profiles. This is **not** required for the access fix above and should ship on its own.
