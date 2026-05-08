import { describe, it, expect } from "vitest";
import {
  IDAHO_RATES,
  HOSPICE_COUNTIES,
  HOSPICE_CAP_2026,
  ratesForLine,
  findRate,
  resolveRate,
  getHospiceRate,
  unitsFromHours,
  hoursFromUnits,
} from "../idahoRates.js";

// ──────────────────────────────────────────────────────────────────────
// IDAHO_RATES catalog metadata
// ──────────────────────────────────────────────────────────────────────

describe("IDAHO_RATES catalog", () => {
  it("has a rates array with entries", () => {
    expect(Array.isArray(IDAHO_RATES.rates)).toBe(true);
    expect(IDAHO_RATES.rates.length).toBeGreaterThan(0);
  });

  it("effectiveDate is 2025-09-01", () => {
    expect(IDAHO_RATES.effectiveDate).toBe("2025-09-01");
  });

  it("every rate record has required fields", () => {
    for (const r of IDAHO_RATES.rates) {
      expect(r, `record ${r.code}`).toHaveProperty("code");
      expect(r, `record ${r.code}`).toHaveProperty("modifier");
      expect(r, `record ${r.code}`).toHaveProperty("desc");
      expect(r, `record ${r.code}`).toHaveProperty("unit");
      expect(Object.prototype.hasOwnProperty.call(r, "rate"), `${r.code} missing rate`).toBe(true);
      expect(Array.isArray(r.lines), `${r.code} lines not array`).toBe(true);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────
// ratesForLine
// ──────────────────────────────────────────────────────────────────────

describe("ratesForLine", () => {
  it("returns exactly 5 records for TSC", () => {
    // G9002, G9002 HM, G9007, H2011, H2011 HM
    expect(ratesForLine("TSC")).toHaveLength(5);
  });

  it("returns records for RES_HAB_DAILY", () => {
    expect(ratesForLine("RES_HAB_DAILY").length).toBeGreaterThan(0);
  });

  it("returns records for RES_HAB_HOURLY (H2015)", () => {
    const rates = ratesForLine("RES_HAB_HOURLY");
    expect(rates.some((r) => r.code === "H2015")).toBe(true);
  });

  it("returns empty array for unknown service line type", () => {
    expect(ratesForLine("UNKNOWN_LINE")).toHaveLength(0);
  });

  it("every returned record includes the queried type in its lines array", () => {
    const type = "TSC";
    for (const r of ratesForLine(type)) {
      expect(r.lines).toContain(type);
    }
  });

  it("returned TSC records include expected codes", () => {
    const codes = ratesForLine("TSC").map((r) => r.code);
    expect(codes).toContain("G9002");
    expect(codes).toContain("G9007");
    expect(codes).toContain("H2011");
  });
});

// ──────────────────────────────────────────────────────────────────────
// findRate
// ──────────────────────────────────────────────────────────────────────

describe("findRate", () => {
  it("finds G9002 standard rate at $20.97", () => {
    const r = findRate("G9002", "");
    expect(r).not.toBeNull();
    expect(r.rate).toBe(20.97);
  });

  it("finds G9002 HM (parapro) rate at $13.46", () => {
    const r = findRate("G9002", "HM");
    expect(r).not.toBeNull();
    expect(r.rate).toBe(13.46);
  });

  it("finds G9007 plan development at $20.97", () => {
    const r = findRate("G9007", "");
    expect(r).not.toBeNull();
    expect(r.rate).toBe(20.97);
  });

  it("finds H2011 crisis at $20.97", () => {
    const r = findRate("H2011", "");
    expect(r).not.toBeNull();
    expect(r.rate).toBe(20.97);
  });

  it("finds H2011 HM (parapro crisis) at $13.46", () => {
    const r = findRate("H2011", "HM");
    expect(r).not.toBeNull();
    expect(r.rate).toBe(13.46);
  });

  it("finds H2015 individual supported living", () => {
    const r = findRate("H2015", "");
    expect(r).not.toBeNull();
    expect(r.rate).toBe(7.56);
  });

  it("finds H2015 HQ group supported living", () => {
    const r = findRate("H2015", "HQ");
    expect(r).not.toBeNull();
    expect(r.rate).toBe(3.86);
  });

  it("returns null for a nonexistent code", () => {
    expect(findRate("FAKE999", "")).toBeNull();
  });

  it("returns null for an existing code with a wrong modifier", () => {
    expect(findRate("G9002", "WRONGMOD")).toBeNull();
  });

  it("tier filter: finds record with specific tier when tier provided", () => {
    const r = findRate("G9002", "HM", "PARAPRO");
    expect(r).not.toBeNull();
    expect(r.rate).toBe(13.46);
    expect(r.tier).toBe("PARAPRO");
  });

  it("tier filter: returns null when tier does not match", () => {
    expect(findRate("G9002", "HM", "PHYSICIAN")).toBeNull();
  });

  it("tier=null matches any tier (permissive)", () => {
    // G9002 HM has tier PARAPRO — findRate with tier=null should still find it
    const r = findRate("G9002", "HM", null);
    expect(r).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────
// resolveRate
// ──────────────────────────────────────────────────────────────────────

describe("resolveRate", () => {
  it("returns catalog rate when no overrides map provided", () => {
    expect(resolveRate("TSC", "G9002", "", null, {})).toBe(20.97);
  });

  it("returns catalog rate when override key absent", () => {
    const overrides = { "H2011||": 99.00 }; // different key
    expect(resolveRate("TSC", "G9002", "", null, overrides)).toBe(20.97);
  });

  it("override key wins over catalog when key matches", () => {
    // key format: ${code}|${modifier}|${tier ?? ''}
    // G9002, modifier='', tier=null → key = 'G9002||'
    const overrides = { "G9002||": 25.00 };
    expect(resolveRate("TSC", "G9002", "", null, overrides)).toBe(25.00);
  });

  it("override key format for modifier and tier: 'G9002|HM|PARAPRO'", () => {
    const overrides = { "G9002|HM|PARAPRO": 15.00 };
    expect(resolveRate("TSC", "G9002", "HM", "PARAPRO", overrides)).toBe(15.00);
  });

  it("returns null for a code that does not belong to the service line", () => {
    // H2015 is RES_HAB_HOURLY, not TSC
    expect(resolveRate("TSC", "H2015", "", null, {})).toBeNull();
  });

  it("returns null for a completely unknown code", () => {
    expect(resolveRate("TSC", "FAKE999", "", null, {})).toBeNull();
  });

  it("defaults modifier to empty string and tier to null when not passed", () => {
    // resolveRate('TSC', 'G9002') — should still work with defaults
    expect(resolveRate("TSC", "G9002")).toBe(20.97);
  });

  it("override for a different tier does not affect rate lookup for null tier", () => {
    const overrides = { "G9002|HM|PHYSICIAN": 50.00 }; // wrong tier in key
    // Requesting tier=null so override key is 'G9002|HM|' — doesn't match 'G9002|HM|PHYSICIAN'
    expect(resolveRate("TSC", "G9002", "HM", null, overrides)).toBe(13.46);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Hospice helpers
// ──────────────────────────────────────────────────────────────────────

describe("HOSPICE_COUNTIES", () => {
  it("contains exactly 8 entries", () => {
    expect(HOSPICE_COUNTIES).toHaveLength(8);
  });

  it("includes Franklin", () => {
    expect(HOSPICE_COUNTIES).toContain("Franklin");
  });

  it("includes RURAL as the fallback key", () => {
    expect(HOSPICE_COUNTIES).toContain("RURAL");
  });
});

describe("HOSPICE_CAP_2026", () => {
  it("is a positive number", () => {
    expect(HOSPICE_CAP_2026).toBeGreaterThan(0);
  });

  it("equals 35361.44", () => {
    expect(HOSPICE_CAP_2026).toBe(35361.44);
  });
});

describe("getHospiceRate", () => {
  const RATE_KEYS = [
    "rc0651_d1_60",
    "rc0651_d61_plus",
    "sia",
    "rc0652",
    "rc0655",
    "rc0656",
  ];

  it("returns quality rates for Franklin when qualityDataSubmitted=true", () => {
    const r = getHospiceRate("Franklin", true);
    expect(r.rc0651_d1_60).toBe(223.04);
    expect(r.rc0651_d61_plus).toBe(175.81);
  });

  it("returns non-quality rates for Franklin when qualityDataSubmitted=false", () => {
    const r = getHospiceRate("Franklin", false);
    expect(r.rc0651_d1_60).toBe(214.35);
    expect(r.rc0651_d61_plus).toBe(168.95);
  });

  it("quality and non-quality rates for the same county differ", () => {
    const q  = getHospiceRate("Kootenai", true);
    const nq = getHospiceRate("Kootenai", false);
    expect(q.rc0651_d1_60).not.toBe(nq.rc0651_d1_60);
  });

  it("returns an object with all 6 rate keys", () => {
    const r = getHospiceRate("Kootenai", true);
    for (const key of RATE_KEYS) {
      expect(r, `missing key ${key}`).toHaveProperty(key);
    }
  });

  it("falls back to RURAL rates for an unknown county", () => {
    const rural   = getHospiceRate("RURAL", true);
    const unknown = getHospiceRate("Completely Unknown County XYZ", true);
    expect(unknown).toEqual(rural);
  });

  it("quality=true is the default when second argument omitted", () => {
    const withDefault = getHospiceRate("Franklin");
    const withTrue    = getHospiceRate("Franklin", true);
    expect(withDefault).toEqual(withTrue);
  });

  it("all rate values are positive numbers", () => {
    for (const county of HOSPICE_COUNTIES) {
      const r = getHospiceRate(county, true);
      for (const key of RATE_KEYS) {
        expect(r[key], `${county}.${key}`).toBeGreaterThan(0);
      }
    }
  });
});

// ──────────────────────────────────────────────────────────────────────
// Unit conversion helpers
// ──────────────────────────────────────────────────────────────────────

describe("unitsFromHours", () => {
  it("1 hour → 4 units for 15min billing", () => {
    expect(unitsFromHours(1, "15min")).toBe(4);
  });

  it("2 hours → 8 units for 15min billing", () => {
    expect(unitsFromHours(2, "15min")).toBe(8);
  });

  it("1 hour → 1 unit for hourly billing", () => {
    expect(unitsFromHours(1, "hour")).toBe(1);
  });

  it("24 hours → 1 unit for daily billing", () => {
    expect(unitsFromHours(24, "day")).toBe(1);
  });

  it("unknown unit passes through unchanged", () => {
    expect(unitsFromHours(5, "unknown")).toBe(5);
  });
});

describe("hoursFromUnits", () => {
  it("4 units → 1 hour for 15min billing", () => {
    expect(hoursFromUnits(4, "15min")).toBe(1);
  });

  it("8 units → 2 hours for 15min billing", () => {
    expect(hoursFromUnits(8, "15min")).toBe(2);
  });

  it("1 unit → 1 hour for hourly billing", () => {
    expect(hoursFromUnits(1, "hour")).toBe(1);
  });

  it("1 unit → 24 hours for daily billing", () => {
    expect(hoursFromUnits(1, "day")).toBe(24);
  });

  it("unknown unit passes through unchanged", () => {
    expect(hoursFromUnits(5, "unknown")).toBe(5);
  });
});

describe("unitsFromHours / hoursFromUnits roundtrip", () => {
  const units = ["15min", "hour", "day"];
  const values = [1, 2, 4, 8];

  for (const unit of units) {
    for (const h of values) {
      it(`roundtrip for ${h} hours in unit '${unit}'`, () => {
        expect(hoursFromUnits(unitsFromHours(h, unit), unit)).toBeCloseTo(h, 6);
      });
    }
  }
});
