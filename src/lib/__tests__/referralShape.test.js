import { describe, it, expect } from "vitest";
import {
  buildDisplayLabel, isSaveable, softWarnings, labelFor, daysInStage,
} from "../referralShape.js";

// ──────────────────────────────────────────────────────────────────────
// isSaveable — the one-field-to-save rule
// ──────────────────────────────────────────────────────────────────────

describe("isSaveable", () => {
  it("rejects a fully empty record (only stage/priority defaults)", () => {
    expect(isSaveable({ stage: "NEW_INQUIRY", priority: "normal" })).toBe(false);
    expect(isSaveable({})).toBe(false);
    expect(isSaveable(null)).toBe(false);
  });

  it("rejects whitespace-only content", () => {
    expect(isSaveable({ stage: "NEW_INQUIRY", first_name: "   " })).toBe(false);
  });

  it("saves with only a referring-party name", () => {
    expect(isSaveable({ stage: "NEW_INQUIRY", referring_party: { name: "St. Luke's" } })).toBe(true);
  });

  it("saves with only a phone number", () => {
    expect(isSaveable({ stage: "NEW_INQUIRY", referring_party: { phone: "208-555-1212" } })).toBe(true);
  });

  it("saves with a single set flag", () => {
    expect(isSaveable({ stage: "NEW_INQUIRY", is_minor: false })).toBe(true);
  });

  it("saves with a value buried in details", () => {
    expect(isSaveable({ stage: "NEW_INQUIRY", details: { diagnoses: "ASD" } })).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────
// buildDisplayLabel — always findable
// ──────────────────────────────────────────────────────────────────────

describe("buildDisplayLabel", () => {
  it("prefers the client name", () => {
    expect(buildDisplayLabel({ first_name: "Jamie", last_name: "Doe" })).toBe("Jamie Doe");
    expect(buildDisplayLabel({ first_name: "Jamie" })).toBe("Jamie");
  });

  it("falls back to preferred name when no first/last", () => {
    expect(buildDisplayLabel({ preferred_name: "JD" })).toBe("JD");
  });

  it("falls back to referring party + date", () => {
    const label = buildDisplayLabel({
      referring_party: { name: "St. Luke's" }, date_received: "2026-06-10",
    });
    expect(label).toContain("St. Luke's");
    expect(label).toContain("·");
  });

  it("uses referring party alone when no date", () => {
    expect(buildDisplayLabel({ referring_party: { name: "St. Luke's" } })).toBe("St. Luke's");
  });

  it("produces an Unnamed label from source + date when nothing else", () => {
    const label = buildDisplayLabel({ source_type: "hospital", date_received: "2026-06-10" });
    expect(label).toContain("Unnamed referral");
    expect(label).toContain("Hospital");
  });

  it("handles a totally empty record", () => {
    expect(buildDisplayLabel({})).toContain("Unnamed referral");
    expect(buildDisplayLabel({})).toContain("unknown source");
  });
});

// ──────────────────────────────────────────────────────────────────────
// softWarnings — guidance, never blocking
// ──────────────────────────────────────────────────────────────────────

describe("softWarnings", () => {
  it("warns about missing name/contact, source, and date on an empty record", () => {
    const w = softWarnings({});
    expect(w.length).toBe(3);
  });

  it("drops the contact warning once a referring-party phone exists", () => {
    const w = softWarnings({ referring_party: { phone: "208-555-1212" } });
    expect(w.some(s => s.includes("contact"))).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────────

describe("labelFor", () => {
  it("maps stored enum values to human labels", () => {
    expect(labelFor("stage", "ACCEPTED_PENDING_PLACEMENT")).toBe("Accepted (Pending Placement)");
    expect(labelFor("source_type", "tsc")).toBe("TSC");
  });
  it("falls back to the raw value when unknown", () => {
    expect(labelFor("stage", "WEIRD")).toBe("WEIRD");
  });
});

describe("daysInStage", () => {
  it("returns null for missing input", () => {
    expect(daysInStage(null)).toBe(null);
  });
  it("returns a non-negative integer for a past date", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
    expect(daysInStage(tenDaysAgo)).toBe(10);
  });
});
