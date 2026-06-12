# Integration Plan — Referral Tracker ↔ Sister Software Service

**Status:** design reference for future work (not yet implemented).
**Scope:** how a referral that reaches an outcome (esp. **Enrolled**) hands off to, and stays in
sync with, a sister service — primarily the client/billing system this platform bills under
(AffectivBilling), and secondarily external systems (EHR, TSC/plan-developer portals, state MMIS).

This is the concrete follow-up to the build spec's Open Question #2 ("convert-to-client") and the
`referrals.client_record_link` placeholder. The Outcome / conversion section of the intake form is
the natural trigger surface.

---

## 1. Goal & principles

- **No double data entry.** When a referral converts, the participant's identity, contacts,
  service request, and clinical profile should pre-populate the client record.
- **One source of truth per lifecycle stage.** The referral owns the *prospect* phase; the client
  system owns the *active* phase. After conversion the referral becomes read-only and points at the
  client record.
- **PHI stays protected end to end.** SSN is never transmitted in plaintext through logs, URLs, or
  query strings; consent/ROI is captured before any data leaves the tenant (the `ok_to_share` flag
  on contacts and a future ROI document gate). All cross-system reads/writes are audit-logged on
  both sides.
- **Idempotent & reversible.** A conversion can be retried without creating duplicate clients, and
  a mis-conversion can be unlinked.

---

## 2. Trigger points

| Event in the referral tracker | Integration action |
|---|---|
| Outcome set to **Enrolled** | Create / link a client record in the sister service |
| Outcome set to **Declined / Withdrawn / Referred Out** | No client record; optionally notify referring party / push outcome to a TSC portal |
| Stage → **Accepted (Pending Placement)** | Optionally pre-create a *draft* client record so placement/scheduling can begin |
| Document uploaded (referral packet, ISP, ROI) | Optionally forward to the client system's document store once converted |

Conversion should be an explicit, role-gated action ("Convert to client"), not a silent side
effect of a dropdown change — to keep a human in the loop on an irreversible cross-system write.

---

## 3. Integration approaches (pick per where the sister service lives)

### Approach A — In-platform (same Supabase project) — *recommended first step*
If the client/billing module shares this Supabase database:
- Add a `clients` table and a `referral_id uuid references referrals` (or the reverse FK on
  `referrals.client_record_link`).
- A `SECURITY DEFINER` RPC `referral_convert_to_client(p_referral_id)` runs in one transaction:
  copies mapped fields → `clients`, copies the SSN by calling the existing decrypt+re-encrypt path
  *inside the DB* (never surfacing plaintext to the client), sets `referrals.outcome='enrolled'`
  and `referrals.client_record_link = <client id>`, and writes an audit row on both tables.
- Cheapest, transactional, no network/PHI-in-transit surface. Reuses the RLS/role model already in
  `access.js` and the migration's helper functions.

### Approach B — Cross-service REST API (separate service/DB)
If the sister service is a separate deployment:
- Outbound call from a Supabase **Edge Function** (so the service token never reaches the browser):
  `POST /clients` with the mapped payload + an `Idempotency-Key` = referral id.
- Service-to-service auth via a short-lived signed token (not the anon key); mutual TLS or an
  allow-listed egress if available.
- On success, store the returned client id in `referrals.client_record_link`. On failure, leave the
  referral unconverted and surface a retry — never partially convert.

### Approach C — Event-driven sync (loose coupling, multiple consumers)
- A DB trigger on `referrals` (outcome/stage change) writes to an `integration_outbox` table;
  an Edge Function (via `pg_cron` or a queue) drains it and publishes domain events
  (`referral.enrolled`, `referral.declined`) to whichever consumers subscribe (client system,
  analytics, TSC portal). Best when more than one downstream system cares.

Start with **A** if same-DB; graduate to **B/C** when a second system needs the data.

---

## 4. Field mapping (referral → client record)

| Referral field | Client record field | Notes |
|---|---|---|
| `first_name`, `last_name`, `preferred_name`, `dob`, `is_minor` | identity block | direct |
| `referral_ssn` (encrypted) | client SSN (encrypted) | transfer ciphertext or re-encrypt in-DB; **never plaintext in transit** |
| `details.medicaid_id`, `details.other_ids` | payer IDs | direct |
| `city/county/region/state`, `details.address` | address | direct |
| `details.services` (array), `service_level`, `pay_source`, `details.waiver` | authorization / service plan seed | maps to billing setup |
| `tsc` (jsonb) | plan developer / care coordinator contact | direct |
| `details.diagnoses`, `details.risk_indicators`, `details.medications` (now structured: name/dosage/frequency/purpose) | clinical profile | structured medications map cleanly to a med-administration record |
| `referral_contacts` (family/emergency) | client contacts | carry the `ok_to_share` flag; gate sharing on it |
| `details.guardian`, `details.poa`, `self_guardian` | guardianship | direct |
| `id` | `clients.referral_origin_id` | provenance / dedup key |

The structured **medications** model (added alongside this plan) is what makes a clean handoff to a
medication-administration record (MAR) possible — a free-text blob could not have mapped. A future
enhancement is to back the medication-name field with a real drug database (RxNorm / openFDA) via an
Edge Function so the stored value carries a stable code (RxCUI), which the client/MAR system can
consume directly. The current local `src/data/medications.js` list is the offline placeholder for
that field; swapping it for a coded lookup is non-breaking.

---

## 5. Security & compliance

- **Consent gate:** do not transmit a participant's data to any external system until an ROI/consent
  document is on file (Phase 3 documents work) and, per-contact, `ok_to_share = true`.
- **SSN in transit:** prefer Approach A (in-DB, no transit). For B/C, send ciphertext + a key
  reference, or use a field-level encrypted channel — never the masked-or-plaintext value in a JSON
  body that gets logged. Strip SSN from any request/response logging.
- **Audit both sides:** extend `referral_audit_log` with a `convert`/`export` action and record the
  destination system + client id. The sister service logs the inbound create.
- **Least privilege:** the Edge Function uses a scoped service identity, not the broad service-role
  key, and only for the conversion endpoint.
- **Idempotency:** referral id as the idempotency key prevents duplicate clients on retry.

---

## 6. Phasing

1. **Phase A — manual link (today).** `client_record_link` is a free-text field; staff paste the
   client id/URL after creating the client by hand. Zero integration code; unblocks the workflow.
2. **Phase B — one-click convert (in-platform).** `referral_convert_to_client` RPC + a "Convert to
   client" button gated to the appropriate role; transactional, same DB. Replaces manual paste.
3. **Phase C — cross-service / event-driven.** Edge Function + outbox for separate services and
   multi-consumer events; add reconciliation (nightly diff of converted referrals vs. clients).

---

## 7. Open questions (confirm before building Phase B+)

- Does the sister client/billing system share this Supabase project, or is it a separate service?
  (Decides A vs. B/C.)
- Is the unit of conversion a *client*, an *authorization*, or both?
- Who owns the participant record after conversion — can the referral still be edited, or fully
  frozen and read-only?
- Required consent artifacts before any external transmission, and where they're stored.
- Do we need to push *non-enrolled* outcomes anywhere (e.g., report declines back to the referring
  TSC or state)?
