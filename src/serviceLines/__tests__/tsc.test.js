import { describe, it, expect } from "vitest";
import {
  calcTSCParticipant,
  calcTSCCoordinator,
  calcTSCService,
  calcTSCAdminStaff,
  calcTSCRevenueWaterfall,
  calcTSCProductivityFactors,
  calcTSCBreakEven,
  calcTSCScenario,
  defaultTSCConfig,
} from "../tsc.jsx";

// Rate constants mirrored from tsc.jsx to keep assertions self-documenting
const COORD_RATE       = 20.97;
const COORD_PARAPRO    = 13.46;
const PLAN_DEV_RATE    = 20.97;
const CRISIS_RATE      = 20.97;
const CRISIS_PARAPRO   = 13.46;

// ──────────────────────────────────────────────────────────────────────
// calcTSCParticipant
// ──────────────────────────────────────────────────────────────────────

describe("calcTSCParticipant", () => {
  it("calculates G9002-only revenue at standard rate", () => {
    const result = calcTSCParticipant({
      unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false,
    });
    expect(result.monthlyRev).toBeCloseTo(16 * COORD_RATE, 2);
    expect(result.annualRev).toBeCloseTo(16 * COORD_RATE * 12, 2);
  });

  it("converts units to hours: 16 units = 4 hours/month", () => {
    const result = calcTSCParticipant({
      unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false,
    });
    expect(result.monthlyHours).toBe(4);
    expect(result.annualHours).toBe(48);
  });

  it("uses paraprofessional rate for coord units when isParapro=true", () => {
    const result = calcTSCParticipant({
      unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: true,
    });
    expect(result.monthlyRev).toBeCloseTo(16 * COORD_PARAPRO, 2);
  });

  it("sums G9002 + G9007 + H2011 revenue (non-parapro)", () => {
    // unitsPlanDev is annual units — 48/yr ÷ 12 = 4 units/mo in the calc
    const result = calcTSCParticipant({
      unitsCoord: 16, unitsPlanDev: 48, unitsCrisis: 2, isParapro: false,
    });
    const expected = 16 * COORD_RATE + 4 * PLAN_DEV_RATE + 2 * CRISIS_RATE;
    expect(result.monthlyRev).toBeCloseTo(expected, 2);
  });

  it("sums hours across all three codes", () => {
    // unitsPlanDev is annual units — 48/yr ÷ 12 = 4 units/mo = 1 hr/mo
    const result = calcTSCParticipant({
      unitsCoord: 16, unitsPlanDev: 48, unitsCrisis: 2, isParapro: false,
    });
    expect(result.monthlyHours).toBeCloseTo((16 + 4 + 2) / 4, 5);
  });

  it("applies parapro crisis rate when isParapro=true and crisis units present", () => {
    const result = calcTSCParticipant({
      unitsCoord: 0, unitsPlanDev: 0, unitsCrisis: 4, isParapro: true,
    });
    expect(result.monthlyRev).toBeCloseTo(4 * CRISIS_PARAPRO, 2);
  });

  it("G9007 (plan dev) always uses non-parapro rate regardless of isParapro", () => {
    const withParapro    = calcTSCParticipant({ unitsCoord: 0, unitsPlanDev: 4, unitsCrisis: 0, isParapro: true });
    const withoutParapro = calcTSCParticipant({ unitsCoord: 0, unitsPlanDev: 4, unitsCrisis: 0, isParapro: false });
    // PLAN_DEV rate is the same constant either way ($20.97)
    expect(withParapro.monthlyRev).toBeCloseTo(withoutParapro.monthlyRev, 2);
  });

  it("returns all zeros for an empty participant object — no NaN", () => {
    const result = calcTSCParticipant({});
    expect(result.monthlyRev).toBe(0);
    expect(result.annualRev).toBe(0);
    expect(result.monthlyHours).toBe(0);
    expect(result.annualHours).toBe(0);
  });

  it("annualRev = monthlyRev × 12", () => {
    const result = calcTSCParticipant({
      unitsCoord: 12, unitsPlanDev: 2, unitsCrisis: 1, isParapro: false,
    });
    expect(result.annualRev).toBeCloseTo(result.monthlyRev * 12, 6);
  });

  it("annualHours = monthlyHours × 12", () => {
    const result = calcTSCParticipant({
      unitsCoord: 12, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false,
    });
    expect(result.annualHours).toBeCloseTo(result.monthlyHours * 12, 6);
  });
});

// ──────────────────────────────────────────────────────────────────────
// calcTSCCoordinator
// ──────────────────────────────────────────────────────────────────────

describe("calcTSCCoordinator", () => {
  it("returns zero-valued metrics for a coordinator with no participants", () => {
    const coord = { hourlyWage: 22, adminHrsPerWeek: 5, participants: [] };
    const result = calcTSCCoordinator(coord, 22);
    expect(result.monthlyRev).toBe(0);
    expect(result.annualRev).toBe(0);
    expect(result.caseloadSize).toBe(0);
  });

  it("grossMargin is 0 (not NaN) when revenue is zero", () => {
    const coord = { hourlyWage: 22, adminHrsPerWeek: 5, participants: [] };
    const result = calcTSCCoordinator(coord, 22);
    expect(result.grossMargin).toBe(0);
    expect(Number.isNaN(result.grossMargin)).toBe(false);
  });

  it("billableShare is 0 (not NaN) when totalMonthlyHrs is zero", () => {
    const coord = { hourlyWage: 22, adminHrsPerWeek: 0, participants: [] };
    const result = calcTSCCoordinator(coord, 22);
    expect(result.billableShare).toBe(0);
    expect(Number.isNaN(result.billableShare)).toBe(false);
  });

  it("calculates monthly labor with the given payroll burden", () => {
    const p = { unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false };
    const coord = { hourlyWage: 20, adminHrsPerWeek: 0, participants: [p] };
    const result = calcTSCCoordinator(coord, 22);
    const billableHrs = 16 / 4; // 4 hrs
    const expectedLabor = billableHrs * 20 * 1.22;
    expect(result.monthlyLabor).toBeCloseTo(expectedLabor, 2);
  });

  it("uses default burden of 22 when payrollBurdenPct is omitted", () => {
    const p = { unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false };
    const coord = { hourlyWage: 20, adminHrsPerWeek: 0, participants: [p] };
    expect(calcTSCCoordinator(coord).monthlyLabor).toBeCloseTo(
      calcTSCCoordinator(coord, 22).monthlyLabor,
      6
    );
  });

  it("adds admin hours to total monthly hours", () => {
    const coord = { hourlyWage: 22, adminHrsPerWeek: 10, participants: [] };
    const result = calcTSCCoordinator(coord, 22);
    const adminMonthly = 10 * 4.33;
    expect(result.totalMonthlyHrs).toBeCloseTo(adminMonthly, 2);
    expect(result.adminMonthly).toBeCloseTo(adminMonthly, 2);
  });

  it("utilization = totalMonthlyHrs / 160", () => {
    const p = { unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false };
    const coord = { hourlyWage: 22, adminHrsPerWeek: 5, participants: [p] };
    const result = calcTSCCoordinator(coord, 22);
    expect(result.utilization).toBeCloseTo(result.totalMonthlyHrs / 160, 6);
  });

  it("billableShare = monthlyBillable / totalMonthlyHrs", () => {
    const p = { unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false };
    const coord = { hourlyWage: 22, adminHrsPerWeek: 5, participants: [p] };
    const result = calcTSCCoordinator(coord, 22);
    expect(result.billableShare).toBeCloseTo(
      result.monthlyBillable / result.totalMonthlyHrs,
      6
    );
  });

  it("grossMargin = gross / annualRev when revenue > 0", () => {
    const p = { unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false };
    const coord = { hourlyWage: 22, adminHrsPerWeek: 5, participants: [p] };
    const result = calcTSCCoordinator(coord, 22);
    expect(result.grossMargin).toBeCloseTo(result.gross / result.annualRev, 6);
  });

  it("caseloadSize equals number of participants", () => {
    const p = { unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false };
    const coord = { hourlyWage: 22, adminHrsPerWeek: 5, participants: [p, p, p] };
    expect(calcTSCCoordinator(coord, 22).caseloadSize).toBe(3);
  });

  it("px array length matches participants length", () => {
    const p = { unitsCoord: 8, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false };
    const coord = { hourlyWage: 22, adminHrsPerWeek: 5, participants: [p, p] };
    expect(calcTSCCoordinator(coord, 22).px).toHaveLength(2);
  });

  it("annualRev = monthlyRev × 12", () => {
    const p = { unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false };
    const coord = { hourlyWage: 22, adminHrsPerWeek: 5, participants: [p] };
    const result = calcTSCCoordinator(coord, 22);
    expect(result.annualRev).toBeCloseTo(result.monthlyRev * 12, 6);
  });
});

// ──────────────────────────────────────────────────────────────────────
// calcTSCService
// ──────────────────────────────────────────────────────────────────────

describe("calcTSCService", () => {
  it("returns all-zero totals for empty coordinator list — no NaN", () => {
    const result = calcTSCService({ coordinators: [], payrollBurdenPct: 22 });
    expect(result.totalCaseload).toBe(0);
    expect(result.totalAnnualRev).toBe(0);
    expect(result.totalAnnualLabor).toBe(0);
    expect(result.totalGross).toBe(0);
    expect(Number.isNaN(result.totalMargin)).toBe(false);
    expect(result.totalMargin).toBe(0);
    expect(result.coordinatorCount).toBe(0);
  });

  it("coordinatorCount equals number of coordinators", () => {
    const p = { unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false };
    const coord = { hourlyWage: 22, adminHrsPerWeek: 5, participants: [p] };
    const result = calcTSCService({ coordinators: [coord, coord], payrollBurdenPct: 22 });
    expect(result.coordinatorCount).toBe(2);
  });

  it("totalAnnualRev sums across all coordinators", () => {
    const p = { unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false };
    const coord = { hourlyWage: 22, adminHrsPerWeek: 5, participants: [p] };
    const single = calcTSCCoordinator(coord, 22);
    const result = calcTSCService({ coordinators: [coord, coord], payrollBurdenPct: 22 });
    expect(result.totalAnnualRev).toBeCloseTo(single.annualRev * 2, 2);
  });

  it("totalAnnualLabor sums across all coordinators", () => {
    const p = { unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false };
    const coord = { hourlyWage: 22, adminHrsPerWeek: 5, participants: [p] };
    const single = calcTSCCoordinator(coord, 22);
    const result = calcTSCService({ coordinators: [coord, coord], payrollBurdenPct: 22 });
    expect(result.totalAnnualLabor).toBeCloseTo(single.annualLabor * 2, 2);
  });

  it("totalGross = totalAnnualRev - totalAnnualLabor", () => {
    const p = { unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false };
    const coord = { hourlyWage: 22, adminHrsPerWeek: 5, participants: [p] };
    const result = calcTSCService({ coordinators: [coord], payrollBurdenPct: 22 });
    expect(result.totalGross).toBeCloseTo(result.totalAnnualRev - result.totalAnnualLabor, 6);
  });

  it("totalMargin = totalGross / totalAnnualRev when revenue > 0", () => {
    const p = { unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false };
    const coord = { hourlyWage: 22, adminHrsPerWeek: 5, participants: [p] };
    const result = calcTSCService({ coordinators: [coord], payrollBurdenPct: 22 });
    expect(result.totalMargin).toBeCloseTo(result.totalGross / result.totalAnnualRev, 6);
  });

  it("totalCaseload sums participant counts across all coordinators", () => {
    const p = { unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false };
    const coord1 = { hourlyWage: 22, adminHrsPerWeek: 5, participants: [p, p] };
    const coord2 = { hourlyWage: 22, adminHrsPerWeek: 5, participants: [p] };
    const result = calcTSCService({ coordinators: [coord1, coord2], payrollBurdenPct: 22 });
    expect(result.totalCaseload).toBe(3);
  });

  it("each coordinator in the result has a metrics object", () => {
    const p = { unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false };
    const coord = { hourlyWage: 22, adminHrsPerWeek: 5, participants: [p] };
    const result = calcTSCService({ coordinators: [coord], payrollBurdenPct: 22 });
    expect(result.coordinators[0].metrics).toBeDefined();
    expect(result.coordinators[0].metrics.monthlyRev).toBeGreaterThan(0);
  });

  it("passes payrollBurdenPct down to each coordinator calculation", () => {
    const p = { unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false };
    const coord = { hourlyWage: 20, adminHrsPerWeek: 0, participants: [p] };
    const result0  = calcTSCService({ coordinators: [coord], payrollBurdenPct: 0 });
    const result30 = calcTSCService({ coordinators: [coord], payrollBurdenPct: 30 });
    // Higher burden → higher labor → lower gross
    expect(result30.totalGross).toBeLessThan(result0.totalGross);
  });

  it("does not mutate the input coordinator objects", () => {
    const p = { unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false };
    const coord = { hourlyWage: 22, adminHrsPerWeek: 5, participants: [p] };
    const inputCoordRef = coord;
    calcTSCService({ coordinators: [coord], payrollBurdenPct: 22 });
    expect(inputCoordRef).not.toHaveProperty("metrics"); // original object unchanged
  });
});

// ──────────────────────────────────────────────────────────────────────
// calcTSCAdminStaff
// ──────────────────────────────────────────────────────────────────────

describe("calcTSCAdminStaff", () => {
  it("returns zero totalAnnualCost for empty array", () => {
    const result = calcTSCAdminStaff([]);
    expect(result.totalAnnualCost).toBe(0);
    expect(result.staff).toHaveLength(0);
  });

  it("salary mode: annualBase = value × ftePct, annualCost includes benefitsPct", () => {
    const member = { mode: "salary", value: 55000, ftePct: 100, benefitsPct: 22 };
    const { staff } = calcTSCAdminStaff([member]);
    expect(staff[0].annualBase).toBeCloseTo(55000, 6);
    expect(staff[0].annualCost).toBeCloseTo(55000 * 1.22, 4);
  });

  it("hourly mode: annualBase = rate × 2080 × ftePct", () => {
    const member = { mode: "hourly", value: 25, ftePct: 100, benefitsPct: 22 };
    const { staff } = calcTSCAdminStaff([member]);
    expect(staff[0].annualBase).toBeCloseTo(25 * 2080, 6);
    expect(staff[0].annualCost).toBeCloseTo(25 * 2080 * 1.22, 4);
  });

  it("ftePct scales the base cost", () => {
    const full = calcTSCAdminStaff([{ mode: "salary", value: 60000, ftePct: 100, benefitsPct: 0 }]);
    const half = calcTSCAdminStaff([{ mode: "salary", value: 60000, ftePct: 50, benefitsPct: 0 }]);
    expect(half.staff[0].annualBase).toBeCloseTo(full.staff[0].annualBase / 2, 4);
  });

  it("totalAnnualCost sums across multiple staff members", () => {
    const m1 = { mode: "salary", value: 50000, ftePct: 100, benefitsPct: 0 };
    const m2 = { mode: "salary", value: 60000, ftePct: 100, benefitsPct: 0 };
    const { totalAnnualCost } = calcTSCAdminStaff([m1, m2]);
    expect(totalAnnualCost).toBeCloseTo(110000, 4);
  });

  it("uses defaults when fields are omitted (55000 salary, 100% FTE, 22% benefits)", () => {
    const { staff } = calcTSCAdminStaff([{ mode: "salary" }]);
    expect(staff[0].annualBase).toBeCloseTo(55000, 6);
    expect(staff[0].annualCost).toBeCloseTo(55000 * 1.22, 4);
  });
});

// ──────────────────────────────────────────────────────────────────────
// calcTSCRevenueWaterfall
// ──────────────────────────────────────────────────────────────────────

describe("calcTSCRevenueWaterfall", () => {
  it("authorized equals grossAuthorized", () => {
    expect(calcTSCRevenueWaterfall(100000).authorized).toBe(100000);
  });

  it("applies default rates: 92% completion, 97% billing, 99% collection", () => {
    const result = calcTSCRevenueWaterfall(100000);
    expect(result.earned).toBeCloseTo(100000 * 0.92, 4);
    expect(result.billed).toBeCloseTo(100000 * 0.92 * 0.97, 4);
    expect(result.collected).toBeCloseTo(100000 * 0.92 * 0.97 * 0.99, 4);
  });

  it("leakagePct = (authorized - collected) / authorized", () => {
    const result = calcTSCRevenueWaterfall(100000);
    expect(result.leakagePct).toBeCloseTo((100000 - result.collected) / 100000, 6);
  });

  it("leakagePct is 0 (not NaN) when grossAuthorized is 0", () => {
    const result = calcTSCRevenueWaterfall(0);
    expect(result.leakagePct).toBe(0);
    expect(Number.isNaN(result.leakagePct)).toBe(false);
  });

  it("accepts custom revenue rates", () => {
    const result = calcTSCRevenueWaterfall(100000, {
      completionRate: 100,
      billingSuccessRate: 100,
      collectionRate: 100,
    });
    expect(result.earned).toBeCloseTo(100000, 4);
    expect(result.collected).toBeCloseTo(100000, 4);
    expect(result.leakagePct).toBeCloseTo(0, 6);
  });
});

// ──────────────────────────────────────────────────────────────────────
// calcTSCProductivityFactors
// ──────────────────────────────────────────────────────────────────────

describe("calcTSCProductivityFactors", () => {
  it("default factors: effectiveBillablePct = 1 - 0.15 - 0.10 - 0.08 - 0.03 = 0.64", () => {
    const result = calcTSCProductivityFactors();
    expect(result.effectiveBillablePct).toBeCloseTo(0.64, 6);
  });

  it("netBillableHrsPerDay = billableHoursPerDay × effectiveBillablePct (default 6 × 0.64)", () => {
    const result = calcTSCProductivityFactors();
    expect(result.netBillableHrsPerDay).toBeCloseTo(6 * 0.64, 6);
  });

  it("accepts custom productivity values", () => {
    const result = calcTSCProductivityFactors({
      billableHoursPerDay:  8,
      documentationTimePct: 10,
      travelTimePct:        5,
      noShowPct:            5,
      qaReworkPct:          0,
    });
    expect(result.effectiveBillablePct).toBeCloseTo(0.80, 6);
    expect(result.netBillableHrsPerDay).toBeCloseTo(8 * 0.80, 6);
  });

  it("effectiveBillablePct never goes below 0 even when losses exceed 100%", () => {
    const result = calcTSCProductivityFactors({
      documentationTimePct: 50,
      travelTimePct:        50,
      noShowPct:            50,
      qaReworkPct:          50,
    });
    expect(result.effectiveBillablePct).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────
// calcTSCBreakEven
// ──────────────────────────────────────────────────────────────────────

describe("calcTSCBreakEven", () => {
  const emptyConfig = {
    coordinators: [],
    adminStaff: [],
    payrollBurdenPct: 22,
    defaultHourlyWage: 22,
    defaultAdminHrsPerWeek: 5,
  };

  it("returns null breakEvenCaseload when revenuePerParticipant is 0 (no participants)", () => {
    const result = calcTSCBreakEven(emptyConfig);
    expect(result.breakEvenCaseload).toBeNull();
    expect(result.revenuePerParticipant).toBe(0);
  });

  it("safetyMarginPct is null when breakEvenCaseload is null", () => {
    expect(calcTSCBreakEven(emptyConfig).safetyMarginPct).toBeNull();
  });

  it("currentCaseload equals total participants across all coordinators", () => {
    const p = { unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false };
    const config = {
      ...emptyConfig,
      coordinators: [{ id: "c1", hourlyWage: 22, adminHrsPerWeek: 5, participants: [p, p, p] }],
    };
    expect(calcTSCBreakEven(config).currentCaseload).toBe(3);
  });

  it("breakEvenCaseload = ceil(fixedCosts / revenuePerParticipant)", () => {
    const p = { unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false };
    const config = {
      ...emptyConfig,
      coordinators: [{ id: "c1", hourlyWage: 22, adminHrsPerWeek: 5, participants: [p, p, p] }],
    };
    const result = calcTSCBreakEven(config);
    expect(result.breakEvenCaseload).toBe(
      Math.ceil(result.fixedCosts / result.revenuePerParticipant)
    );
  });

  it("fixedCosts increases when admin staff are added", () => {
    const noStaff = calcTSCBreakEven(emptyConfig);
    const withStaff = calcTSCBreakEven({
      ...emptyConfig,
      adminStaff: [{ mode: "salary", value: 55000, ftePct: 100, benefitsPct: 22 }],
    });
    expect(withStaff.fixedCosts).toBeGreaterThan(noStaff.fixedCosts);
  });
});

// ──────────────────────────────────────────────────────────────────────
// calcTSCScenario
// ──────────────────────────────────────────────────────────────────────

describe("calcTSCScenario", () => {
  const p = { unitsCoord: 16, unitsPlanDev: 0, unitsCrisis: 0, isParapro: false };
  const baseConfig = {
    ...defaultTSCConfig(),
    coordinators: [{ id: "c1", hourlyWage: 22, adminHrsPerWeek: 5, participants: [p, p] }],
  };

  it("returns base, scenario, and delta objects", () => {
    const result = calcTSCScenario(baseConfig);
    expect(result).toHaveProperty("base");
    expect(result).toHaveProperty("scenario");
    expect(result).toHaveProperty("delta");
  });

  it("with no adjustments, scenario revenue equals base revenue", () => {
    const result = calcTSCScenario(baseConfig);
    expect(result.scenario.totalAnnualRev).toBeCloseTo(result.base.totalAnnualRev, 4);
  });

  it("rateAdjPct = 10 increases scenario revenue by 10%", () => {
    const config = { ...baseConfig, scenario: { ...baseConfig.scenario, rateAdjPct: 10 } };
    const result = calcTSCScenario(config);
    expect(result.scenario.totalAnnualRev).toBeCloseTo(result.base.totalAnnualRev * 1.1, 2);
  });

  it("rateAdjPct does not change labor cost (wages are unaffected by rate changes)", () => {
    const config = { ...baseConfig, scenario: { ...baseConfig.scenario, rateAdjPct: 20 } };
    const result = calcTSCScenario(config);
    expect(result.scenario.totalAnnualLabor).toBeCloseTo(result.base.totalAnnualLabor, 2);
  });

  it("delta.totalAnnualRev = scenario revenue minus base revenue", () => {
    const config = { ...baseConfig, scenario: { ...baseConfig.scenario, rateAdjPct: 15 } };
    const result = calcTSCScenario(config);
    expect(result.delta.totalAnnualRev).toBeCloseTo(
      result.scenario.totalAnnualRev - result.base.totalAnnualRev,
      4
    );
  });

  it("caseloadCount override scales units proportionally", () => {
    const config = { ...baseConfig, scenario: { ...baseConfig.scenario, caseloadCount: 4 } };
    const result = calcTSCScenario(config);
    // Caseload doubled from 2 to 4, so revenue should roughly double
    expect(result.scenario.totalAnnualRev).toBeGreaterThan(result.base.totalAnnualRev);
  });

  it("scenario.totalCaseload reflects caseloadCount override when set", () => {
    const config = { ...baseConfig, scenario: { ...baseConfig.scenario, caseloadCount: 5 } };
    const result = calcTSCScenario(config);
    expect(result.scenario.totalCaseload).toBe(5);
  });
});
