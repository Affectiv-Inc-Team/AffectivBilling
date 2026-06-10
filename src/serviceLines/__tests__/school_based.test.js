import { describe, it, expect } from "vitest";
import {
  SCHOOL_RATE_TABLE,
  DISCIPLINES,
  disciplineTiers,
  therapyRateKeyFor,
  mkClinician,
  mkStudent,
  mkSchoolAdminStaffMember,
  defaultSchoolBasedConfig,
  schoolYearWeeks,
  calcSchoolStudent,
  calcSchoolClinician,
  calcSchoolAdminStaff,
  calcSchoolBasedService,
  calcSchoolScenario,
} from "../school_based.jsx";

// Rate constants mirrored from school_based.jsx to keep assertions self-documenting
const SPEECH_PROF  = 16.10;
const SPEECH_ASST  = 13.69;
const PT_PROF      = 24.60;
const PT_ASST      = 20.91;
const OT_PROF      = 29.33;
const OT_TECH      = 6.23;
const PSYCHO_30    = 68.96;
const PSYCHO_45    = 91.03;
const PSYCHO_60    = 134.77;
const PSYCH_EVAL   = 36.34;
const CBRS_IND     = 15.44;
const CBRS_GRP     = 3.86;
const TRANSPORT    = 0.44;

// Default school year: 36 weeks, default absence rate 10% → attendance 0.9
const WEEKS = 36;
const ATTEND = 0.9;

// A student whose only service is N therapy hrs/wk
function therapyStudent(hrPerWk = 1) {
  const s = mkStudent("T");
  s.services.therapy.hrPerWk = hrPerWk;
  return s;
}

// A student with everything zeroed (mkStudent defaults therapy to 1 hr/wk)
function blankStudent() {
  const s = mkStudent("B");
  s.services.therapy.hrPerWk = 0;
  return s;
}

// ──────────────────────────────────────────────────────────────────────
// Factories & registry
// ──────────────────────────────────────────────────────────────────────

describe("factories", () => {
  it("mkClinician produces the expected shape", () => {
    const c = mkClinician("Alice", "PT", "ASSISTANT", 28);
    expect(c.discipline).toBe("PT");
    expect(c.tier).toBe("ASSISTANT");
    expect(c.hourlyWage).toBe(28);
    expect(c.adminHrsPerWeek).toBe(5);
    expect(c.schoolName).toBe("");
    expect(c.students).toEqual([]);
    expect(c.id).toMatch(/^sbc_/);
  });

  it("mkStudent carries every service field regardless of discipline", () => {
    const s = mkStudent();
    expect(s.services.therapy.hrPerWk).toBe(1);
    expect(s.services.psycho).toEqual({ v30PerWk: 0, v45PerWk: 0, v60PerWk: 0 });
    expect(s.services.psychEval.unitsPerYear).toBe(0);
    expect(s.services.cbrsInd.hrPerWk).toBe(0);
    expect(s.services.cbrsGrp).toEqual({ hrPerWk: 0, groupSize: 4 });
    expect(s.services.transport.milesPerWk).toBe(0);
  });

  it("defaultSchoolBasedConfig has the documented keys", () => {
    const cfg = defaultSchoolBasedConfig();
    expect(cfg.clinicians).toEqual([]);
    expect(cfg.schoolYear).toEqual({ weeksPerYear: 36, esyWeeks: 0 });
    expect(cfg.productivity.absenceRate).toBe(10);
    expect(cfg.supervision).toEqual({ count: 0, salary: 70000 });
    expect(cfg.adminStaff).toEqual([]);
    expect(cfg.payrollBurdenPct).toBe(22);
    expect(cfg.defaultDiscipline).toBe("SPEECH");
    expect(cfg.rateOverrides).toEqual({});
  });

  it("SCHOOL_RATE_TABLE has 13 codes with units", () => {
    expect(SCHOOL_RATE_TABLE).toHaveLength(13);
    const units = new Set(SCHOOL_RATE_TABLE.map(r => r.unit));
    expect(units).toEqual(new Set(["15min", "visit", "mile"]));
  });
});

describe("therapyRateKeyFor", () => {
  it("maps every discipline/tier combo", () => {
    expect(therapyRateKeyFor("SPEECH", "PROFESSIONAL")).toBe("speech_prof");
    expect(therapyRateKeyFor("SPEECH", "ASSISTANT")).toBe("speech_asst");
    expect(therapyRateKeyFor("PT", "PROFESSIONAL")).toBe("pt_prof");
    expect(therapyRateKeyFor("PT", "ASSISTANT")).toBe("pt_asst");
    expect(therapyRateKeyFor("OT", "PROFESSIONAL")).toBe("ot_prof");
    expect(therapyRateKeyFor("OT", "TECH")).toBe("ot_tech");
  });

  it("returns null for BEHAVIORAL and CBRS (no single therapy rate)", () => {
    expect(therapyRateKeyFor("BEHAVIORAL", "PROFESSIONAL")).toBeNull();
    expect(therapyRateKeyFor("CBRS", "SPECIALIST")).toBeNull();
  });

  it("falls back to the discipline's first tier on a stale combo", () => {
    // e.g. clinician switched from OT (TECH) to PT — PT has no TECH tier
    expect(therapyRateKeyFor("PT", "TECH")).toBe("pt_prof");
  });

  it("returns null for an unknown discipline", () => {
    expect(therapyRateKeyFor("NOPE", "PROFESSIONAL")).toBeNull();
  });

  it("disciplineTiers lists tiers per discipline", () => {
    expect(disciplineTiers("SPEECH")).toEqual(["PROFESSIONAL", "ASSISTANT"]);
    expect(disciplineTiers("CBRS")).toEqual(["SPECIALIST"]);
    expect(disciplineTiers("NOPE")).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────
// calcSchoolStudent
// ──────────────────────────────────────────────────────────────────────

describe("calcSchoolStudent", () => {
  const speechProf = mkClinician("S", "SPEECH", "PROFESSIONAL");

  it("annualizes speech therapy over school-year weeks with attendance", () => {
    const r = calcSchoolStudent(therapyStudent(1), speechProf);
    // 1 hr/wk = 4 units × $16.10 × 36 weeks × 0.9 attendance
    expect(r.annualRev).toBeCloseTo(4 * SPEECH_PROF * WEEKS * ATTEND, 2);
    expect(r.clinicianHrsPerWk).toBeCloseTo(1 * ATTEND, 4);
  });

  it("uses the assistant rate for an assistant-tier clinician", () => {
    const asst = mkClinician("A", "SPEECH", "ASSISTANT");
    const r = calcSchoolStudent(therapyStudent(2), asst);
    expect(r.annualRev).toBeCloseTo(2 * 4 * SPEECH_ASST * WEEKS * ATTEND, 2);
  });

  it("rates PT and OT by discipline and tier", () => {
    const ptA = calcSchoolStudent(therapyStudent(1), mkClinician("p", "PT", "ASSISTANT"));
    expect(ptA.weeklyRev).toBeCloseTo(4 * PT_ASST, 2);
    const otT = calcSchoolStudent(therapyStudent(1), mkClinician("o", "OT", "TECH"));
    expect(otT.weeklyRev).toBeCloseTo(4 * OT_TECH, 2);
    const otP = calcSchoolStudent(therapyStudent(1), mkClinician("o", "OT", "PROFESSIONAL"));
    expect(otP.weeklyRev).toBeCloseTo(4 * OT_PROF, 2);
  });

  it("ignores therapy hours for BEHAVIORAL clinicians (no therapy rate key)", () => {
    const r = calcSchoolStudent(therapyStudent(3), mkClinician("b", "BEHAVIORAL", "PROFESSIONAL"));
    expect(r.weeklyRev).toBe(0);
    expect(r.clinicianHrsPerWk).toBe(0);
  });

  it("bills psychotherapy per visit and fixes clinician time by visit length", () => {
    const s = blankStudent();
    s.services.psycho = { v30PerWk: 1, v45PerWk: 1, v60PerWk: 0 };
    const r = calcSchoolStudent(s, mkClinician("b", "BEHAVIORAL", "PROFESSIONAL"));
    expect(r.weeklyRev).toBeCloseTo(PSYCHO_30 + PSYCHO_45, 2);
    expect(r.clinicianHrsPerWk).toBeCloseTo((0.5 + 0.75) * ATTEND, 4);
    expect(r.annualRev).toBeCloseTo((PSYCHO_30 + PSYCHO_45) * WEEKS * ATTEND, 2);
  });

  it("adds psych eval revenue annually, independent of weekly cadence", () => {
    const s = blankStudent();
    s.services.psychEval.unitsPerYear = 4; // ≈ one 1-hour eval
    const r = calcSchoolStudent(s, mkClinician("b", "BEHAVIORAL", "PROFESSIONAL"));
    expect(r.annualRev).toBeCloseTo(4 * PSYCH_EVAL * ATTEND, 2);
    expect(r.weeklyRev).toBe(0); // eval is not part of the weekly stream
  });

  it("bills CBRS group hours in full but shares clinician time across the group", () => {
    const s = blankStudent();
    s.services.cbrsInd = { hrPerWk: 1 };
    s.services.cbrsGrp = { hrPerWk: 2, groupSize: 4 };
    const r = calcSchoolStudent(s, mkClinician("c", "CBRS", "SPECIALIST"));
    expect(r.weeklyRev).toBeCloseTo(1 * 4 * CBRS_IND + 2 * 4 * CBRS_GRP, 2);
    // clinician time: 1 individual + 2/4 group hours
    expect(r.clinicianHrsPerWk).toBeCloseTo((1 + 0.5) * ATTEND, 4);
    // billed (received) time counts the full group hours
    expect(r.billedHrsPerWk).toBeCloseTo(3 * ATTEND, 4);
  });

  it("counts transportation as revenue with zero clinician hours", () => {
    const s = blankStudent();
    s.services.transport.milesPerWk = 50;
    const r = calcSchoolStudent(s, mkClinician("c", "CBRS", "SPECIALIST"));
    expect(r.weeklyRev).toBeCloseTo(50 * TRANSPORT, 2);
    expect(r.clinicianHrsPerWk).toBe(0);
    expect(r.milesPerWk).toBe(50);
  });

  it("extends the year by ESY weeks", () => {
    const base = calcSchoolStudent(therapyStudent(1), speechProf, undefined, { weeksPerYear: 36, esyWeeks: 0 });
    const esy  = calcSchoolStudent(therapyStudent(1), speechProf, undefined, { weeksPerYear: 36, esyWeeks: 6 });
    expect(esy.annualRev / base.annualRev).toBeCloseTo(42 / 36, 4);
  });

  it("scales revenue by attendance (absence rate)", () => {
    const full = calcSchoolStudent(therapyStudent(1), speechProf, undefined, {}, { absenceRate: 0 });
    const abs  = calcSchoolStudent(therapyStudent(1), speechProf, undefined, {}, { absenceRate: 10 });
    expect(abs.annualRev / full.annualRev).toBeCloseTo(0.9, 4);
  });

  it("honors rate overrides", () => {
    const r = calcSchoolStudent(therapyStudent(1), speechProf, { speech_prof: 20 }, {}, { absenceRate: 0 });
    expect(r.weeklyRev).toBeCloseTo(4 * 20, 2);
  });

  it("returns zeros for a student with no services blob", () => {
    const r = calcSchoolStudent({ id: "x", name: "empty" }, speechProf);
    expect(r.annualRev).toBe(0);
    expect(r.clinicianHrsPerWk).toBe(0);
    expect(Number.isNaN(r.billedHrsPerWk)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────
// calcSchoolClinician
// ──────────────────────────────────────────────────────────────────────

describe("calcSchoolClinician", () => {
  it("pays for service + admin hours over school-year weeks with burden", () => {
    const cl = mkClinician("Alice", "SPEECH", "PROFESSIONAL", 30);
    cl.students = [therapyStudent(10)];
    const m = calcSchoolClinician(cl, 22, undefined, { weeksPerYear: 36, esyWeeks: 0 }, { absenceRate: 0 });
    // 10 service + 5 admin hrs/wk × 36 wks × $30 × 1.22
    expect(m.annualLabor).toBeCloseTo(15 * 36 * 30 * 1.22, 2);
    expect(m.weeklyServiceHrs).toBeCloseTo(10, 4);
    expect(m.utilization).toBeCloseTo(15 / 40, 4);
    expect(m.billableShare).toBeCloseTo(10 / 15, 4);
  });

  it("reduces paid service hours by absence but keeps admin hours", () => {
    const cl = mkClinician("Alice", "SPEECH", "PROFESSIONAL", 30);
    cl.students = [therapyStudent(10)];
    const m = calcSchoolClinician(cl, 22, undefined, {}, { absenceRate: 10 });
    expect(m.weeklyHrs).toBeCloseTo(10 * 0.9 + 5, 4);
  });

  it("computes gross and margin", () => {
    const cl = mkClinician("Alice", "SPEECH", "PROFESSIONAL", 30);
    cl.students = [therapyStudent(10)];
    const m = calcSchoolClinician(cl);
    expect(m.gross).toBeCloseTo(m.annualRev - m.annualLabor, 2);
    expect(m.grossMargin).toBeCloseTo(m.gross / m.annualRev, 6);
  });

  it("handles a clinician with no students", () => {
    const m = calcSchoolClinician(mkClinician());
    expect(m.caseloadSize).toBe(0);
    expect(m.annualRev).toBe(0);
    expect(m.grossMargin).toBe(0);
    // still paid for admin hours
    expect(m.annualLabor).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────
// calcSchoolAdminStaff
// ──────────────────────────────────────────────────────────────────────

describe("calcSchoolAdminStaff", () => {
  it("computes salaried cost with FTE and benefits", () => {
    const r = calcSchoolAdminStaff([{ mode: "salary", value: 60000, ftePct: 50, benefitsPct: 20 }]);
    expect(r.totalAnnualCost).toBeCloseTo(60000 * 0.5 * 1.2, 2);
  });

  it("computes hourly cost at 2080 hrs/yr", () => {
    const r = calcSchoolAdminStaff([{ mode: "hourly", value: 25, ftePct: 100, benefitsPct: 22 }]);
    expect(r.totalAnnualCost).toBeCloseTo(25 * 2080 * 1.22, 2);
  });

  it("sums multiple members and defaults missing fields", () => {
    const r = calcSchoolAdminStaff([mkSchoolAdminStaffMember(), mkSchoolAdminStaffMember()]);
    expect(r.staff).toHaveLength(2);
    expect(r.totalAnnualCost).toBeCloseTo(2 * 55000 * 1.22, 2);
  });

  it("returns zero for empty input", () => {
    expect(calcSchoolAdminStaff([]).totalAnnualCost).toBe(0);
    expect(calcSchoolAdminStaff().totalAnnualCost).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────
// calcSchoolBasedService
// ──────────────────────────────────────────────────────────────────────

describe("calcSchoolBasedService", () => {
  function twoClinicianConfig() {
    const cfg = defaultSchoolBasedConfig();
    const c1 = mkClinician("Alice", "SPEECH", "PROFESSIONAL", 30);
    c1.students = [therapyStudent(5), therapyStudent(5)];
    const c2 = mkClinician("Bob", "PT", "ASSISTANT", 28);
    c2.students = [therapyStudent(8)];
    cfg.clinicians = [c1, c2];
    return cfg;
  }

  it("sums caseload, revenue and labor across clinicians", () => {
    const r = calcSchoolBasedService(twoClinicianConfig());
    expect(r.clinicianCount).toBe(2);
    expect(r.totalCaseload).toBe(3);
    const sum = r.clinicians.reduce((a, c) => a + c.metrics.annualRev, 0);
    expect(r.totalAnnualRev).toBeCloseTo(sum, 2);
    expect(r.totalAnnualRev).toBeGreaterThan(0);
    expect(r.totalAnnualLabor).toBeGreaterThan(0);
  });

  it("adds supervision and admin staff to gross but not to totalAnnualLabor", () => {
    const cfg = twoClinicianConfig();
    cfg.supervision = { count: 1, salary: 70000 };
    cfg.adminStaff = [mkSchoolAdminStaffMember()];
    const r = calcSchoolBasedService(cfg);
    expect(r.supervisionCost).toBeCloseTo(70000 * 1.22, 2);
    expect(r.adminStaffCost).toBeCloseTo(55000 * 1.22, 2);
    expect(r.totalGross).toBeCloseTo(r.totalAnnualRev - r.totalAnnualLabor - r.supervisionCost - r.adminStaffCost, 2);
    // company roll-up labor excludes overhead staff (DDA precedent)
    const clinicianLabor = r.clinicians.reduce((a, c) => a + c.metrics.annualLabor, 0);
    expect(r.totalAnnualLabor).toBeCloseTo(clinicianLabor, 2);
  });

  it("flows rate overrides through to revenue", () => {
    const cfg = twoClinicianConfig();
    const base = calcSchoolBasedService(cfg);
    cfg.rateOverrides = { speech_prof: SPEECH_PROF * 2 };
    const bumped = calcSchoolBasedService(cfg);
    expect(bumped.totalAnnualRev).toBeGreaterThan(base.totalAnnualRev);
  });

  it("survives an empty config (legacy catalog-era service lines)", () => {
    const r = calcSchoolBasedService({});
    expect(r.totalAnnualRev).toBe(0);
    expect(r.totalAnnualLabor).toBe(0);
    expect(r.clinicianCount).toBe(0);
    expect(r.totalCaseload).toBe(0);
    expect(r.totalMargin).toBe(0);
    expect(r.weeks).toBe(36);
  });

  it("survives being called with no argument", () => {
    expect(() => calcSchoolBasedService()).not.toThrow();
  });

  it("reports school-year weeks including ESY", () => {
    expect(schoolYearWeeks({ weeksPerYear: 36, esyWeeks: 6 })).toBe(42);
    const cfg = defaultSchoolBasedConfig();
    cfg.schoolYear.esyWeeks = 4;
    expect(calcSchoolBasedService(cfg).weeks).toBe(40);
  });
});

// ──────────────────────────────────────────────────────────────────────
// calcSchoolScenario
// ──────────────────────────────────────────────────────────────────────

describe("calcSchoolScenario", () => {
  function cfgWith(scenario) {
    const cfg = defaultSchoolBasedConfig();
    const c = mkClinician("Alice", "SPEECH", "PROFESSIONAL", 30);
    c.students = [therapyStudent(10)];
    cfg.clinicians = [c];
    cfg.scenario = { ...cfg.scenario, ...scenario };
    return cfg;
  }

  it("is a no-op with default scenario settings", () => {
    const r = calcSchoolScenario(cfgWith({}));
    expect(r.delta.totalAnnualRev).toBeCloseTo(0, 2);
    expect(r.delta.totalGross).toBeCloseTo(0, 2);
  });

  it("rate adjustment scales revenue but not labor", () => {
    const r = calcSchoolScenario(cfgWith({ rateAdjPct: 10 }));
    expect(r.scenario.totalAnnualRev).toBeCloseTo(r.base.totalAnnualRev * 1.1, 2);
    expect(r.scenario.totalAnnualLabor).toBeCloseTo(r.base.totalAnnualLabor, 2);
    expect(r.delta.totalGross).toBeCloseTo(r.base.totalAnnualRev * 0.1, 2);
  });

  it("caseload count scales volumes proportionally", () => {
    const r = calcSchoolScenario(cfgWith({ caseloadCount: 2 })); // base caseload = 1
    expect(r.scenario.totalAnnualRev).toBeCloseTo(r.base.totalAnnualRev * 2, 2);
    expect(r.scenario.totalCaseload).toBe(2);
  });

  it("productivity adjustment scales hours and revenue together", () => {
    const r = calcSchoolScenario(cfgWith({ productivityAdjPct: 20 }));
    expect(r.scenario.totalAnnualRev).toBeCloseTo(r.base.totalAnnualRev * 1.2, 2);
    // labor rises too: more service hours are paid
    expect(r.scenario.totalAnnualLabor).toBeGreaterThan(r.base.totalAnnualLabor);
  });

  it("weeksPerYear what-if re-annualizes the year", () => {
    const r = calcSchoolScenario(cfgWith({ weeksPerYear: 42 }));
    expect(r.scenario.weeks).toBe(42);
    expect(r.scenario.totalAnnualRev).toBeCloseTo(r.base.totalAnnualRev * 42 / 36, 2);
  });

  it("survives an empty config", () => {
    const r = calcSchoolScenario({});
    expect(r.base.totalAnnualRev).toBe(0);
    expect(r.scenario.totalAnnualRev).toBe(0);
    expect(r.delta.totalGross).toBe(0);
  });
});
