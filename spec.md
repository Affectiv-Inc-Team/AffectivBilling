# Spec: "Concerning" Labor Efficiency Rating Category

**Branch:** `feature/concerning-rating-category`  
**Status:** Awaiting approval  

---

## 1. Current State

The labor efficiency rating system in `src/pages/FinancialTool.jsx` categorizes a home's
labor-to-revenue ratio into three tiers, plus an unconfigured state:

| Status | Threshold | Label | Color | Icon |
|---|---|---|---|---|
| `incomplete` | `total === 0` | Configure Home | `#64748b` | ○ |
| `approved` | ratio < 47% | Approved | `#00e5aa` (green) | ✓ |
| `marginal` | 47% ≤ ratio < 70% | Needs Review | `#f59e0b` (amber) | ⚠ |
| `rejected` | ratio ≥ 70% | Not Viable | `#f87171` (red) | ✗ |

These thresholds are defined in two places:

**Threshold constant** (`FinancialTool.jsx:454`):
```js
const LABOR_APPROVAL_THRESHOLDS = { approved: 0.47, marginal: 0.70 };
```

**Category function** (`FinancialTool.jsx:456–461`):
```js
function getLaborApprovalStatus(laborRatio, total) {
  if (!total || total === 0) return { status:"incomplete", ... };
  if (laborRatio < LABOR_APPROVAL_THRESHOLDS.approved) return { status:"approved", ... };
  if (laborRatio < LABOR_APPROVAL_THRESHOLDS.marginal) return { status:"marginal", label:"Needs Review", ... };
  return { status:"rejected", label:"Not Viable", ... };
}
```

**Color function** (`FinancialTool.jsx:552`) — already distinguishes 58% internally but does
not surface it as a separate label:
```js
const lrc = r => r < 0.47 ? "#00e5aa" : r < 0.58 ? "#f59e0b" : r < 0.70 ? "#fb923c" : "#f87171";
```

The `approval` object returned by `getLaborApprovalStatus` propagates through the entire
Labor Efficiency tab: the header badge, the guidance footer text, and the wage-sensitivity
table's status column all branch on `approval.status`.

---

## 2. Proposed Change

Insert a new `"concerning"` category (58–67%) inside the existing "Needs Review" band.
All other thresholds and labels stay exactly as-is; only the top of "Needs Review" and the
bottom of "Not Viable" shift to accommodate the new tier.

### New threshold table

| Status | Threshold | Label | Color | Icon |
|---|---|---|---|---|
| `incomplete` | `total === 0` | Configure Home | `#64748b` (slate) | ○ |
| `approved` | ratio < 47% | Approved | `#00e5aa` (green) | ✓ |
| `marginal` | 47% ≤ ratio < 58% | Needs Review | `#f59e0b` (amber) | ⚠ |
| `concerning` | 58% ≤ ratio < 68% | Concerning | `#fb923c` (orange) | ⚠ |
| `rejected` | ratio ≥ 68% | Not Viable | `#f87171` (red) | ✗ |

**What changes vs. current:**
- `approved < 0.47`: **unchanged**.
- `marginal 0.47–0.57`: "Needs Review" top boundary shifts from 70% → 58%.
- `concerning 0.58–0.67`: **new tier**. Promotes the orange band that `lrc()` already
  painted (58–70%) into a named, labeled category.
- `rejected ≥ 0.68`: "Not Viable" bottom shifts from 70% → 68%.

**Color rationale:** The orange `#fb923c` is already emitted by `lrc()` for 58–70%;
promoting it to a first-class category label requires zero new color tokens.

---

## 3. Files to Change

All changes are confined to a single file: **`src/pages/FinancialTool.jsx`**.

### 3a. `LABOR_APPROVAL_THRESHOLDS` constant — line 454

**Before:**
```js
const LABOR_APPROVAL_THRESHOLDS = { approved: 0.47, marginal: 0.70 };
```

**After:**
```js
const LABOR_APPROVAL_THRESHOLDS = { approved: 0.47, marginal: 0.58, concerning: 0.68 };
```

`approved` is unchanged at 0.47. `marginal` now marks the top of "Needs Review" (0.58),
and a new key `concerning` marks the top of "Concerning" (0.68).

---

### 3b. `getLaborApprovalStatus()` function — lines 456–461

**Before:**
```js
function getLaborApprovalStatus(laborRatio, total) {
  if (!total || total === 0) return { status:"incomplete", label:"Configure Home", color:"#64748b", bg:"#eef1f6", border:"#c8d8ec", icon:"○" };
  if (laborRatio < LABOR_APPROVAL_THRESHOLDS.approved) return { status:"approved",  label:"Approved",     color:"#00e5aa", bg:"#00e5aa12", border:"#00e5aa35", icon:"✓" };
  if (laborRatio < LABOR_APPROVAL_THRESHOLDS.marginal) return { status:"marginal",  label:"Needs Review", color:"#f59e0b", bg:"#f59e0b12", border:"#f59e0b35", icon:"⚠" };
  return                                                      { status:"rejected",  label:"Not Viable",   color:"#f87171", bg:"#f8717112", border:"#f8717135", icon:"✗" };
}
```

**After:**
```js
function getLaborApprovalStatus(laborRatio, total) {
  if (!total || total === 0)                             return { status:"incomplete",  label:"Configure Home", color:"#64748b", bg:"#eef1f6",   border:"#c8d8ec",   icon:"○" };
  if (laborRatio < LABOR_APPROVAL_THRESHOLDS.approved)  return { status:"approved",    label:"Approved",       color:"#00e5aa", bg:"#00e5aa12", border:"#00e5aa35", icon:"✓" };
  if (laborRatio < LABOR_APPROVAL_THRESHOLDS.marginal)  return { status:"marginal",    label:"Needs Review",   color:"#f59e0b", bg:"#f59e0b12", border:"#f59e0b35", icon:"⚠" };
  if (laborRatio < LABOR_APPROVAL_THRESHOLDS.concerning) return { status:"concerning", label:"Concerning",     color:"#fb923c", bg:"#fb923c12", border:"#fb923c35", icon:"⚠" };
  return                                                        { status:"rejected",   label:"Not Viable",     color:"#f87171", bg:"#f8717112", border:"#f8717135", icon:"✗" };
}
```

---

### 3c. `lrc()` color function — line 552

**Before:**
```js
const lrc = r => r < 0.47 ? "#00e5aa" : r < 0.58 ? "#f59e0b" : r < 0.70 ? "#fb923c" : "#f87171";
```

**After:**
```js
const lrc = r => r < 0.47 ? "#00e5aa" : r < 0.58 ? "#f59e0b" : r < 0.68 ? "#fb923c" : "#f87171";
```

The 47% and 58% breakpoints are unchanged. Only the 70% endpoint shifts to 68% to align
with the new "Not Viable" threshold.

---

### 3d. Guidance footer — lines 860–883

Add a `"concerning"` message block alongside the existing `"marginal"` and `"rejected"` blocks.

**Current message structure (lines 869–879):**
```jsx
{approval.status === "approved"  && canGroup  && `...`}
{approval.status === "approved"  && allHigh   && `...`}
{approval.status === "approved"  && ...       && "..."}
{approval.status === "marginal"  && ...       && "..."}
{approval.status === "marginal"  && ...       && "..."}
{approval.status === "marginal"  && ...       && "..."}
{approval.status === "marginal"  && ...       && "..."}
{approval.status === "rejected"  && ...       && "..."}
{approval.status === "rejected"  && ...       && "..."}
{approval.status === "rejected"  && ...       && "..."}
{approval.status === "incomplete" && "..."}
```

**After — insert these three lines after the last `"marginal"` block (before `"rejected"`):**
```jsx
{approval.status === "concerning" && nIntense > 0 && "Intense clients drive a high labor ratio. Adding a second intense client with extended group hours may bring this below Concerning."}
{approval.status === "concerning" && canGroup && groupHrs < 10 && "Labor ratio is elevated. Increasing group hours to 10–14 may move this home into Needs Review."}
{approval.status === "concerning" && (!canGroup || groupHrs >= 10) && "This configuration's labor ratio is high. Review client mix and staffing hours before committing to this home."}
```

These messages follow the same pattern as the existing `"marginal"` messages: actionable,
specific, and context-aware. Exactly one will render per home (JSX short-circuit evaluation).

---

## 4. Edge Cases and Boundary Conditions

| Boundary | Behavior |
|---|---|
| `laborRatio === 0.47` | `< 0.47` fails → `"marginal"`. Correct — 47% is the bottom of Needs Review (unchanged). |
| `laborRatio === 0.58` | `< 0.58` fails → `"concerning"`. Correct — 58% is the bottom of Concerning. |
| `laborRatio === 0.68` | `< 0.68` fails → `"rejected"`. Correct — 68% is the bottom of Not Viable. |
| `laborRatio === 0.0` | Falls through to `"approved"`. Correct. |
| `total === 0` | Returns `"incomplete"` before any ratio check. Unchanged. |

The `lrc()` function uses identical breakpoints (`< 0.47`, `< 0.58`, `< 0.68`), so the color
shown in bar charts and the wage sensitivity table will always match the label shown in the
badge and footer.

---

## 5. Display Sites Affected

| Location in tab | How it uses the rating | Change required |
|---|---|---|
| Header approval badge (line 563–571) | `approval.bg`, `approval.border`, `approval.color`, `approval.icon`, `approval.label` | Automatic — badge inherits from `getLaborApprovalStatus` |
| Group-hours sweep chart (lines 760–786) | `lrc(s.laborRatio)` for bar fill color | Threshold numbers updated in `lrc()` |
| Wage sensitivity table — color column (line ~847) | `lrc(row.laborRatio)` | Threshold numbers updated in `lrc()` |
| Wage sensitivity table — status badge (line ~849) | `getLaborApprovalStatus(row.laborRatio, total)` | Automatic — inherits new category |
| Guidance footer (lines 860–883) | `approval.status` string | Three new message lines added |

---

## 6. Out of Scope

- `getApprovalStatus()` (gross margin) and `APPROVAL_THRESHOLDS` are **not touched**. This
  change is labor-efficiency-only.
- TSC (`src/serviceLines/tsc.jsx`) does not use `getLaborApprovalStatus`. No changes there.
- No database schema or Supabase changes needed — thresholds are UI-only.
- No new color tokens introduced — `#fb923c` already exists in the codebase.

---

## 7. Acceptance Criteria

1. A home with a 45% labor ratio shows **"Approved"** (green) — unchanged from current behavior.
2. A home with a 50% labor ratio shows **"Needs Review"** (amber) — unchanged from current behavior.
3. A home with a 60% labor ratio shows **"Concerning"** (orange) — badge, footer, and table column.
4. A home with a 69% labor ratio shows **"Not Viable"** (red) — previously would have shown "Needs Review".
5. The guidance footer renders a contextually appropriate message (not blank) for every
   `"concerning"` home.
6. Bar chart and wage-sensitivity table bar colors align with the badge color for the same
   labor ratio.
7. `npx esbuild src/pages/FinancialTool.jsx --bundle=false --loader:.jsx=jsx` exits with no
   errors.
8. Manual browser test: navigate to a Res Hab home, adjust client mix until each rating
   category is reached and visually confirmed.
