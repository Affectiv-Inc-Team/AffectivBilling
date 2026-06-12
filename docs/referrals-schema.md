# Referral & Intake Tracker — Schema & Decisions (Phase 1)

A lightweight CRM/pipeline for **potential clients (referrals)** — one tracker per company,
tenant-isolated, visible from the access floor upward. Phase 1 ships the data model, the client
data layer, and the sectioned capture form (single-field save + auto-label). Kanban/list filters,
documents, and notifications are deferred.

Migration: [`supabase/migrations/20260612010000_referral_tracker.sql`](../supabase/migrations/20260612010000_referral_tracker.sql).

## Stack note

The original build spec assumed Node/Express + Postgres-RLS. Intrinsic has **no Express layer** —
it is client-side React talking to Supabase directly. So "API endpoints" are realized as Supabase
tables + RLS policies + `SECURITY DEFINER` RPCs, called from `src/lib/referrals.js`.

## Tables

| Table | Purpose |
|---|---|
| `referrals` | Main record. First-class columns drive RLS, the auto-label, and future kanban/filters; the long tail (clinical/placement/guardianship/etc.) lives in `details jsonb`. Holds `ssn_last4` for masked display — never the full SSN. |
| `referral_ssn` | Isolated, encrypted-at-rest SSN blob. **No grants to `authenticated`**; reachable only through the RPCs. |
| `referral_contacts` | Repeatable family / emergency / guardian / POA contacts. |
| `referral_activity` | Append-only attributed activity log. |
| `referral_status_history` | Auto-captured on every stage change (by trigger). |
| `referral_audit_log` | Create / update / delete / stage_change / set_ssn / **reveal_ssn**. Written only by triggers + RPCs (tamper-resistant). |

`profiles` gains a nullable `role text` column (forward-compatible with Track B; also makes the
existing `getProfile()` select valid).

## Access model

- **Tenant isolation (RLS):** every referral table is gated by `has_company_access(company_id)`
  (read) / `can_edit_company(company_id)` (write). These are `SECURITY DEFINER` helpers that mirror
  the existing `companies` policy's licensee join, but run as owner so they can evaluate membership
  without tripping the (super-admin-only) RLS on `licensee_companies`. This also avoids the
  over-restriction the inline `companies` policies hit for normal users.
- **Module visibility floor = PROGRAM_MANAGER (tier 5).** Enforced in the UI via
  `canSeeReferrals()` in [`src/lib/access.js`](../src/lib/access.js). Not enforced in RLS yet — see
  *Known limitation* below.
- **SSN unmask floor = FINANCE (tier 3).** Enforced **server-side** in `referral_reveal_ssn`
  (`profile_role_tier() <= 3`) and in the UI via `canUnmaskSSN()`.
- Server-side role tiers (`profile_role_tier()`) mirror `deriveRole()` in `src/App.jsx`: super
  admin → OWNER (1); explicit `profiles.role` → its tier; null → CEO (2).

## SSN handling (PHI)

- Stored encrypted at rest via `pgcrypto` `pgp_sym_encrypt`, in the isolated `referral_ssn` table.
- The symmetric key lives in **Supabase Vault** (`referral_ssn_key`), generated per-environment on
  first migration, read inline only inside the `SECURITY DEFINER` RPCs — never sent to the client.
- `referral_set_ssn(referral_id, ssn)` — requires company edit rights; encrypts, stores
  `ssn_last4`, audit-logs `set_ssn`. Passing null/empty clears it.
- `referral_reveal_ssn(referral_id)` — requires company access **and** tier ≤ 3; audit-logs
  `reveal_ssn` on every call; returns the decrypted value (or null if none on file).
- Masked display (`•••-••-1234`) uses `referrals.ssn_last4`. The full number is never selectable.

## Data layer (`src/lib/referrals.js`)

`listReferrals`, `getReferral`, `createReferral` (guards `isSaveable`, computes `display_label`),
`updateReferral`, contact CRUD, `addActivity`, and the `setSSN` / `revealSSN` RPC wrappers.

Pure, unit-tested logic lives in [`src/lib/referralShape.js`](../src/lib/referralShape.js):
`isSaveable` (one-field-to-save), `buildDisplayLabel` (name → referring party + date → "Unnamed
referral · {source} · {date}"), `softWarnings`, and the enum constants.

## Decisions made

- **Hybrid normalized + JSONB** rather than a single blob like `companies`, because referrals need
  filtering, kanban, field-level SSN restriction, and audit.
- **Audit via DB triggers** (not client calls) so the trail can't be bypassed.
- **`company_id` denormalized** onto child tables (auto-filled by trigger) to keep RLS predicates
  simple and unspoofable.
- Deferred per the agreed scope: convert-to-client handoff (`client_record_link` placeholder only)
  and per-company configurable stages (constant for now).

## Known limitation / prerequisite

`profiles.role` is a Track-B field and is currently unpopulated, so **module-visibility role-tier
gating runs in the UI only** (RLS enforces tenant isolation reliably; the SSN-unmask tier check is
enforced server-side and fails closed). Once Track B populates `profiles.role`, a tier ≤ 5 predicate
can be added to the referral RLS policies for defense-in-depth.

If `supabase_vault` is unavailable in a target environment, swap the Vault key read for a database
custom setting (e.g. `current_setting('app.referral_ssn_key')`) inside the two RPCs.

## Deferred phases

- **Kanban + filters/search** (columns already present).
- **Documents** — `referral_documents` + Supabase Storage bucket + per-type tagging + read audit.
- **Notifications** — in-app first (compute due/stale/priority from queries; `referral_settings`
  table for per-Director config + ack/snooze), then email via an Edge Function + `pg_cron`.
- **Encryption hardening** — extend app-level encryption beyond SSN to other clinical fields.
