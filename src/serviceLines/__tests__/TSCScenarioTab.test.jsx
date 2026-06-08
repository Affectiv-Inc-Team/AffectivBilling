import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  TSCScenarioTab,
  defaultTSCConfig,
  mkCoordinator,
  mkParticipant,
} from "../tsc.jsx";
import { ROLES } from "../../lib/access.js";

// Regression coverage for the same undeclared-variable crash class PR #24 fixed
// for TSCCoordinatorsTab/TSCParticipantsTab — but this instance was missed.
// TSCScenarioTab referenced `base`/`scenario`/`delta` (from calcTSCScenario),
// `bev` (calcTSCBreakEven), the reimbursement-rate panel state (`rates`,
// `setRate`, `ratesOpen`, `canEditRates`, `G9007_CAP`, `maxPlanDev`,
// `nApproaching`, `$rate`), `caseloadCountVal`, and `canSeeControl` (never
// imported) — none of which were declared. The component threw a ReferenceError
// the moment it rendered, blanking the entire app for any editor who opened the
// 🔬 Scenario sub-tab.
function withCoordinator() {
  return {
    ...defaultTSCConfig(),
    coordinators: [
      {
        ...mkCoordinator("Alice", 22),
        id: "c1",
        // unitsPlanDev 42 exercises the G9007 cap progress + ">= 40 near cap"
        // branch (maxPlanDev / nApproaching).
        participants: [{ ...mkParticipant("P1", 16), unitsPlanDev: 42 }],
      },
    ],
  };
}

describe("TSCScenarioTab", () => {
  it("renders the full scenario tab (rates panel + dollars) without crashing", () => {
    // OWNER (tier 1): canEditServiceLines + canSeeCompanyDollars + canSeeControl
    // all true — exercises every previously-undeclared path at once.
    render(
      <TSCScenarioTab config={withCoordinator()} onUpdate={vi.fn()} userRole={ROLES.OWNER} />
    );
    // Scenario comparison table (proves base/scenario/delta were declared).
    expect(screen.getByText("Scenario modeling")).toBeDefined();
    expect(screen.getByText("Annual Revenue")).toBeDefined();
    // Break-even section (proves `bev` was declared).
    expect(screen.getByText("Break-even analysis")).toBeDefined();
    // Reimbursement-rates panel (proves rates/setRate/ratesOpen/canSeeControl).
    expect(screen.getByText("Reimbursement Rates")).toBeDefined();
  });

  it("renders for an editor without company-dollar visibility (pct-only)", () => {
    // REGIONAL_DIRECTOR (tier 4): can edit + see the rates control, but
    // canSeeCompanyDollars is false — exercises the dollars-hidden branch while
    // base/scenario/delta are still computed for the (hidden) dollar rows.
    render(
      <TSCScenarioTab
        config={withCoordinator()}
        onUpdate={vi.fn()}
        userRole={ROLES.REGIONAL_DIRECTOR}
      />
    );
    expect(screen.getByText("Scenario modeling")).toBeDefined();
    expect(screen.getByText("Reimbursement Rates")).toBeDefined();
    // Dollar rows are suppressed for tiers below Finance.
    expect(screen.queryByText("Annual Revenue")).toBeNull();
  });
});
