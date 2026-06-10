import { useState } from "react";
import { canSeeCompanyDollars, wageDisplayMode, canEditServiceLines } from '../lib/access';

// ─────────────────────────────────────────────────────────────────────────────
// Idaho School-Based Services rate table
// All rates are post-9/1/2025 4% reduction. Mixed billing units: therapies,
// CBRS, and the psych eval (90791) bill 15-minute units; psychotherapy
// (90832/34/37) bills per visit; transportation (A0080) bills per mile.
// Exported so the rate schedule tab can display and FinancialTool can reference.
// ─────────────────────────────────────────────────────────────────────────────
export const SCHOOL_RATE_TABLE = [
  { group: 'Behavioral Health',    key: 'psych_eval',     code: '90791', modifier: 'SCHOOL',    unit: '15min', description: 'Psychiatric Diagnostic Evaluation',  tier: 'Licensed clinician', defaultRate: 36.34 },
  { group: 'Behavioral Health',    key: 'psycho_30',      code: '90832', modifier: 'SCHOOL',    unit: 'visit', description: 'Psychotherapy 30 min',               tier: 'Licensed clinician', defaultRate: 68.96 },
  { group: 'Behavioral Health',    key: 'psycho_45',      code: '90834', modifier: 'SCHOOL',    unit: 'visit', description: 'Psychotherapy 45 min',               tier: 'Licensed clinician', defaultRate: 91.03 },
  { group: 'Behavioral Health',    key: 'psycho_60',      code: '90837', modifier: 'SCHOOL',    unit: 'visit', description: 'Psychotherapy 60 min',               tier: 'Licensed clinician', defaultRate: 134.77 },
  { group: 'Speech Therapy',       key: 'speech_asst',    code: '92507', modifier: 'HM',        unit: '15min', description: 'Speech/Hearing Therapy – Individual', tier: 'Assistant',          defaultRate: 13.69 },
  { group: 'Speech Therapy',       key: 'speech_prof',    code: '92507', modifier: 'HO',        unit: '15min', description: 'Speech/Hearing Therapy – Individual', tier: 'Professional',       defaultRate: 16.10 },
  { group: 'Physical Therapy',     key: 'pt_prof',        code: '97110', modifier: 'HO',        unit: '15min', description: 'Individual Physical Therapy',        tier: 'Professional',       defaultRate: 24.60 },
  { group: 'Physical Therapy',     key: 'pt_asst',        code: '97110', modifier: 'CQ',        unit: '15min', description: 'Individual Physical Therapy',        tier: 'PT Assistant',       defaultRate: 20.91 },
  { group: 'Occupational Therapy', key: 'ot_tech',        code: '97530', modifier: '',          unit: '15min', description: 'Individual Occupational Therapy',    tier: 'Tech',               defaultRate: 6.23 },
  { group: 'Occupational Therapy', key: 'ot_prof',        code: '97530', modifier: 'HO_S',      unit: '15min', description: 'Individual Occupational Therapy',    tier: 'Professional',       defaultRate: 29.33 },
  { group: 'CBRS Skills Building', key: 'cbrs_ind',       code: 'H2017', modifier: 'SCHOOL',    unit: '15min', description: 'Skills Building / CBRS – Individual', tier: 'CBRS Specialist',    defaultRate: 15.44 },
  { group: 'CBRS Skills Building', key: 'cbrs_grp',       code: 'H2017', modifier: 'SCHOOL_HQ', unit: '15min', description: 'Skills Building / CBRS – Group',      tier: 'CBRS Specialist',    defaultRate: 3.86 },
  { group: 'Transportation',       key: 'transport_mile', code: 'A0080', modifier: 'SCHOOL',    unit: 'mile',  description: 'Transportation by School',           tier: '—',                  defaultRate: 0.44 },
];

// Pre-built default rates object from the table
const _defaultRates = {};
SCHOOL_RATE_TABLE.forEach(r => { _defaultRates[r.key] = r.defaultRate; });

function effectiveRates(overrides = {}) {
  return { ..._defaultRates, ...overrides };
}

// ─────────────────────────────────────────────────────────────────────────────
// Discipline / credential tier registry
// A clinician's discipline + tier resolves to the 15-min therapy rate key.
// BEHAVIORAL bills per-visit psychotherapy + psych eval; CBRS bills the
// ind/grp skills-building keys — neither has a single therapy rate key.
// ─────────────────────────────────────────────────────────────────────────────
export const DISCIPLINES = {
  SPEECH: {
    label: 'Speech Therapy',
    tiers: {
      PROFESSIONAL: { label: 'Professional (HO)', therapyRateKey: 'speech_prof' },
      ASSISTANT:    { label: 'Assistant (HM)',    therapyRateKey: 'speech_asst' },
    },
  },
  PT: {
    label: 'Physical Therapy',
    tiers: {
      PROFESSIONAL: { label: 'Professional (HO)',  therapyRateKey: 'pt_prof' },
      ASSISTANT:    { label: 'PT Assistant (CQ)',  therapyRateKey: 'pt_asst' },
    },
  },
  OT: {
    label: 'Occupational Therapy',
    tiers: {
      PROFESSIONAL: { label: 'Professional (HO_S)', therapyRateKey: 'ot_prof' },
      TECH:         { label: 'Tech',                therapyRateKey: 'ot_tech' },
    },
  },
  BEHAVIORAL: {
    label: 'Behavioral Health',
    tiers: {
      PROFESSIONAL: { label: 'Licensed clinician', therapyRateKey: null },
    },
  },
  CBRS: {
    label: 'CBRS Skills Building',
    tiers: {
      SPECIALIST: { label: 'CBRS Specialist', therapyRateKey: null },
    },
  },
};

export function disciplineTiers(discipline) {
  return Object.keys(DISCIPLINES[discipline]?.tiers ?? {});
}

// Stale discipline/tier combos (e.g. after a discipline change) fall back to
// the discipline's first tier rather than billing nothing.
export function therapyRateKeyFor(discipline, tier) {
  const tiers = DISCIPLINES[discipline]?.tiers;
  if (!tiers) return null;
  return tiers[tier]?.therapyRateKey
      ?? Object.values(tiers)[0]?.therapyRateKey
      ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Factories
// ─────────────────────────────────────────────────────────────────────────────
let _sbUid = 0;
const sbUid = () => ++_sbUid;

export function mkStudent(name = 'New Student') {
  return {
    id: `sbs_${sbUid()}`,
    name,
    services: {
      therapy:   { hrPerWk: 1 },                              // SPEECH / PT / OT, 15-min units
      psycho:    { v30PerWk: 0, v45PerWk: 0, v60PerWk: 0 },   // per-visit psychotherapy
      psychEval: { unitsPerYear: 0 },                         // 90791, 15-min units (4 ≈ 1-hr eval)
      cbrsInd:   { hrPerWk: 0 },
      cbrsGrp:   { hrPerWk: 0, groupSize: 4 },
      transport: { milesPerWk: 0 },                           // revenue add-on, no clinician hours
    },
  };
}

export function mkClinician(name = 'New Clinician', discipline = 'SPEECH', tier = 'PROFESSIONAL', hourlyWage = 30) {
  return {
    id: `sbc_${sbUid()}`,
    name,
    discipline,
    tier,
    hourlyWage,
    adminHrsPerWeek: 5,
    schoolName: '',
    students: [],
  };
}

export function mkSchoolAdminStaffMember(role = 'Scheduler') {
  return {
    id: `sbadm_${sbUid()}`,
    role,
    mode: 'salary',   // 'salary' | 'hourly'
    value: 55000,
    ftePct: 100,
    benefitsPct: 22,
  };
}

export function defaultSchoolBasedConfig() {
  return {
    clinicians: [],
    schoolYear: { weeksPerYear: 36, esyWeeks: 0 },
    productivity: {
      billableHrsPerDay: 5,        // display-only
      absenceRate: 10,             // % — applied to revenue and service hours
      documentationTimePct: 15,    // display-only
      travelBetweenSchoolsPct: 10, // display-only
    },
    supervision: { count: 0, salary: 70000 },
    adminStaff: [],
    scenario: { rateAdjPct: 0, caseloadCount: null, productivityAdjPct: 0, weeksPerYear: null },
    payrollBurdenPct: 22,
    defaultHourlyWage: 30,
    defaultDiscipline: 'SPEECH',
    defaultTier: 'PROFESSIONAL',
    rateOverrides: {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Calculators
// All weekly figures annualize over the school year (weeksPerYear + esyWeeks),
// not 52 weeks. The absence rate kills billable sessions, so it scales both
// revenue and clinician service hours; admin hours are unaffected.
// ─────────────────────────────────────────────────────────────────────────────

export function schoolYearWeeks(schoolYear = {}) {
  return (schoolYear.weeksPerYear ?? 36) + (schoolYear.esyWeeks ?? 0);
}

export function calcSchoolStudent(s, clinician = {}, rates = _defaultRates, schoolYear = {}, productivity = {}) {
  const svc = s.services ?? {};
  const weeks = schoolYearWeeks(schoolYear);
  const attendance = 1 - (productivity.absenceRate ?? 10) / 100;
  const R = key => rates[key] ?? _defaultRates[key] ?? 0;

  // Discipline therapy (15-min units at the clinician's discipline+tier rate)
  const therapyKey = therapyRateKeyFor(clinician.discipline, clinician.tier);
  const therapyHrWk = therapyKey ? (svc.therapy?.hrPerWk ?? 0) : 0;
  const therapyRevWk = therapyHrWk * 4 * (therapyKey ? R(therapyKey) : 0);

  // Psychotherapy (per visit) — visit lengths fix the clinician time
  const v30 = svc.psycho?.v30PerWk ?? 0;
  const v45 = svc.psycho?.v45PerWk ?? 0;
  const v60 = svc.psycho?.v60PerWk ?? 0;
  const psychoRevWk = v30 * R('psycho_30') + v45 * R('psycho_45') + v60 * R('psycho_60');
  const psychoHrWk  = v30 * 0.5 + v45 * 0.75 + v60 * 1.0;

  // Psych eval (90791) — annual 15-min units, independent of weekly cadence
  const evalUnitsYr = svc.psychEval?.unitsPerYear ?? 0;
  const evalRevYr   = evalUnitsYr * R('psych_eval');
  const evalHrsYr   = evalUnitsYr / 4;

  // CBRS skills building — group hours bill in full but share clinician time
  const cbrsIndHrWk = svc.cbrsInd?.hrPerWk ?? 0;
  const cbrsGrpHrWk = svc.cbrsGrp?.hrPerWk ?? 0;
  const cbrsGrpSize = Math.max(1, svc.cbrsGrp?.groupSize ?? 4);
  const cbrsRevWk   = cbrsIndHrWk * 4 * R('cbrs_ind') + cbrsGrpHrWk * 4 * R('cbrs_grp');
  const cbrsHrWk    = cbrsIndHrWk + cbrsGrpHrWk / cbrsGrpSize;

  // Transportation — revenue only
  const milesWk = svc.transport?.milesPerWk ?? 0;
  const transportRevWk = milesWk * R('transport_mile');

  const weeklyRev = therapyRevWk + psychoRevWk + cbrsRevWk + transportRevWk;
  const annualRev = (weeklyRev * weeks + evalRevYr) * attendance;

  // Hours the student receives vs. clinician time required (groups shared)
  const billedHrsPerWk    = (therapyHrWk + psychoHrWk + cbrsIndHrWk + cbrsGrpHrWk + evalHrsYr / Math.max(1, weeks)) * attendance;
  const clinicianHrsPerWk = (therapyHrWk + psychoHrWk + cbrsHrWk + evalHrsYr / Math.max(1, weeks)) * attendance;

  return {
    weeklyRev,
    annualRev,
    billedHrsPerWk,
    clinicianHrsPerWk,
    milesPerWk: milesWk,
  };
}

export function calcSchoolClinician(cl, payrollBurdenPct = 22, rates = _defaultRates, schoolYear = {}, productivity = {}) {
  const sx = (cl.students ?? []).map(s => calcSchoolStudent(s, cl, rates, schoolYear, productivity));
  const weeks = schoolYearWeeks(schoolYear);

  const annualRev         = sx.reduce((a, s) => a + s.annualRev, 0);
  const weeklyServiceHrs  = sx.reduce((a, s) => a + s.clinicianHrsPerWk, 0);
  const weeklyBilledHrs   = sx.reduce((a, s) => a + s.billedHrsPerWk, 0);
  const adminHrsPerWeek   = cl.adminHrsPerWeek ?? 5;
  const weeklyHrs         = weeklyServiceHrs + adminHrsPerWeek;

  // Clinicians are hourly and paid for service weeks only (school year + ESY)
  const burden      = 1 + (payrollBurdenPct ?? 22) / 100;
  const annualLabor = weeklyHrs * weeks * (cl.hourlyWage ?? 30) * burden;
  const gross       = annualRev - annualLabor;

  return {
    sx,
    caseloadSize: (cl.students ?? []).length,
    annualRev,
    weeklyServiceHrs,
    weeklyBilledHrs,
    adminHrsPerWeek,
    weeklyHrs,
    annualLabor,
    gross,
    grossMargin:   annualRev > 0 ? gross / annualRev : 0,
    utilization:   weeklyHrs / 40,
    billableShare: weeklyHrs > 0 ? weeklyServiceHrs / weeklyHrs : 0,
  };
}

export function calcSchoolAdminStaff(adminStaff = []) {
  const staff = adminStaff.map(m => {
    const annualBase = m.mode === 'salary'
      ? (m.value ?? 55000) * ((m.ftePct ?? 100) / 100)
      : (m.value ?? 25) * 2080 * ((m.ftePct ?? 100) / 100);
    const annualCost = annualBase * (1 + (m.benefitsPct ?? 22) / 100);
    return { ...m, annualBase, annualCost };
  });
  return { staff, totalAnnualCost: staff.reduce((a, s) => a + s.annualCost, 0) };
}

export function calcSchoolBasedService(config = {}) {
  const payrollBurdenPct = config.payrollBurdenPct ?? 22;
  const rates        = effectiveRates(config.rateOverrides ?? {});
  const schoolYear   = config.schoolYear ?? {};
  const productivity = config.productivity ?? {};

  const clinicians = (config.clinicians ?? []).map(cl => ({
    ...cl,
    metrics: calcSchoolClinician(cl, payrollBurdenPct, rates, schoolYear, productivity),
  }));

  const totalCaseload  = clinicians.reduce((a, cl) => a + cl.metrics.caseloadSize, 0);
  const totalAnnualRev = clinicians.reduce((a, cl) => a + cl.metrics.annualRev, 0);
  const totalAnnualLab = clinicians.reduce((a, cl) => a + cl.metrics.annualLabor, 0);

  const sup = config.supervision ?? { count: 0, salary: 70000 };
  const supervisionCost = (sup.count ?? 0) * (sup.salary ?? 70000) * (1 + payrollBurdenPct / 100);
  const adminStaffCost  = calcSchoolAdminStaff(config.adminStaff ?? []).totalAnnualCost;

  const totalGross = totalAnnualRev - totalAnnualLab - supervisionCost - adminStaffCost;

  return {
    clinicians,
    clinicianCount: clinicians.length,
    totalCaseload,
    totalAnnualRev,
    totalAnnualLabor: totalAnnualLab,
    supervisionCost,
    adminStaffCost,
    totalGross,
    totalMargin: totalAnnualRev > 0 ? totalGross / totalAnnualRev : 0,
    weeks: schoolYearWeeks(schoolYear),
  };
}

export function calcSchoolScenario(config = {}) {
  const base = calcSchoolBasedService(config);

  const sc = config.scenario ?? {};
  const rateAdj = 1 + (sc.rateAdjPct ?? 0) / 100;
  const caseloadAdj = (sc.caseloadCount != null && base.totalCaseload > 0)
    ? sc.caseloadCount / base.totalCaseload
    : 1;
  const productivityAdj = 1 + (sc.productivityAdjPct ?? 0) / 100;
  const volAdj = caseloadAdj * productivityAdj;

  const scaleStudent = s => ({
    ...s,
    services: {
      ...(s.services ?? {}),
      therapy:   { ...(s.services?.therapy ?? {}),   hrPerWk:      (s.services?.therapy?.hrPerWk ?? 0) * volAdj },
      psycho:    { ...(s.services?.psycho ?? {}),
                   v30PerWk: (s.services?.psycho?.v30PerWk ?? 0) * volAdj,
                   v45PerWk: (s.services?.psycho?.v45PerWk ?? 0) * volAdj,
                   v60PerWk: (s.services?.psycho?.v60PerWk ?? 0) * volAdj },
      psychEval: { ...(s.services?.psychEval ?? {}), unitsPerYear: (s.services?.psychEval?.unitsPerYear ?? 0) * volAdj },
      cbrsInd:   { ...(s.services?.cbrsInd ?? {}),   hrPerWk:      (s.services?.cbrsInd?.hrPerWk ?? 0) * volAdj },
      cbrsGrp:   { ...(s.services?.cbrsGrp ?? {}),   hrPerWk:      (s.services?.cbrsGrp?.hrPerWk ?? 0) * volAdj },
      transport: { ...(s.services?.transport ?? {}), milesPerWk:   (s.services?.transport?.milesPerWk ?? 0) * volAdj },
    },
  });

  const scenarioConfig = {
    ...config,
    schoolYear: sc.weeksPerYear != null
      ? { ...(config.schoolYear ?? {}), weeksPerYear: sc.weeksPerYear }
      : config.schoolYear,
    clinicians: (config.clinicians ?? []).map(cl => ({
      ...cl,
      students: (cl.students ?? []).map(scaleStudent),
    })),
  };

  // Rate adjustment scales revenue only; labor is wage-driven and unchanged
  const run = calcSchoolBasedService(scenarioConfig);
  const scenarioAnnualRev = run.totalAnnualRev * rateAdj;
  const scenarioGross     = scenarioAnnualRev - run.totalAnnualLabor - run.supervisionCost - run.adminStaffCost;

  const scenario = {
    totalAnnualRev:   scenarioAnnualRev,
    totalAnnualLabor: run.totalAnnualLabor,
    totalGross:       scenarioGross,
    totalMargin:      scenarioAnnualRev > 0 ? scenarioGross / scenarioAnnualRev : 0,
    clinicianCount:   run.clinicianCount,
    totalCaseload:    sc.caseloadCount ?? run.totalCaseload,
    weeks:            run.weeks,
  };

  const delta = {
    totalAnnualRev:   scenario.totalAnnualRev - base.totalAnnualRev,
    totalAnnualLabor: scenario.totalAnnualLabor - base.totalAnnualLabor,
    totalGross:       scenario.totalGross - base.totalGross,
    totalMargin:      scenario.totalMargin - base.totalMargin,
  };

  return { base, scenario, delta };
}
