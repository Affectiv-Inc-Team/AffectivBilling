# Access Levels & Rights — Implementation Progress

**Branch:** `access-levels-and-rights`
**Spec:** `docs/access-levels-and-rights.md`
**Last updated:** 2026-05-18

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
