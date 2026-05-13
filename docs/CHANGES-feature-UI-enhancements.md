# Branch: `feature/UI-enhancements`

Summary of all changes made on this branch.

---

## 1. Chrome-Style Draggable / Reorderable Tabs

**Commit:** `b09c7c7`

Both the service line tab strip and the sub-tab strip now support drag-to-reorder, matching the interaction model of browser tabs.

**Behavior:**
- Tap a tab to select it immediately (activates on `pointerdown`, like Chrome)
- Drag a tab horizontally to reorder it — a gold gap indicator shows the drop position
- 5 px threshold distinguishes a tap from a drag
- Ghost effect (45% opacity) on the tab being dragged
- Drag state uses `useRef` + direct DOM `style` mutation for per-frame smoothness (no React re-renders mid-drag)
- Touch and mouse both supported via the Pointer Events API (`setPointerCapture`)
- Tab order is persisted to the v2 config blob (`sl.subTabOrder` for service line sub-tabs, `company.shared.wholeCompanySubTabOrder` for the Whole Company strip)

**New components / helpers:**
- `GapIndicator` — animated-width flex spacer with a 2 px gold bar, shows the insertion point
- `applyTabOrder(defaults, savedOrder)` — resequences a sub-tab array from a saved ID list, filters stale IDs

**New fields in `companyShape.js`:**
- `subTabOrder: null` on `createServiceLine()` — null = use default `SUB_TABS` order
- `wholeCompanySubTabOrder: null` on `createSharedConfig()` — null = use default Whole Company order

---

## 2. Tab Selection & Cursor Fixes

**Commits:** `b525abf`, `4b0dbed`

- **Tab selection broken after drag implementation** — fixed by calling `setActiveKey` / `setSubTab` immediately in `onPointerDown` rather than waiting for `onPointerUp`
- **✕ remove button broken** — the inner `<button>` had `pointerEvents:"none"` which the ✕ span inherited; fixed by adding `pointerEvents:"auto"` to the ✕ span with `onPointerDown={e => e.stopPropagation()}` to prevent drag from starting
- **Cursor** — changed from `grab`/`grabbing` to `pointer` on all tab wrappers

---

## 3. Annual P&L Sub-Tab per Service Line

**Commit:** `246a3e3`

Each active service line now has its own **💵 P&L** sub-tab showing that service line's isolated financials.

**New sub-tabs:**
- `reshab_pl` — Res Hab Daily P&L
- `hourly_pl` — Res Hab Hourly P&L
- TSC already had `tsc_pl` — unchanged

**New helper `calcSLCo()`:**
A pure function that takes a service line's raw annual revenue and labor numbers and returns a `co`-shaped object suitable for passing directly to the existing `CompanyPL` component. Company-level management salaries and overhead are allocated proportionally by revenue share (`slRevGross / co.annualRevGross`).

---

## 4. Budget Builder Light Theme

**Commit:** `246a3e3`

The Budget Builder tab was re-skinned from dark navy to match the rest of the app's light `#f5f7fa` system.

| Old (dark) | New (light) | Used on |
|---|---|---|
| `#141d2c` | `#f0f4fa` | Card backgrounds, panel backgrounds |
| `#0e1625` | `#e8eef6` | Inactive role button bg, alternating rows |
| `#1e2d3d` | `#c8d4e4` | Table header border |
| `#1a2840` | `#e2e8f0` | Row dividers |
| `#080e18` | `#ebebeb` | Input field backgrounds |
| `#0a1f0a` | `#f0fff4` | CEO total row background |
| `#22d37f` | `#15803d` | CEO total row text (darker for legibility) |

---

## 5. Wage / Rate Settings Moved into Home Mix Editor

**Commits:** `246a3e3`, `844fb18`, current

Staff Wage, Graveyard Wage, Occupancy Rate, and Reimbursement Rates were removed from the global Sidebar entirely and moved into the **Home Mix Editor** tab under Res Hab Daily.

**Sidebar — removed:**
- Global Settings section (wage, graveyard wage, occupancy sliders)
- Reimbursement Rates section (rate fields + expand/collapse)
- Wage Sensitivity section

**Sidebar — kept:**
- Variable Fees (management fee %, billing fee %)
- Tax Structure (entity type, owner tax rate)
- Margin Guide

**New location:** A collapsible **Home Settings** panel inside each home's editor in `HomeMixEditor`, positioned above the Intense Billing section. The panel contains:
- Staff Wage slider
- Graveyard / Sleeping Wage slider
- Occupancy Rate slider
- Reimbursement Rates (expand/collapse, with −2% / −4% / −6% and Reset buttons per rate)

Settings still write to `company.shared` so changes apply across all homes and the whole-company P&L simultaneously.

`RATE_FIELDS` constant hoisted to module scope so it is available to both the old Sidebar location and the new Home Mix Editor panel.

---

## 6. Home Types Moved to Res Hab Daily Service Line

**Commit:** `833a633`

The Home Types editor (template-based aggregation model with `numHomes` multiplier) was moved out of the **Whole Company → Company P&L** tab and into a dedicated **🏘 Home Types** sub-tab under Res Hab Daily.

**Why two home models exist:**
- `homes` (Home Types) — template model; each entry has `numHomes` to represent multiple identical homes. Used for top-down portfolio modeling.
- `indHomes` (Individual Homes) — 1:1 model used by Home Mix Editor. Each entry is a specific named home.

Both are stored separately in `dailySL.config` and are independent datasets.

**`CompanyTab` (Whole Company → Company P&L)** stripped down to:
- Summary chips (Clients, Homes, Net Revenue, EBITDA, Net Margin, Net Income)
- Full `CompanyPL` breakdown (management salaries, overhead, fees, tax waterfall)

No home type editing is mixed into the financial view anymore.

---

## 7. Horizontal Scrolling Tab Strips

**Current commit**

Both the service line tab strip and the sub-tab strip now scroll horizontally when tabs overflow the viewport, rather than expanding the window or overlapping.

**Fix:** Used the double-wrapper pattern required for reliable flex scroll:
```
outer div  →  flex:1, minWidth:0, overflow:hidden   (provides hard width boundary)
inner div  →  display:flex, overflowX:auto           (does the actual scrolling)
```

`AddServiceLineButton` moved outside the `overflow:hidden` wrapper so its `position:absolute` dropdown is not clipped. `scrollbarWidth:none` hides the scrollbar visually while preserving trackpad/mouse-wheel scrolling. `flexShrink:0` added to all tab wrapper elements so tabs hold their size instead of compressing.
