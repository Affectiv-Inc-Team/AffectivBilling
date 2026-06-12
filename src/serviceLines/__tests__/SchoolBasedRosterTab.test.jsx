import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SchoolBasedRosterTab } from "../school_based.jsx";
import { defaultSchoolBasedConfig, mkClinician, mkStudent } from "../school_based.jsx";
import { ROLES } from "../../lib/access.js";

// Minimal school-based config factory — owner role gives full edit access
function makeConfig(overrides = {}) {
  return { ...defaultSchoolBasedConfig(), ...overrides };
}

describe("SchoolBasedRosterTab", () => {
  it("renders the empty-state message when there are no clinicians", () => {
    render(
      <SchoolBasedRosterTab
        config={makeConfig()}
        onUpdate={vi.fn()}
        userRole={ROLES.OWNER}
      />
    );
    expect(screen.getByText(/no clinicians yet/i)).toBeDefined();
  });

  it("renders without crashing against an empty config (legacy catalog-era lines)", () => {
    render(
      <SchoolBasedRosterTab
        config={{}}
        onUpdate={vi.fn()}
        userRole={ROLES.OWNER}
      />
    );
    expect(screen.getByText(/no clinicians yet/i)).toBeDefined();
  });

  it("clicking '+ Add clinician' calls onUpdate with one clinician added", () => {
    const onUpdate = vi.fn();
    render(
      <SchoolBasedRosterTab
        config={makeConfig()}
        onUpdate={onUpdate}
        userRole={ROLES.OWNER}
      />
    );
    fireEvent.click(screen.getByText(/\+ add clinician/i));
    expect(onUpdate).toHaveBeenCalledOnce();
    const updatedConfig = onUpdate.mock.calls[0][0];
    expect(updatedConfig.clinicians).toHaveLength(1);
    expect(updatedConfig.clinicians[0].discipline).toBe("SPEECH");
  });

  it("editing the clinician name input calls onUpdate with the new name", () => {
    const cl = { ...mkClinician("Alice", "SPEECH", "PROFESSIONAL", 30), id: "c1" };
    const onUpdate = vi.fn();
    render(
      <SchoolBasedRosterTab
        config={makeConfig({ clinicians: [cl] })}
        onUpdate={onUpdate}
        userRole={ROLES.OWNER}
      />
    );
    const nameInput = screen.getByDisplayValue("Alice");
    fireEvent.change(nameInput, { target: { value: "Bob" } });
    expect(onUpdate).toHaveBeenCalledOnce();
    const updatedConfig = onUpdate.mock.calls[0][0];
    expect(updatedConfig.clinicians[0].name).toBe("Bob");
  });

  it("changing discipline resets the tier to the new discipline's first tier", () => {
    const cl = { ...mkClinician("Alice", "OT", "TECH", 30), id: "c1" };
    const onUpdate = vi.fn();
    render(
      <SchoolBasedRosterTab
        config={makeConfig({ clinicians: [cl] })}
        onUpdate={onUpdate}
        userRole={ROLES.OWNER}
      />
    );
    const disciplineSelect = screen.getByDisplayValue("Occupational Therapy");
    fireEvent.change(disciplineSelect, { target: { value: "PT" } });
    expect(onUpdate).toHaveBeenCalledOnce();
    const updatedConfig = onUpdate.mock.calls[0][0];
    expect(updatedConfig.clinicians[0].discipline).toBe("PT");
    expect(updatedConfig.clinicians[0].tier).toBe("PROFESSIONAL");
  });

  it("clicking '+ Add student' calls onUpdate with a student added to that clinician", () => {
    const cl = { ...mkClinician("Alice", "SPEECH", "PROFESSIONAL", 30), id: "c1" };
    const onUpdate = vi.fn();
    render(
      <SchoolBasedRosterTab
        config={makeConfig({ clinicians: [cl] })}
        onUpdate={onUpdate}
        userRole={ROLES.OWNER}
      />
    );
    fireEvent.click(screen.getByText(/\+ add student/i));
    expect(onUpdate).toHaveBeenCalledOnce();
    const updatedConfig = onUpdate.mock.calls[0][0];
    expect(updatedConfig.clinicians[0].students).toHaveLength(1);
  });

  it("caseload count stat reflects the number of students", () => {
    const cl = {
      ...mkClinician("Alice", "SPEECH", "PROFESSIONAL", 30),
      id: "c1",
      students: [
        { ...mkStudent("S1"), id: "s1" },
        { ...mkStudent("S2"), id: "s2" },
      ],
    };
    render(
      <SchoolBasedRosterTab
        config={makeConfig({ clinicians: [cl] })}
        onUpdate={vi.fn()}
        userRole={ROLES.OWNER}
      />
    );
    const label = screen.getByText("Total caseload");
    expect(label.nextElementSibling.textContent).toBe("2");
  });

  it("add clinician button is hidden when userRole has no edit permission", () => {
    render(
      <SchoolBasedRosterTab
        config={makeConfig()}
        onUpdate={vi.fn()}
        userRole={ROLES.HOUSE_LEAD}
      />
    );
    expect(screen.queryByText(/\+ add clinician/i)).toBeNull();
  });

  it("dollar stats are hidden for roles without company-dollar access", () => {
    const cl = { ...mkClinician("Alice", "SPEECH", "PROFESSIONAL", 30), id: "c1" };
    render(
      <SchoolBasedRosterTab
        config={makeConfig({ clinicians: [cl] })}
        onUpdate={vi.fn()}
        userRole={ROLES.HOUSE_LEAD}
      />
    );
    expect(screen.queryByText("Annual Rev")).toBeNull();
    expect(screen.queryByText("Direct Labor")).toBeNull();
    // percentage stats remain visible
    expect(screen.getAllByText("Margin").length).toBeGreaterThan(0);
  });

  it("wage input is hidden for tier-8 roles (wageDisplayMode 'hidden')", () => {
    const cl = { ...mkClinician("Alice", "SPEECH", "PROFESSIONAL", 30), id: "c1" };
    render(
      <SchoolBasedRosterTab
        config={makeConfig({ clinicians: [cl] })}
        onUpdate={vi.fn()}
        userRole={ROLES.HOUSE_LEAD}
      />
    );
    expect(screen.queryByText("Wage / hr")).toBeNull();
  });
});
