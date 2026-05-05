# Intrinsic SaaS Build — Handoff Document

**Project:** Intrinsic — HIPAA-compliant Medicaid billing & financial-modeling SaaS for HCBS providers
**Founder/Developer:** Shawn (Intrinsic Inc, Boise, Idaho)
**Initial geographic focus:** Idaho (with planned expansion to Utah, Nevada, Arizona)
**Stack:** Vite + React frontend, Supabase auth/db, AWS ECS Fargate target deployment
**Document covers:** Track A architectural refactor and TSC service line implementation
**Status as of handoff:** Track A files generated, esbuild-verified, ready for local deployment & verification

---

## Table of Contents

1. [Project Background](#project-background)
2. [Architecture Decisions (Locked)](#architecture-decisions-locked)
3. [Service Line Taxonomy](#service-line-taxonomy)
4. [Rate Sources Analyzed](#rate-sources-analyzed)
5. [Chronological Build Log](#chronological-build-log)
6. [Files Delivered](#files-delivered)
7. [Bugs Encountered & Fixed](#bugs-encountered--fixed)
8. [Roadmap & Pending Work](#roadmap--pending-work)
9. [Deployment Process](#deployment-process)

---

## Project Background

Intrinsic is a multi-tenant SaaS platform purpose-built for HCBS (Home and Community-Based Services) and IDD (Intellectual and Developmental Disabilities) provider agencies. The platform serves small-to-mid-size agencies starting in Idaho, with the financial modeling tool as the primary product surface.

The product targets services including SLS (Supported Living Services), JD (Job Discovery), CSE (Community Supported Employment), EES (Extended Employment Supports), TSC (Targeted Service Coordination), PD (Plan Development), ADH (Adult Day Health), and DT (Day Treatment).

Shawn's domain expertise — HCBS/IDD billing workflows, EDI standards (837P/835), HCPCS coding, multi-state payer systems including Gainwell, Molina, and DXC — is the primary competitive moat. The platform encodes that expertise into reusable software.

### Pre-existing assets entering this conversation

Before this build session began, Shawn had:

- A working Vite/React + Supabase deployment with auth via `loadConfig`/`saveConfig` keyed on `profile.company_id`
- A 2,790-line `FinancialTool.jsx` in production with single-config (no multi-company) state
- A 3,160-line `idaho-hcbs-tool-complete_1.jsx` dev variant
- Supporting files: `App.jsx`, `LoginPage.jsx`, `AdminPanel.jsx`, `ToolPage.jsx`, `main.jsx`, `index.html`, `package.json`, `supabase.js`, `DEPLOYMENT_GUIDE.md`
- 16+ Idaho fee schedule PDFs (post-9/1/2025 4% rate reduction)
- 3 Magellan IBHP behavioral health rate PDFs (effective 4/13/2026)

---

## Architecture Decisions (Locked)

### Two layers of "company"

- **Licensee** = the SaaS subscriber (lives in Supabase `companies` table)
- **Portfolio company** = the operating entity being financially modeled (e.g., Inspire Human Services, WDB Inc, Residential Habilitation of Idaho)

In-app, the word "company" always refers to the portfolio company. SaaS-level discussion uses "licensee."

### Access control: Model 1 (CONFIRMED)

- Only **SuperAdmin** (Intrinsic Inc) provisions companies with their own data
- SuperAdmin assigns licensee access to specific companies
- Licensees **CANNOT** create or add companies — they only see ones they've been assigned
- Licensees CAN switch between assigned companies via a picker

This decision implies:

- M2M `licensee_companies` junction table
- Row-level security (RLS) policies enforcing licensee → assigned-companies-only access
- Separate SuperAdmin admin UI for company create/assign/revoke
- Different from the dev branch which had a pre-built multi-company variant; production was single-tenant-per-licensee

### Idaho only for v1

Multi-state support deferred. All rates from post-9/1/2025 reduction. BH rates from Magellan IBHP effective 4/13/2026.

### Behavioral Health: 7-line broader granularity

Rather than collapsing all BH into one service line, BH was split into seven distinct service lines because their financial models differ materially:

1. **BH_OUTPATIENT** — Practice-style psychotherapy, eval, office visits with credential tiers
2. **BH_CBRS** — Skills building, case management, recovery coaching, peer support (community-based)
3. **BH_CRISIS** — Mobile crisis and telephonic crisis (H2011, H0030)
4. **BH_CHILDRENS_IHCBS** — TBS, FFT, MDFT, MST, CFT, CANS, TASSP modalities
5. **BH_SUD** — Substance Use Disorder outpatient + MAT + residential ASAM levels
6. **BH_DAY_TREATMENT** — IOP/PHP/Day Treatment per-day programs
7. **BH_SSH** — Safe and Sober Housing per-diem

UX requirement: switching between service lines within a company must be one click — verified via the new tab strip design.

### Wipe preset companies during rebuild

Inspire/WDB/RHI/SRCSL preset data is wiped during the architectural rebuild. Shawn rebuilds within portfolios later. Migration adapter handles old saves gracefully.

### Two-track build

- **Track A** = JSX tool refactor (completed in this conversation)
- **Track B** = Supabase schema + SuperAdmin admin tooling (deferred to future work)

Track A works against in-memory state and the existing data layer; Track B doesn't need to land before Track A is testable.

### Rate handling: 4% reductions are baked in

The `Rate Effective 9/1/2025` columns in standalone fee schedules ARE the post-reduction rates. No compare-and-pick logic needed; just use the schedule rates directly. Confirmed against the `4__Provider_Rate_Reductions_Fee_Schedules.xlsx` cross-reference.

---

## Service Line Taxonomy

**25 service lines across 11 archetypes.**

### Per-diem residential
- `RES_HAB_DAILY` — DD waiver intense ($726.22) / high ($394.44) ✅ ACTIVE
- `ICF` — per-facility per-diem (NPI-keyed)
- `SNF` — per-facility per-diem (NPI-keyed)

### Per-diem A&D residential
- `CFH` — Certified Family Home (S5140 day, T1019 PCS)
- `RALF` — Residential Assisted Living Facility (S5140 day + T1019 HE milieu)
- `ADULT_DAY_HEALTH` — standalone S5100

### Hourly residential
- `RES_HAB_HOURLY` — H2015 ($7.56 indiv / $3.86 group HQ) ✅ ACTIVE

### Caseload coordinator
- `TSC` — Targeted Service Coordination (G9002 $20.97 + paraprofessional HM $13.46) ✅ ACTIVE
- `AD_CASE_MGMT` — A&D Case Management (G9002 CC $13.46)
- `SUPPORT_BROKER` — Family Directed (T2041, manually priced)

### Hourly direct service — agency tier
- `VOC_SERVICES` — Supported employment (H2023 $11.44)
- `ADULT_DDA` — State Plan HCBS (97537, H2032, H2000, H2011)
- `CHILDRENS_DDA` — CHIS with multi-tier credentials (Tech/Specialist/Professional/EBM tiers)
- `PAA` — Personal Assistance Agency (S5125 $6.11 attendant care, etc.)

### Hourly direct service — independent tier
- `CHILDRENS_DD_INDEPENDENT` — same services as CHIS at lower independent rates

### Per-visit episodic
- `HOME_HEALTH` — RC 421/431/441/551/571 (PT/OT/Speech/Skilled Nursing/HHA)
- `PDN` — Private Duty Nursing (T1001 visit, T1002 RN, T1003 LPN)

### Per-day program
- `HOSPICE` — county-keyed per-diem with quality-data flag
- `BH_DAY_TREATMENT` — H2012, H0017, H0035, S9480
- `BH_SSH` — Adult SSH per-diem (H0044 + SE/HF)

### Specialized BH
- `BH_OUTPATIENT` — Magellan rates with PHYSICIAN/MED_PSYCH/PSYCH credential tiers
- `BH_CBRS` — Community-based rehabilitative
- `BH_CRISIS` — H2011 + H0030
- `BH_CHILDRENS_IHCBS` — H0036 + U5/U7/U8/U9 modality modifiers, H2033 MST
- `BH_SUD` — outpatient + MAT bundles + residential ASAM levels

### Mixed modality
- `SCHOOL_BASED` — Multi-discipline school services

### Self-direct fiscal intermediary
- `SELF_DIRECT` — T2025, T2040 PMPM Family Directed services + Fiscal Employer Agent

**Status legend:**
- ✅ ACTIVE = full UI tabs and calculator implemented
- (catalog) = rate data + type metadata exist; UI shows read-only rate table placeholder
- planned = reserved, not yet pickable

3 active, 22 catalog at end of Track A.

---

## Rate Sources Analyzed

All sourced from `/mnt/user-data/uploads/` during the conversation. Effective dates noted.

### Idaho Medicaid Fee Schedules (effective 9/1/2025, post-4% reduction)

- `Targeted_Service_Coordination_Fee_Schedule.pdf` — TSC G9002, G9007, H2011
- `SNF_-_SFY_2026_Q4_Rates.pdf` — Skilled nursing facilities
- `School_Based_Services_Fee_Schedule.pdf` — Multi-discipline school services
- `Residential_Assisted_Living_Facility_Fee_Schedule.pdf` — RALF S5140 + T1019 HE
- `Private_Duty_Nursing_Fee_Schedule.pdf` — PDN T1001/T1002/T1003
- `Personal_Assistance_Agency_Fee_Schedule.pdf` — PAA S5115/S5120/S5125/S5130/S5135
- `January_to_March_2026_Fee_Schedule_pdf_v2_1.pdf` — General Q1 2026 cross-reference
- `ICF_-_SFY_2026_Rates_09_01_2025-06_30_2026.pdf` — Intermediate Care Facilities
- `Hospice_Fee_Schedule.pdf` — County-keyed per-diem matrix (RC 0651/0652/0655/0656 + SIA)
- `Home_Health_Fee_Schedule.pdf` — Per-visit by discipline (RC 421/431/441/551/571)
- `Children_s_DDA_Fee_Schedule.pdf` — CHIS with credential tiers
- `Children_s_DD_Independent_Providers_Fee_Schedule.pdf` — Lower independent tier
- `Certified_Family_Homes_Fee_Schedule.pdf` — CFH S5140, T1019, T1005
- `Aged_and_Disabled_Waiver_Services.pdf` — A&D waiver
- `Adult_Developmental_Disabilities_Waiver_Services.pdf` — Adult DD waiver
- `4__Provider_Rate_Reductions_Fee_Schedules.xlsx` — Cross-reference confirming standalone schedule rates already include the 4% reduction

### Magellan IBHP Rates (effective 4/13/2026)

- `ID_IBHP_Rates_4-13-2026__v__4-7-2026.pdf` — 14 pages, 3 credential tiers (Physician / Medical Psychologist / Psych)
- `ID_IBHP_FQHC_RHC_FFS_Paraprofessional_Rates_4-13-2026__v__4-7-2026.pdf` — Paraprofessional-only rates
- `ID-PRV-042226_IBHP_Rates_Change_Log_Final_Clean.pdf` — Change log (added Adult Peer Support H0038+HB ages 18+, moved H0022 Staffing/Planned Facilitation from SSH to SUD)

---

## Chronological Build Log

### Phase 1: Bug fix on the dev variant (idaho-hcbs-tool-complete_1.jsx)

**Initial reported issue:** brace imbalance in `calcHourlyParticipant` around line 218 producing a layout problem (large empty space below header).

**Investigation revealed:** the brace count was actually fine. The real bug was a JSX structural issue elsewhere in the file: a stray `</div>` at line 3024 was prematurely closing the outer page wrapper div, leaving the grid content as a sibling of the wrapper rather than a child. Combined with the wrapper's `minHeight: 100vh` style, this produced the large empty space below the header.

**Fix:** relocated the stray `</div>` to the correct position near the bottom of the render so the wrapper correctly contained both the header and the grid content. Verified using esbuild parse + a custom JSX tag-stack walker.

**Output:** corrected 3,159-line file delivered to `/mnt/user-data/outputs/idaho-hcbs-tool-complete.jsx`.

### Phase 2: Architectural design conversation

Worked through the full architecture for the production refactor. Discussed:

- Multi-tenant access models (Model 1 vs Model 2) — locked Model 1
- BH service line granularity (one big line vs split) — locked 7-way split for flexibility
- Service line picker UX (must be one-click switch between lines)
- Two-track build separation (frontend refactor independent from Supabase schema work)
- Rate handling for the 4% reduction (use schedule rates directly)
- Fate of preset companies during rebuild (wipe and rebuild)

Outcome: full architecture document, multi-tenant access SVG diagram, and locked decisions list.

### Phase 3: Track A foundation files (3 files)

Generated the three foundation modules:

1. **`types.js`** — Service line type registry
   - 25 type IDs as a `SERVICE_LINE_TYPES` enum
   - 11 archetype constants with display labels
   - `SERVICE_LINE_DEFS` map with status (active/catalog/planned), default config factories, archetype, billingUnit, description
   - Helper functions: `getDef`, `getActiveTypes`, `getPickableTypes`, `getGroupedPickerOptions`

2. **`companyShape.js`** — Data model factories + migration adapter
   - v2 config shape definition
   - `createCompany`, `createServiceLine`, `createSharedConfig` factories
   - `migrateConfig(oldConfig)` adapter handling: null → empty default, flat v1 (production) → v2, multi-company v1 (dev) → v2, v2 → v2 passthrough
   - Selectors: `getSelectedCompany`, `getSelectedServiceLine`, `getServiceLineByType`

3. **`idahoRates.js`** — Flat rate catalog (~150 records)
   - Each record: `{code, modifier, desc, unit, rate, lines, tier?, note?}`
   - Hospice handled separately via `getHospiceRate(county, qualityDataSubmitted)` due to county × code matrix shape
   - Manually-priced/contract-specific BH codes have `rate: null`
   - Helpers: `ratesForLine`, `findRate`, `resolveRate(serviceLineType, code, modifier, tier, overrides)` for licensee overrides
   - `unitsFromHours`/`hoursFromUnits` conversion helpers
   - Effective dates documented: 2025-09-01 (Idaho), 2026-04-13 (Magellan BH), 2025-10-01 (hospice)

### Phase 4: Track A integration (2 files + production refactor)

**Strategy decision:** rather than regenerate 2,790 lines of mostly-unchanged code, copy production `FinancialTool.jsx` to scratch, surgically replace the App() component + add imports, and add a TSC module as a separate file. Existing components stay verbatim because their internals are correct — the refactor scope is navigation + state shape, not calculator internals.

**Files generated:**

4. **`tsc.jsx`** — TSC service line module (caseload coordinator pattern)
   - Inline rate constants (TSC_RATES: COORD $20.97, COORD_PARAPRO $13.46, PLAN_DEV $20.97, CRISIS $20.97, CRISIS_PARAPRO $13.46)
   - Factories: `mkParticipant`, `mkCoordinator`, `defaultTSCConfig`
   - Calculators: `calcTSCParticipant`, `calcTSCCoordinator`, `calcTSCService`
   - Three exported tab components: `TSCRosterTab`, `TSCProductivityTab`, `TSCPLTab`
   - Pattern from earlier standalone TSC tool (Terri/Michelle/Nathan/Malynn/Michele coordinators with pre-seeded participant rosters)
   - 22% default payroll burden, 160hr/month FTE assumption for utilization

5. **`FinancialTool.jsx`** — Refactored production tool (3,197 lines, up from 2,790)
   - All existing components verbatim from production: `calcHome`, `calcHourlyParticipant`, `mkType`, `mkHome`, `mkHourly`, `DEFAULT_TYPES/HOMES/HOURLY/MGMT_DEF/OVHD_DEF`, `calcTax`, `Slider/Stepper/Toggle/MarginRing/Chip/SL/MixBadges`, `HomeTypeCard`, `HomeModelerCard`, `HomeMixEditor`, `HourlyTab`, `LaborEfficiencyTab`, `SingleHomeProjector`, `BudgetBuilderTab`, `FAQTab`, `PortfolioComparison`, `Sidebar`, `CompanyTab`, `CompanyPL`
   - New imports: migrateConfig, type registry, rate catalog, TSC module
   - Three new helper components: `ServiceLineTab`, `AddServiceLineButton`, `CatalogPlaceholder`
   - `SUB_TABS` routing table
   - Fully rewritten `App()` component:
     - Single `useState(() => migrateConfig(initialConfig))` instead of 13 separate useStates
     - Adapter setters (`setWage`, `setHomeTypes`, etc.) dispatch into v2 nested shape so existing components keep their prop signatures
     - Header gains company picker (only visible when more than one assigned company), TSC Caseload KPI tile
     - Service line tab strip: `[🏢 Whole Company | Res Hab Daily | Res Hab Hourly | TSC | + Add Service Line]`
     - Whole Company sub-tabs: Company P&L | Budget Builder | FAQ | Portfolio (with cross-service-line P&L roll-up including TSC revenue)
     - Per-service-line sub-tabs route to existing components scoped to that service line's config
     - Catalog-status service lines render `CatalogPlaceholder` with read-only rate table for that line
     - `handleSave` passes full v2 config blob to `onSave` — supabase.js stores as-is; no Track B required for save to work

### Phase 5: Verification

- All five files parsed cleanly through esbuild (`/home/claude/.npm-global/.../esbuild` v0.27.7) with no warnings
- Custom JSX tag-stack walker confirmed App() balanced
- File sizes: FinancialTool.jsx 316KB, idahoRates.js 60KB, tsc.jsx 27KB, types.js 15KB, companyShape.js 13KB

---

## Files Delivered

All in `/mnt/user-data/outputs/` from this conversation:

### Active production files (drop into project)

| File | Target path | Purpose | Lines |
|---|---|---|---|
| `FinancialTool.jsx` | `src/pages/FinancialTool.jsx` (replace existing) | Refactored main tool | 3,197 |
| `companyShape.js` | `src/lib/companyShape.js` (new) | Data model + migration | ~280 |
| `types.js` | `src/serviceLines/types.js` (new) | Service line registry | ~340 |
| `tsc.jsx` | `src/serviceLines/tsc.jsx` (new) | TSC service line module | ~600 |
| `idahoRates.js` | `src/data/idahoRates.js` (new) | Idaho rate catalog | ~370 |

### Earlier deliverable (separate from Track A)

| File | Purpose |
|---|---|
| `idaho-hcbs-tool-complete.jsx` | Bug-fixed dev variant (stray `</div>` resolved) — 3,159 lines |

---

## Bugs Encountered & Fixed

### Bug 1: Phantom brace imbalance / layout whitespace

**Symptom:** Large empty space below header. Initially reported as a brace imbalance in `calcHourlyParticipant` around line 218.

**Actual cause:** Misdiagnosis. The brace count was correct. Real issue: a stray `</div>` at line 3024 of `idaho-hcbs-tool-complete_1.jsx` was prematurely closing the outer page wrapper. Combined with `minHeight: 100vh` on the wrapper, the orphan grid content rendered as a sibling, not a child, producing the empty space.

**Resolution:** Relocated the stray `</div>` to its correct position near the bottom of the render. Verified with esbuild parse + custom JSX tag-stack walker that all tags balance correctly.

**Lesson:** When a brace count "looks wrong" in a long JSX file, check JSX tag balance separately — `}` and `</div>` errors look similar in their downstream effects but require different tools to diagnose.

### Bug 2: tsc.js extension mismatch (caught during integration verification)

**Symptom:** esbuild error: `The esbuild loader for this file is currently set to "js" but it must be set to "jsx" to be able to parse JSX syntax.`

**Cause:** TSC module contains JSX (the three tab components) but was originally named `tsc.js`. Vite's default loader config treats `.js` files as plain JavaScript.

**Resolution:** Renamed `tsc.js` → `tsc.jsx`, updated import path in `FinancialTool.jsx` (`"../serviceLines/tsc.js"` → `"../serviceLines/tsc.jsx"`), re-verified all five files parse cleanly.

### Earlier-conversation bugs (referenced from context)

From the standalone TSC tool work that preceded this conversation:

- **`returnReact is not defined`** — resolved by adding React explicitly to the import statement
- **Storage loading fragility** — resolved by wrapping each storage key independently and migrating to `tscv4-*` storage keys

These are documented for completeness; both predate the Track A work.

---

## Roadmap & Pending Work

### Immediate next step
Local verification: drop the five files into the project, run `npm run dev`, log in with existing credentials, confirm the migration upgrades production data without loss.

### Track B (deferred — full backend)

**Supabase schema additions:**
- `companies` table with JSONB `config` column for the v2 blob
- `licensees` table (may rename existing `companies` table)
- `licensee_companies` M2M junction table with role column (read-only / editor) and assignment timestamp
- `super_admins` flag on profiles or separate table

**RLS policies:**
- Licensees can only SELECT/UPDATE companies they have a row in `licensee_companies` for
- SuperAdmin bypass policy

**Application code:**
- `AdminPanel.jsx` extensions for company create/assign/revoke UI
- `supabase.js`: `loadAssignedCompanies()`, `saveCompany(companyId, config)`, super-admin helpers
- Login flow updates to load all assigned companies and pick first one by default

### Track A polish (forward-looking)

- Build out catalog-status service line UIs as licensee demand dictates (the pattern is established by TSC; new service lines mean: write a calc + tab components module, register sub-tabs in `SUB_TABS`, add routing in App())
- Per-service-line wage overrides for cases where service line wages should differ (e.g., Children's DDA Tier 4 staff vs Tech-tier)
- Expand BH rate catalog from ~50 representative codes to full ~250 (code, modifier, tier) tuples — mechanical data entry once licensee demand surfaces

---

## Deployment Process

1. **Back up the existing `FinancialTool.jsx`** to `FinancialTool.OLD.jsx` or external location.
2. **Locate the existing file** by searching project for `export default function App({ initialConfig`.
3. **Create three new folders** relative to wherever `FinancialTool.jsx` lives:
   - `src/lib/`
   - `src/serviceLines/`
   - `src/data/`
4. **Drop in the four new files** at their target paths.
5. **Replace `FinancialTool.jsx`** with the new version.
6. **Local verify:**
   ```
   npm install
   npm run dev
   ```
   Open `http://localhost:5173`, log in, confirm:
   - Existing data loads (migration worked)
   - New service line tab strip appears
   - `+ Add Service Line` opens the grouped picker
   - Adding TSC, then a coordinator, then a participant produces revenue in the header KPI strip
   - Save succeeds (`✓ Saved`)
7. **Production deploy** only after local is solid. Existing CI/CD picks up the new files automatically.

### Failure mode: import path mismatches

If the dev server shows "Failed to resolve import" errors, the relative paths in `FinancialTool.jsx` don't match where the four new files live. Confirm the existing file lives at `src/pages/FinancialTool.jsx`. If it lives elsewhere, the `../lib/`, `../serviceLines/`, `../data/` paths in the new file's imports need to be adjusted.

### Failure mode: migration produces wrong data

If the tool loads but numbers look wrong or homes are missing, the issue is in `migrateFlatV1()` in `companyShape.js`. The function is forgiving by design but may need a one-line tweak for a missing or differently-named field in real production saves.

---

## Key Working-Style Notes

- Architectural decisions verified via written diagrams before code commits
- Multi-step refactors split into reviewable foundation passes before integration
- esbuild parse verification before declaring code done
- Existing working components preserved verbatim during refactors; only changed scopes are rewritten
- Pushed back constructively when initial framing was incorrect (e.g., the brace-imbalance misdiagnosis)
- Multi-file outputs go to `/mnt/user-data/outputs/`

---

*Document generated at end of Track A integration session, prior to local deployment verification.*
