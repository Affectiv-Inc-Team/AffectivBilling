# Branch Summary: `feat/tsc-separate-coordinator-participant-tabs`

**Date:** 2026-05-27  
**Files changed:** `src/serviceLines/tsc.jsx`, `src/pages/FinancialTool.jsx`

---

## Overview

This branch makes three sets of changes to the TSC (Targeted Service Coordination) service line:

1. Splits the single "Roster & Caseload" tab into separate **Coordinators** and **Participants** tabs
2. Restores full participant management (add/edit/remove) within the Coordinators tab
3. Corrects G9007 and H2011 modeling to match the Idaho rate spec

---

## Change 1 — Split Roster into Coordinators + Participants Tabs

**Commit:** `09baf55`

### What changed

**`src/serviceLines/tsc.jsx`** — two new exported components added:

- **`TSCCoordinatorsTab`** — replaces the old `TSCRosterTab` as the first tab. Shows all coordinator cards with their financial stats (caseload, annual rev, labor, gross, margin, utilization, billable share). Coordinator CRUD (add, edit, remove) lives here.

- **`TSCParticipantsTab`** — new flat cross-coordinator participant list. Each row shows the participant name, an assigned coordinator dropdown (allows reassignment between coordinators), G9002 monthly units, G9007 annual units, parapro toggle, and monthly revenue. Includes a `reassignParticipant` mutation that atomically moves a participant from one coordinator to another while preserving all their data.

- **`ParticipantFlatRow`** — new helper component used by `TSCParticipantsTab` for each participant row, including the coordinator dropdown.

- **`CoordinatorCard`** — updated to accept a `hideParticipants` prop (default `false`, backward-compatible) that suppresses the expand toggle and participant section when `true`.

**`src/pages/FinancialTool.jsx`**:

- Import updated to include `TSCCoordinatorsTab` and `TSCParticipantsTab`
- `SUB_TABS.TSC` updated — `tsc_roster` replaced with `tsc_coordinators` + `tsc_participants`:

```js
TSC: [
  { id: "tsc_coordinators", label: "👤 Coordinators" },
  { id: "tsc_participants", label: "👥 Participants" },
  { id: "tsc_productivity", label: "📈 Productivity" },
  { id: "tsc_pl",           label: "💵 P&L" },
  { id: "tsc_staffing",     label: "🏢 Staffing" },
  { id: "tsc_scenario",     label: "🔬 Scenario" },
],
```

- Render switch updated with two new cases for `tsc_coordinators` and `tsc_participants`
- `TSCRosterTab` kept exported in `tsc.jsx` for safety but removed from routing

### Data model

No change — participants remain embedded in `coordinator.participants[]`. The Participants tab flattens them in the UI layer only. No migration needed.

---

## Change 2 — Restore Participant Editing in Coordinators Tab

**Commit:** `6449490`

After the initial split, the Coordinators tab showed coordinator cards without participant rows. This change restores the full nested participant list within each coordinator card on the Coordinators tab.

**`src/serviceLines/tsc.jsx`** — `TSCCoordinatorsTab`:

- `addParticipant`, `updateParticipant`, and `removeParticipant` mutations added (same immutable-update pattern as the original `TSCRosterTab`)
- `CoordinatorCard` rendered without `hideParticipants`, so the expandable participant section is fully visible with add/edit/remove per participant

**Result:** Both tabs now offer participant management — the Coordinators tab shows participants nested within their coordinator (original UX), and the Participants tab shows a flat cross-coordinator list with coordinator reassignment.

---

## Change 3 — G9007 Annual Units + H2011 Hidden from Main View

**Commit:** `45c5594`

Two spec-compliance fixes per `docs/service-rate-spec.md` critical implementation notes.

### G9007 — annual, not monthly

**Spec:** *"G9007 must be displayed and modeled as units a year, not units a month, with an assumed ceiling of 48 units annually for plan development."*

**`calcTSCParticipant`:**
```js
// Before — treated as monthly (overstated revenue 12×):
monthlyRev += (p.unitsPlanDev ?? 0) * ratePlan;
monthlyHours += (p.unitsPlanDev ?? 0) / 4;

// After — annual units prorated monthly:
monthlyRev += (p.unitsPlanDev ?? 0) / 12 * ratePlan;
monthlyHours += (p.unitsPlanDev ?? 0) / 12 / 4;
```

**UI:** All G9007 inputs now labeled `G9007 u/yr`, `max` capped at `48`.

### H2011 — removed from main roster view

**Spec:** *"H2011 should not appear on the main roster/caseload view; treat it as a secondary, rarely used code that is available in detailed views and configuration only."*

- H2011 input column removed from `ParticipantRow` (Coordinators tab nested view)
- H2011 input column removed from `ParticipantFlatRow` (Participants tab)
- H2011 header column removed from both grid headers
- `H2011 units/mo` stat removed from the Participants tab summary bar
- Grid template column counts reduced accordingly in all affected components

**Note:** `unitsCrisis` remains in the participant data model and still flows through `calcTSCParticipant`. Existing saved data with H2011 units is preserved and still calculates correctly — it is just not exposed in the main UI.

---

## Verification

All changes verified with:
1. `npx esbuild src/serviceLines/tsc.jsx --bundle=false --loader:.jsx=jsx` — no errors
2. `npx esbuild src/pages/FinancialTool.jsx --bundle=false --loader:.jsx=jsx` — no errors
3. Live browser check via dev server — both new tabs render correctly, participant rows show updated column layout with `G9007 u/yr` and no H2011 field
