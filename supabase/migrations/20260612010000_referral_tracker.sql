-- ═════════════════════════════════════════════════════════════════════════════
-- Referral & Intake Tracker — Phase 1 (data model + RLS + audit + SSN encryption)
--
-- A lightweight CRM/pipeline for POTENTIAL clients (referrals). One tracker per
-- company, tenant-isolated via the same licensee_companies model as `companies`.
--
-- Design notes:
--   * Hybrid shape — columns that drive RLS, the auto-label, future kanban/filters,
--     and SSN handling are first-class; long-tail clinical/placement/guardianship
--     fields live in `details jsonb` to keep the row manageable.
--   * SSN never lands in a directly-selectable column. The encrypted blob lives in
--     `referral_ssn`, which has NO grants to `authenticated`; only the SECURITY
--     DEFINER RPCs at the bottom of this file can write/read it. The masked last-4
--     lives on `referrals.ssn_last4`.
--   * Tenant + role checks are encapsulated in SECURITY DEFINER helper functions so
--     RLS predicates can read licensee_companies without tripping over that table's
--     own (super-admin-only) RLS. This also avoids the over-restriction the inline
--     `companies` policies hit for normal users.
--   * Server-side role tiers mirror deriveRole() in src/App.jsx exactly
--     (super admin → OWNER/tier 1, null role → CEO/tier 2) so the UI and DB agree.
-- ═════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;
create extension if not exists supabase_vault;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles.role — added here (forward-compatible with Track B). getProfile()
-- already selects this column; until now it didn't exist. Nullable: a null role
-- resolves to CEO, matching deriveRole()'s fallback.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists role text;

-- ─────────────────────────────────────────────────────────────────────────────
-- SSN encryption key — stored in Vault, never exposed to the client. One key per
-- environment, generated on first migration. Re-running is a no-op.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'referral_ssn_key') then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'referral_ssn_key',
      'Symmetric key for referral SSN encryption (pgp_sym)'
    );
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Access helpers (SECURITY DEFINER — run as owner, bypassing RLS on the tables
-- they read so they can evaluate tenant membership for any authenticated caller).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.is_super_admin()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_super_admin = true
  );
$$;

-- Returns the caller's role tier (1 = most privileged). Mirrors deriveRole():
-- super admin → 1 (OWNER); explicit role → its tier; null → 2 (CEO).
create or replace function public.profile_role_tier()
returns int language sql stable security definer
set search_path = public, pg_temp as $$
  select case
    when p.is_super_admin then 1
    else case p.role
      when 'OWNER'             then 1
      when 'CEO'               then 2
      when 'FINANCE'           then 3
      when 'REGIONAL_DIRECTOR' then 4
      when 'PROGRAM_MANAGER'   then 5
      when 'HR_MANAGER'        then 6
      when 'SCHEDULER'         then 7
      when 'HOUSE_LEAD'        then 8
      else 2  -- null/unknown → CEO, matching deriveRole() fallback
    end
  end
  from public.profiles p
  where p.id = auth.uid();
$$;

-- Can the caller see this company's data? (super admin, or licensee membership)
-- NOTE: the profiles.email = licensees.name join mirrors the existing `companies`
-- policy's temporary mapping — replace with a real licensee_id on profiles in Track B.
create or replace function public.has_company_access(p_company_id text)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select public.is_super_admin() or exists (
    select 1
    from public.licensee_companies lc
    join public.licensees l on l.id = lc.licensee_id
    join public.profiles  p on p.email = l.name
    where lc.company_id = p_company_id
      and p.id = auth.uid()
  );
$$;

-- Can the caller edit this company's data? (super admin, or editor membership)
create or replace function public.can_edit_company(p_company_id text)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select public.is_super_admin() or exists (
    select 1
    from public.licensee_companies lc
    join public.licensees l on l.id = lc.licensee_id
    join public.profiles  p on p.email = l.name
    where lc.company_id = p_company_id
      and lc.role = 'editor'
      and p.id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- referrals — main record. One row per potential client / referral.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.referrals (
  id                 uuid primary key default gen_random_uuid(),
  company_id         text not null references public.companies on delete cascade,

  -- auto-label (cached; also computed client-side via buildDisplayLabel)
  display_label      text,

  -- pipeline
  stage              text not null default 'NEW_INQUIRY',
  priority           text not null default 'normal',

  -- referral metadata
  source_type        text,
  intake_method      text,
  date_received      date,
  referring_party    jsonb,          -- { name, organization, role, phone, email }
  assigned_to        uuid references public.profiles,

  -- participant identity (label/filter fields only; full SSN lives in referral_ssn)
  first_name         text,
  last_name          text,
  preferred_name     text,
  dob                date,
  is_minor           boolean,
  ssn_last4          text,           -- masked display only, set via referral_set_ssn

  -- location / service / funding (filterable)
  city               text,
  county             text,
  region             text,
  state              text,
  service_level      text,
  pay_source         text,
  tsc                jsonb,          -- { name, agency, phone, email }

  -- follow-up / aging
  next_followup_date date,
  next_followup_owner uuid references public.profiles,
  stage_entered_at   timestamptz not null default now(),
  last_activity_at   timestamptz not null default now(),

  -- outcome / conversion
  outcome            text,
  outcome_reason     text,
  decision_date      date,
  client_record_link text,          -- placeholder until convert-to-client lands

  -- everything else (diagnoses, behavior notes, risk_indicators[], medical/ADL/
  -- communication needs, living situation, services_requested[], waiver,
  -- authorized units, guardianship block, placement block, etc.)
  details            jsonb not null default '{}',

  created_by         uuid references public.profiles default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index referrals_company_idx        on public.referrals (company_id);
create index referrals_stage_idx          on public.referrals (company_id, stage);
create index referrals_assigned_idx       on public.referrals (assigned_to);
create index referrals_followup_idx       on public.referrals (next_followup_date);

create trigger referrals_set_updated_at
  before update on public.referrals
  for each row execute procedure public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- referral_ssn — isolated, encrypted at rest. NO grants to authenticated.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.referral_ssn (
  referral_id   uuid primary key references public.referrals on delete cascade,
  ssn_encrypted bytea not null,
  updated_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Child tables. company_id is denormalized (auto-filled by trigger) so RLS
-- predicates stay simple and can't be spoofed by the client.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.referral_contacts (
  id            uuid primary key default gen_random_uuid(),
  referral_id   uuid not null references public.referrals on delete cascade,
  company_id    text not null references public.companies on delete cascade,
  kind          text not null default 'family',  -- family | emergency | guardian | poa
  name          text,
  relationship  text,
  phone         text,
  email         text,
  address       text,
  is_primary    boolean not null default false,
  ok_to_share   boolean not null default false,
  created_at    timestamptz not null default now()
);
create index referral_contacts_referral_idx on public.referral_contacts (referral_id);

create table public.referral_activity (
  id            uuid primary key default gen_random_uuid(),
  referral_id   uuid not null references public.referrals on delete cascade,
  company_id    text not null references public.companies on delete cascade,
  author_id     uuid references public.profiles default auth.uid(),
  kind          text not null default 'note',
  body          text,
  created_at    timestamptz not null default now()
);
create index referral_activity_referral_idx on public.referral_activity (referral_id);

create table public.referral_status_history (
  id            uuid primary key default gen_random_uuid(),
  referral_id   uuid not null references public.referrals on delete cascade,
  company_id    text not null references public.companies on delete cascade,
  from_stage    text,
  to_stage      text,
  changed_by    uuid,
  changed_at    timestamptz not null default now()
);
create index referral_status_history_referral_idx on public.referral_status_history (referral_id);

create table public.referral_audit_log (
  id            uuid primary key default gen_random_uuid(),
  referral_id   uuid,                -- nullable: deletes keep the audit row
  company_id    text,
  actor_id      uuid,
  action        text not null,       -- create | update | delete | stage_change | set_ssn | reveal_ssn
  field         text,
  detail        jsonb,
  created_at    timestamptz not null default now()
);
create index referral_audit_company_idx on public.referral_audit_log (company_id);
create index referral_audit_referral_idx on public.referral_audit_log (referral_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Triggers (all SECURITY DEFINER so they can write the tamper-resistant audit /
-- history tables, which authenticated has no direct INSERT grant on).
-- ─────────────────────────────────────────────────────────────────────────────

-- Auto-fill company_id on user-inserted children from the parent referral.
create or replace function public.set_referral_child_company()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  select company_id into new.company_id from public.referrals where id = new.referral_id;
  return new;
end;
$$;

create trigger referral_contacts_set_company
  before insert on public.referral_contacts
  for each row execute procedure public.set_referral_child_company();

create trigger referral_activity_set_company
  before insert on public.referral_activity
  for each row execute procedure public.set_referral_child_company();

-- Bump aging/activity timestamps on the parent row.
create or replace function public.referrals_touch_timestamps()
returns trigger language plpgsql
set search_path = public, pg_temp as $$
begin
  if new.stage is distinct from old.stage then
    new.stage_entered_at := now();
  end if;
  new.last_activity_at := now();
  return new;
end;
$$;

create trigger referrals_touch_timestamps_trg
  before update on public.referrals
  for each row execute procedure public.referrals_touch_timestamps();

-- Capture stage changes into status history.
create or replace function public.referrals_log_stage_change()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if new.stage is distinct from old.stage then
    insert into public.referral_status_history
      (referral_id, company_id, from_stage, to_stage, changed_by)
    values (new.id, new.company_id, old.stage, new.stage, auth.uid());
  end if;
  return new;
end;
$$;

create trigger referrals_log_stage_change_trg
  after update on public.referrals
  for each row execute procedure public.referrals_log_stage_change();

-- Write the create/update/delete audit trail.
create or replace function public.referrals_audit()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    insert into public.referral_audit_log (referral_id, company_id, actor_id, action)
      values (new.id, new.company_id, auth.uid(), 'create');
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.referral_audit_log (referral_id, company_id, actor_id, action,
      detail)
      values (new.id, new.company_id, auth.uid(),
        case when new.stage is distinct from old.stage then 'stage_change' else 'update' end,
        case when new.stage is distinct from old.stage
          then jsonb_build_object('from', old.stage, 'to', new.stage) else null end);
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.referral_audit_log (referral_id, company_id, actor_id, action)
      values (old.id, old.company_id, auth.uid(), 'delete');
    return old;
  end if;
  return null;
end;
$$;

create trigger referrals_audit_trg
  after insert or update or delete on public.referrals
  for each row execute procedure public.referrals_audit();

-- A new activity note bumps the parent's last_activity_at.
create or replace function public.referral_activity_touch_parent()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  update public.referrals set last_activity_at = now() where id = new.referral_id;
  return new;
end;
$$;

create trigger referral_activity_touch_parent_trg
  after insert on public.referral_activity
  for each row execute procedure public.referral_activity_touch_parent();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security — tenant isolation via the helper functions above.
-- (Role-tier visibility is enforced in the UI via access.js until profiles.role
--  is populated in Track B; see README. The SSN-unmask tier restriction IS
--  enforced server-side, in referral_reveal_ssn.)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.referrals             enable row level security;
alter table public.referral_ssn          enable row level security;
alter table public.referral_contacts     enable row level security;
alter table public.referral_activity     enable row level security;
alter table public.referral_status_history enable row level security;
alter table public.referral_audit_log    enable row level security;

-- referrals
create policy "referrals: tenant read"   on public.referrals for select
  using (public.has_company_access(company_id));
create policy "referrals: tenant insert" on public.referrals for insert
  with check (public.can_edit_company(company_id));
create policy "referrals: tenant update" on public.referrals for update
  using (public.can_edit_company(company_id))
  with check (public.can_edit_company(company_id));
create policy "referrals: tenant delete" on public.referrals for delete
  using (public.can_edit_company(company_id));

-- referral_contacts
create policy "referral_contacts: tenant read"   on public.referral_contacts for select
  using (public.has_company_access(company_id));
create policy "referral_contacts: tenant insert" on public.referral_contacts for insert
  with check (public.can_edit_company(
    (select company_id from public.referrals where id = referral_id)));
create policy "referral_contacts: tenant update" on public.referral_contacts for update
  using (public.can_edit_company(company_id));
create policy "referral_contacts: tenant delete" on public.referral_contacts for delete
  using (public.can_edit_company(company_id));

-- referral_activity (append-only for users)
create policy "referral_activity: tenant read"   on public.referral_activity for select
  using (public.has_company_access(company_id));
create policy "referral_activity: tenant insert" on public.referral_activity for insert
  with check (public.can_edit_company(
    (select company_id from public.referrals where id = referral_id)));

-- referral_status_history (read-only for users; written by trigger)
create policy "referral_status_history: tenant read" on public.referral_status_history for select
  using (public.has_company_access(company_id));

-- referral_audit_log (read-only for users; written by triggers/RPCs)
create policy "referral_audit_log: tenant read" on public.referral_audit_log for select
  using (public.has_company_access(company_id));

-- referral_ssn has RLS enabled but NO policies and NO grants → unreachable
-- except through the SECURITY DEFINER RPCs below.

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants. referral_ssn intentionally omitted for authenticated.
-- ─────────────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.referrals             to authenticated;
grant select, insert, update, delete on public.referral_contacts     to authenticated;
grant select, insert                 on public.referral_activity     to authenticated;
grant select                         on public.referral_status_history to authenticated;
grant select                         on public.referral_audit_log    to authenticated;

-- referral_ssn: revoke any default-privilege grants so the encrypted blob is
-- unreachable by client roles even with RLS aside — only the RPCs (owner) touch it.
revoke all on public.referral_ssn from anon, authenticated;

-- service_role (used by integration tooling) needs explicit grants — see
-- 20260612000000_fix_role_grants.sql for why.
grant select, insert, update, delete on public.referrals               to service_role;
grant select, insert, update, delete on public.referral_ssn            to service_role;
grant select, insert, update, delete on public.referral_contacts       to service_role;
grant select, insert, update, delete on public.referral_activity       to service_role;
grant select, insert, update, delete on public.referral_status_history to service_role;
grant select, insert, update, delete on public.referral_audit_log      to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- SSN RPCs — the only path to the encrypted column. Both run as owner and read
-- the Vault key inline (never exposing it to the client).
-- ─────────────────────────────────────────────────────────────────────────────

-- Set (or clear) a referral's SSN. Requires edit access to the company.
-- Stores the encrypted blob and the masked last-4. Pass null/empty to clear.
create or replace function public.referral_set_ssn(p_referral_id uuid, p_ssn text)
returns void language plpgsql security definer
set search_path = public, extensions, vault, pg_temp as $$
declare
  v_company text;
  v_key     text;
  v_digits  text;
begin
  select company_id into v_company from public.referrals where id = p_referral_id;
  if v_company is null then
    raise exception 'referral not found' using errcode = 'no_data_found';
  end if;
  if not public.can_edit_company(v_company) then
    raise exception 'not authorized to edit this referral' using errcode = 'insufficient_privilege';
  end if;

  v_digits := nullif(regexp_replace(coalesce(p_ssn, ''), '\D', '', 'g'), '');

  if v_digits is null then
    delete from public.referral_ssn where referral_id = p_referral_id;
    update public.referrals set ssn_last4 = null where id = p_referral_id;
  else
    select decrypted_secret into v_key from vault.decrypted_secrets
      where name = 'referral_ssn_key' limit 1;

    insert into public.referral_ssn (referral_id, ssn_encrypted, updated_at)
      values (p_referral_id, pgp_sym_encrypt(v_digits, v_key), now())
      on conflict (referral_id)
      do update set ssn_encrypted = excluded.ssn_encrypted, updated_at = now();

    update public.referrals set ssn_last4 = right(v_digits, 4) where id = p_referral_id;
  end if;

  insert into public.referral_audit_log (referral_id, company_id, actor_id, action, field)
    values (p_referral_id, v_company, auth.uid(), 'set_ssn', 'ssn');
end;
$$;

-- Reveal the full SSN. Requires company access AND role tier <= 3 (OWNER/CEO/FINANCE).
-- Every call is audit-logged regardless of outcome path.
create or replace function public.referral_reveal_ssn(p_referral_id uuid)
returns text language plpgsql security definer
set search_path = public, extensions, vault, pg_temp as $$
declare
  v_company text;
  v_key     text;
  v_ssn     text;
begin
  select company_id into v_company from public.referrals where id = p_referral_id;
  if v_company is null then
    raise exception 'referral not found' using errcode = 'no_data_found';
  end if;
  if not public.has_company_access(v_company) then
    raise exception 'not authorized for this referral' using errcode = 'insufficient_privilege';
  end if;
  if public.profile_role_tier() > 3 then
    raise exception 'role not permitted to unmask SSN' using errcode = 'insufficient_privilege';
  end if;

  insert into public.referral_audit_log (referral_id, company_id, actor_id, action, field)
    values (p_referral_id, v_company, auth.uid(), 'reveal_ssn', 'ssn');

  select decrypted_secret into v_key from vault.decrypted_secrets
    where name = 'referral_ssn_key' limit 1;

  select pgp_sym_decrypt(ssn_encrypted, v_key) into v_ssn
    from public.referral_ssn where referral_id = p_referral_id;

  return v_ssn;  -- null if no SSN on file
end;
$$;

revoke all on function public.referral_set_ssn(uuid, text)   from public;
revoke all on function public.referral_reveal_ssn(uuid)      from public;
grant execute on function public.referral_set_ssn(uuid, text) to authenticated, service_role;
grant execute on function public.referral_reveal_ssn(uuid)    to authenticated, service_role;
