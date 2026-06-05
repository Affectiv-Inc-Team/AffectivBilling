import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  TSCCoordinatorsTab,
  TSCParticipantsTab,
  defaultTSCConfig,
  mkCoordinator,
  mkParticipant,
} from "../tsc.jsx";
import { ROLES } from "../../lib/access.js";

// Regression coverage for a crash the Phase 4 E2E suite surfaced: both tabs
// rendered a CoordinatorCard/ParticipantFlatRow with `rates={rates}` but never
// declared `rates`, so the app threw a ReferenceError the moment a coordinator
// existed. The empty-state path didn't render those rows, so it slipped by. The
// earlier TSCRosterTab tests passed because that tab DOES declare `rates`.
function makeConfig(overrides = {}) {
  return { ...defaultTSCConfig(), ...overrides };
}

function withCoordinator() {
  return makeConfig({
    coordinators: [
      { ...mkCoordinator("Alice", 22), id: "c1", participants: [mkParticipant("P1", 16)] },
    ],
  });
}

describe("TSCCoordinatorsTab", () => {
  it("renders a coordinator card with participants without crashing", () => {
    render(
      <TSCCoordinatorsTab config={withCoordinator()} onUpdate={vi.fn()} userRole={ROLES.OWNER} />
    );
    // Coordinator name input present (proves the card rendered, no ReferenceError).
    expect(screen.getByDisplayValue("Alice")).toBeDefined();
    // 16 G9002 units × $20.97 → $336/mo via the rates-driven calc.
    expect(screen.getByText("$336/mo")).toBeDefined();
  });
});

describe("TSCParticipantsTab", () => {
  it("renders the flat participant list without crashing", () => {
    render(
      <TSCParticipantsTab config={withCoordinator()} onUpdate={vi.fn()} userRole={ROLES.OWNER} />
    );
    expect(screen.getByDisplayValue("P1")).toBeDefined();
    expect(screen.getByText("$336/mo")).toBeDefined();
  });
});
