# Access Levels & Rights — Implementation Progress

**Branch:** `access-levels-and-rights`
**Spec:** `docs/access-levels-and-rights.md`
**Last updated:** 2026-05-20

---

## What's been built

### Foundation — `src/lib/access.js` ✅
Single source of truth for all role rules. Every component calls these helpers rather than checking roles directly.

| Export | Purpose |
|---|---|
| `ROLES` | Canonical role key constants (`OWNER`, `CEO`, `FINANCE`, etc.) |
| `ROLE_TIERS` | Maps each role to a tier number (1 = most privileged, 8 = least) |
| `ROLE_LABELS` | Display labels for UI |
| `canSeeCompanyDollars(role)` | `true` for tiers 1–3 only |
| `wageDisplayMode(role)` | `'dollars'` (1–6) \| `'percent'` (7) \| `'hidden'` (8) |
| `budgetRowVisibility(role, ownerTier)` | `'dollars'` \| `'percent'` \| `'hidden'` |
| `canSeeControl(role, controlId)` | Sidebar control gating per tier |
| `editMode(role)` | `'full'` (1–3) \| `'operational'` (4–6) \| `'readonly'` (7–8) |

---

### Auth & dev tooling — `src/App.jsx` + `src/supabase.js` ✅

- `getProfile()` added to `supabase.js` — fetches `is_super_admin` and future `role` column from `profiles`
- `App.jsx` fetches profile on sign-in and derives role:
  - `is_super_admin = true` → `OWNER`
  - profile `role` column (Track B) → that role
  - fallback → `CEO` (permissive until Track B lands)
- **Dev-only role dropdown** fixed to bottom-right corner — lets you switch through all 8 tiers instantly; stripped from production builds by Vite (`import.meta.env.DEV`)

---

### Budget Builder — `BudgetBuilderTab` ✅
- Old `BUDGET_ROLES` / `BUDGET_ROLE_ACCESS` constants removed
- Each category has an `ownerTier` mapping to the new 8-tier system
- `budgetRowVisibility(userRole, ownerTier)` determines display per row:
  - `'dollars'` → editable dollar input (tiers 1–3 always; own row for tiers 4–7; own row only for tier 8)
  - `'percent'` → read-only `% of net revenue` display
  - `'hidden'` → row not rendered
- "Total Company Budget" footer row only visible to tiers 1–3
- Local role selector card removed — role comes from app-level dropdown

**Budget Builder ownerTier assignments:**

| Category | ownerTier |
|---|---|
| Direct Care Labor (DSP Wages) | 1 |
| Contingency Reserve | 1 |
| Overtime Reserve | 4 |
| Administrative & Compliance | 4 |
| House Lead / Senior DSP Labor | 5 |
| Transportation / Vehicle Fleet | 5 |
| Technology & EVV | 5 |
| HR & Recruiting | 6 |
| Training & Development | 6 |
| Program Supplies | 8 |
| Community Activities & Recreation | 8 |

---

### Header KPI bar ✅
- Tiers 1–3: `EBITDA $X` and `NET INCOME $X` chips
- Tiers 4–8: swapped to `EBITDA MGN X%` and `NET MARGIN X%`

---

### Company P&L (`CompanyPL`) ✅
- Tiers 1–3: all row values render in dollars (`$k()`)
- Tiers 4–8: all numeric row values render as `% of net revenue`
  - e.g. Net Revenue = 100.0%, Direct Care Labor = −35.4%, EBITDA = 50.8%
- "Edit Overhead" button and panel hidden for tiers 4–8
- Applied to all four render sites: Whole Company P&L, Res Hab Daily P&L, Res Hab Hourly P&L, TSC P&L

---

### Company KPI tiles (`CompanyTab`) ✅
- Tiers 1–3: Net Revenue `$`, EBITDA `$`, Net Income `$` chips visible
- Tiers 4–8: Net Revenue and EBITDA dollar chips hidden; only `EBITDA MGN %` and `NET MARGIN %` shown

---

### Sidebar controls (`Sidebar`) ✅
- Variable Fees section (Management Fee slider, Billing Fee slider) — hidden for tiers 4–8
- Tax Structure section (entity type toggle, owner rate slider) — hidden for tiers 4–8
- Tiers 4–8 see only the Margin Guide in the sidebar

**`canSeeControl` thresholds:**

| Control | Max tier |
|---|---|
| `wage` | 6 |
| `graveyardWage` | 6 |
| `occupancy` | 7 |
| `entityType` | 3 |
| `ownerRate` | 3 |
| `resHabRates` | 5 |
| `mgmtFee` | 3 |
| `billingFee` | 3 |

---

## What still needs to be done

### Wage visibility in HomeMixEditor (Rule 2) ✅
- `userRole` prop threaded in at render site and component definition
- Staff Wage slider: shown only if `wageDisplayMode(userRole) === 'dollars'`
- Graveyard Wage slider: same rule
- Occupancy slider: wrapped with `canSeeControl(userRole, 'occupancy')` — hidden for tier 8
- Reimbursement Rates panel: wrapped with `canSeeControl(userRole, 'resHabRates')` — hidden for tiers 6–8
- Per-home `labor cost/day` figure: hidden for tier 8 via `wageDisplayMode(userRole) !== 'hidden'`

---

### Wage visibility in TSC coordinator tab (Rule 2) ✅
- `wageDisplayMode` imported in `tsc.jsx`
- `userRole` prop added to `TSCRosterTab` and threaded to `CoordinatorCard`
- Wage/hr input hidden entirely when `wageDisplayMode(userRole) === 'hidden'` (tier 8)
- Wage/hr input `readOnly` when `wageDisplayMode(userRole) !== 'dollars'` (tier 7)

---

### Res Hab rate overrides in HomeMixEditor (Rule 5) ✅
Implemented as part of HomeMixEditor work above — `canSeeControl(userRole, 'resHabRates')` applied.

---

### Save button — read-only enforcement (Rule 6 baseline) ✅
Save button hidden for `editMode(userRole) === 'readonly'` (tiers 7–8).
`editMode` added to imports in `FinancialTool.jsx`.

---

### Portfolio tab dollar masking ✅
`PortfolioComparison` now accepts `userRole` prop.
- Summary cards: Portfolio Revenue hidden for tiers 4–8; EBITDA and Net cards show % instead of $
- Table EBITDA column: `$k(co.ebitda)` → `pct(co.ebitdaMgn)` for tiers 4–8
- Table Net Income column: `$k(co.netInc)` → `pct(co.netMgn)` for tiers 4–8
- Table Revenue column: shows `—` for tiers 4–8
- Table Wage column: masked to `—` for tier 8

---

### 5-Year Projection dollar masking (Rule 1) ✅
The 5-year projection table is now inside `LaborEfficiencyTab` (the former `SingleHomeProjector` tab was merged into Labor Efficiency — see tab merge entry below).
- Tiers 1–3: all 5 columns rendered (Year, Annual Revenue, Annual Labor, Annual Gross, Gross Margin)
- Tiers 4–8: entire projection section hidden (`canSeeCompanyDollars` false; no partial column view)
- Uses `canSeeCompanyDollars(userRole)` — no new access.js functions needed.

---

### Budget Builder header cards — Net Revenue & Revenue/Participant (Rule 1) ✅
The three context cards at the top of `BudgetBuilderTab` are now role-gated.
- Tiers 1–3: all three cards visible (Total Participants, Net Revenue, Revenue / Participant)
- Tiers 4–8: only "Total Participants" card shown; Net Revenue and Revenue / Participant are hidden.
- Grid column count adjusts dynamically (3 columns for tiers 1–3, 1 column for tiers 4–8).
- Uses the existing `showCompanyTotal` boolean (already computed at the top of the tab from `canSeeCompanyDollars(userRole)`).

---

### Portfolio tab visibility (Rule 1) ✅
The Portfolio tab is now restricted entirely to tiers 1–3; it does not appear in the nav strip for tiers 4–8.
- `subTabs` computation filters out `{ id: "portfolio" }` when `canSeeCompanyDollars(userRole)` is false.
- Render site also guards with `canSeeCompanyDollars(userRole)` to prevent rendering if `subTab` state is stale.
- Note: cross-company data was the only use of the Portfolio tab; all other WHOLE_COMPANY tabs (Company P&L, Budget Builder, FAQ) remain accessible to tiers 4–8 with appropriate dollar masking already in place.

---

### Top-level KPI chips hidden for tiers 5–8 (Rule 7) ✅
- `canSeeTopNumbers(role)` added to `access.js` — returns true for tiers 1–4.
- The entire header KPI bar (24hr Clients, Hourly Clients, TSC Caseload, EBITDA, Net Income/Margin chips) is now wrapped with `canSeeTopNumbers(userRole)`.
- Tiers 5–8 see no header numbers at all.
- Tiers 1–3 see dollar values; tier 4 (Regional Director) sees percentage values — existing behavior unchanged for those tiers.

---

### Company P&L tab hidden for tiers 4–8 ✅
- The `company` tab id added to the `GATED_TABS` set filtered from `subTabs` for tiers 4–8.
- Render guard `canSeeCompanyDollars(userRole)` added to the Company P&L render site.
- Tiers 4–8 no longer see the Company P&L tab in the navigation or its content.

---

### Service line P&L tabs hidden for tiers 4–8 ✅
All three service line P&L tabs (`reshab_pl`, `hourly_pl`, `tsc_pl`) now follow the same pattern as the Portfolio tab:
- Added to `GATED_TABS` set — filtered from `subTabs` for tiers 4–8.
- Render guards (`canSeeCompanyDollars(userRole)`) added to each P&L render site.

---

### Add Service Line button hidden for tiers 5–8 ✅
- `canAddServiceLine(role)` added to `access.js` — returns true for tiers 1–4.
- The `+ Add Service Line` button is wrapped with `canAddServiceLine(userRole)`.
- Tiers 5–8 cannot add new service lines.

---

### Home Mix Editor read-only for tiers 5–8 (Rule 8) ✅
- `canEditServiceLines(role)` added to `access.js` — returns true for tiers 1–4.
- `canEdit={canEditServiceLines(userRole)}` passed to `HomeMixEditor` at the render site.
- When `!canEdit`:
  - `+ Add` home button hidden
  - `Remove` home button hidden
  - Home name input becomes `readOnly`
  - Client Mix steppers wrapped with `pointerEvents: none` + `opacity: 0.65`
  - Night Group Hours slider + quick-picks: non-interactive (pointer-events off)
  - Home Settings sliders (wage, graveyard wage, occupancy): non-interactive
  - Intense Billing toggle: non-interactive
  - High Support 1:1 slider: non-interactive
  - Graveyard sleeping slider: non-interactive
  - Reimbursement Rates inputs/buttons: non-interactive

---

### Role-aware default sub-tab ✅
- `useEffect` in `App()` updated to pick the first sub-tab accessible to the current role.
- When role changes (dev switcher) or service line changes, the active sub-tab resets to the first visible tab rather than potentially landing on a gated one.

---

### Save button restricted to tiers 1–4 ✅
- Previously hidden only for `editMode === 'readonly'` (tiers 7–8).
- Updated gate to `canEditServiceLines(userRole)` — Save button now hidden for tiers 5–8.
- Tiers 5–8 have no editable fields and no save capability.

---

### Budget Builder header cards restricted to tiers 1–3 ✅
- Previously the Total Participants card was always visible; only Net Revenue and Revenue/Participant were gated.
- All three header cards (Total Participants, Net Revenue, Revenue / Participant) are now wrapped with `showCompanyTotal` (`canSeeCompanyDollars(userRole)`).
- Tiers 4–8 see no header cards in the Budget Builder at all.
- Grid column count simplified to always 3 columns when shown (the dynamic 3/1 column logic removed).

---

### FAQ tab role-aware filtering ✅
`FAQ_DATA` items now carry `minTier` and `maxTier` gates. `FAQTab` accepts `userRole`, computes the user's tier, filters items, and hides sections that have no visible items.

**Per-item tier gates:**

| Item | Max tier |
|---|---|
| Intense vs High Support rates | 7 |
| Normal Intense vs Blended billing | 4 |
| Group hours affect revenue and labor | 6 |
| Hourly Supported Living rates | 5 |
| High Support staffing ratio | 8 (all) |
| Labor calculation for group hours | 7 |
| Payroll burden 22% | 6 |
| What is EBITDA | 4 |
| EBITDA margin target | 4 |
| Management and billing fees | 3 |
| Why values shown as percentages | min 4, max 7 |
| Home Mix Editor vs Labor Efficiency | 4 |
| Rate reduction scenario | 5 |
| How Budget Builder works | 8 (all) |
| What does the Margin Guide mean | 8 (all) |

**AI assistant system prompt** is now role-aware via `getAISystemPrompt(userRole)`:
- Tiers 1–3: full financial context, dollar amounts, rates
- Tier 4: operational + margin % framing, no raw company dollar totals
- Tiers 5–6: staffing and labor efficiency focus
- Tier 7: scheduling, shift coverage, group hours efficiency
- Tier 8: daily operations, client mix, occupancy

**Stale FAQ text fixed:** The Budget Builder FAQ previously referenced a "Viewing As role selector" that no longer exists. Updated to accurately describe the current tier-based row visibility.

---

### Home Projector merged into Labor Efficiency tab ✅
`SingleHomeProjector` (the standalone "Home Projector" tab) has been removed. Its projection functionality now lives inside `LaborEfficiencyTab`, with dollar amounts gated to tier 1–3 and ratios/percentages always visible.

**What changed in `FinancialTool.jsx`:**
- `LaborEfficiencyTab` expanded with dollar metric tiles (Daily Revenue, Daily Gross, Gross Margin, $/Labor Hr, Annual Revenue/Gross/Labor, Labor Hrs/Day) — shown only when `canSeeCompanyDollars(userRole)`
- Staffing hours breakdown now appends `· $cost` per shift row — shown only when `canSeeCompanyDollars(userRole)`
- 5-year projection table added — gated to `canSeeCompanyDollars(userRole)`
- `SingleHomeProjector` function deleted (~220 lines)
- `SUB_TABS.RES_HAB_DAILY` reduced from 4 tabs to 3 (projector entry removed)
- `subTab === "projector"` render branch removed
- FAQ entry updated: "Home Mix Editor vs Home Projector" → "Home Mix Editor vs Labor Efficiency"

**Access behavior:**
- Tiers 1–3: see dollar tiles, staffing costs, and 5-year projection inside Labor Efficiency
- Tiers 4–8: see ratios/percentages and hours only; no dollar content; no projection table

---

### Server-side enforcement (Track B) 🔲
All current access control is **client-side only** — it gives UX correctness but not security. Per the spec, the data layer must be role-aware too.

Required Track B work:
- Add `role` column to `profiles` table (migration)
- Update `loadConfig()` in `supabase.js` to strip or replace dollar fields server-side for lower tiers
- Role assignment UI in `AdminPanel.jsx` (Owner/CEO assigns roles per company)
- RLS policies enforcing the per-company role from `licensee_companies`

---

### Multi-role / per-company role (open design question) 🔲
The spec notes a user could hold different roles at different companies (e.g. Finance on Company A, no access to Company B). This requires `role` to live on `licensee_companies` rather than `profiles`. Currently the schema has a single `role` field on the profile. Design to be confirmed before Track B schema migration.

---

### Tier 8 simplified screen (open design question) 🔲
The spec flags that a full tool with most content masked may not be the right UX for House Leads — a dedicated simplified screen was discussed. Deferred to a design session.

---

## Implementation notes for remaining work

When adding `userRole` to `HomeMixEditor`:
- The component is rendered at line ~2982 in `FinancialTool.jsx`
- Props currently: `homes`, `onUpdate`, `onAdd`, `onRemove`, `wage`, `setWage`, `rates`, `setRates`, `graveyardWage`, `setGraveyardWage`
- Add `userRole` and apply `wageDisplayMode(userRole)` to the wage/graveyard wage sliders
- Apply `canSeeControl(userRole, 'occupancy')` to the occupancy slider
- Apply `canSeeControl(userRole, 'resHabRates')` to the rate override inputs

When adding `userRole` to TSC tabs:
- `TSCRosterTab` is in `src/serviceLines/tsc.jsx`
- Pass `userRole` from the render site at line ~3034 through to `TSCRosterTab`

When implementing `editMode`:
- The Save button in the header (line ~2842) should be hidden for tiers 7–8 (`editMode(userRole) === 'readonly'`)
- Number inputs throughout should receive `readOnly={editMode(userRole) === 'readonly'}` for financial fields
