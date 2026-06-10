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

// ─────────────────────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────────────────────
const $k  = n => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const $r  = n => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = n => `${(n * 100).toFixed(1)}%`;
const M   = { fontFamily: "'DM Mono',monospace" };

const card = {
  background: "#ffffff", borderRadius: 10, padding: 14,
  border: "1px solid #d0dae8", boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
};

const labelStyle = {
  fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.5, ...M,
};

const numInput = {
  width: 60, padding: "3px 6px", border: "1px solid #c8d4e4",
  borderRadius: 5, fontSize: 12, ...M, textAlign: "right", background: "#fff",
};

const textInput = {
  padding: "4px 8px", border: "1px solid #c8d4e4",
  borderRadius: 5, fontSize: 13, fontFamily: "'Sora',sans-serif", background: "#fff",
};

function Stat({ label, value, color = "#5a3800" }) {
  return (
    <div style={{ background: "#eef1f6", borderRadius: 7, padding: "6px 12px", border: "1px solid #d0dae8" }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color, ...M, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function SvcInput({ label, value, onChange, step = 0.5, max = 40, sublabel, ro = false }) {
  return (
    <div style={{ minWidth: 70 }}>
      <div style={labelStyle}>{label}</div>
      {sublabel && <div style={{ fontSize: 8, color: "#94a3b8", ...M }}>{sublabel}</div>}
      <input type="number" min={0} max={max} step={step}
        value={value}
        onChange={e => onChange(+e.target.value)}
        readOnly={ro}
        style={{ ...numInput, pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>
    </div>
  );
}

const disciplineLabel = d => DISCIPLINES[d]?.label ?? d;
const tierLabel = (d, t) => DISCIPLINES[d]?.tiers?.[t]?.label ?? t;

// ─────────────────────────────────────────────────────────────────────────────
// Expandable student row — service sections render by clinician discipline
// ─────────────────────────────────────────────────────────────────────────────
function SchoolStudentRow({ s, clinician, rates, schoolYear, productivity, onUpdate, onRemove, userRole, canEdit }) {
  const [expanded, setExpanded] = useState(false);
  const m   = calcSchoolStudent(s, clinician, rates, schoolYear, productivity);
  const svc = s.services ?? {};
  const ro  = !canEdit;
  const d   = clinician.discipline;

  const upd = (field, partial) => onUpdate(s.id, "services", { ...svc, [field]: { ...(svc[field] ?? {}), ...partial } });

  return (
    <div style={{ borderRadius: 6, background: "#f7f9fc", border: "1px solid #e2e8f0", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px" }}>
        <button onClick={() => setExpanded(e => !e)} style={{
          border: "none", background: "transparent", cursor: "pointer",
          fontSize: 12, color: "#5a3800", width: 18, flexShrink: 0,
        }}>{expanded ? "▼" : "▶"}</button>
        <input type="text" value={s.name}
          onChange={e => onUpdate(s.id, "name", e.target.value)}
          readOnly={ro}
          style={{ ...textInput, flex: 1, fontSize: 12, minWidth: 100, pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {canSeeCompanyDollars(userRole) && <div style={{ fontSize: 13, fontWeight: 700, color: "#5a3800", ...M }}>{$k(m.annualRev)}/yr</div>}
          <div style={{ fontSize: 9, color: "#64748b", ...M }}>
            {m.billedHrsPerWk.toFixed(1)} billed · {m.clinicianHrsPerWk.toFixed(1)} clin hr/wk
          </div>
        </div>
        {canEdit && <button onClick={() => onRemove(s.id)} style={{
          border: "none", background: "transparent", cursor: "pointer",
          color: "#cf6e6e", fontSize: 14, padding: 4, flexShrink: 0,
        }}>✕</button>}
        {!canEdit && <span style={{ width: 22, flexShrink: 0 }}/>}
      </div>

      {expanded && (
        <div style={{ padding: "0 10px 14px 36px", borderTop: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, paddingTop: 12 }}>

            {(d === 'SPEECH' || d === 'PT' || d === 'OT') && (
              <div>
                <div style={{ ...labelStyle, color: "#3b5fc0", marginBottom: 6 }}>{disciplineLabel(d)} (15-min units)</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <SvcInput label="Therapy hr/wk" ro={ro}
                    value={svc.therapy?.hrPerWk ?? 0} max={20}
                    onChange={v => upd("therapy", { hrPerWk: v })}/>
                </div>
              </div>
            )}

            {d === 'BEHAVIORAL' && (
              <>
                <div>
                  <div style={{ ...labelStyle, color: "#3b5fc0", marginBottom: 6 }}>Psychotherapy (per visit)</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <SvcInput label="30-min visits/wk" sublabel="90832" ro={ro}
                      value={svc.psycho?.v30PerWk ?? 0} max={10} step={1}
                      onChange={v => upd("psycho", { v30PerWk: v })}/>
                    <SvcInput label="45-min visits/wk" sublabel="90834" ro={ro}
                      value={svc.psycho?.v45PerWk ?? 0} max={10} step={1}
                      onChange={v => upd("psycho", { v45PerWk: v })}/>
                    <SvcInput label="60-min visits/wk" sublabel="90837" ro={ro}
                      value={svc.psycho?.v60PerWk ?? 0} max={10} step={1}
                      onChange={v => upd("psycho", { v60PerWk: v })}/>
                  </div>
                </div>
                <div>
                  <div style={{ ...labelStyle, color: "#3b5fc0", marginBottom: 6 }}>Psych Eval (90791)</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <SvcInput label="Eval units/yr" sublabel="4 ≈ 1-hr eval" ro={ro}
                      value={svc.psychEval?.unitsPerYear ?? 0} max={24} step={1}
                      onChange={v => upd("psychEval", { unitsPerYear: v })}/>
                  </div>
                </div>
              </>
            )}

            {d === 'CBRS' && (
              <div>
                <div style={{ ...labelStyle, color: "#3b5fc0", marginBottom: 6 }}>Skills Building / CBRS (H2017)</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <SvcInput label="CBRS Ind hr/wk" ro={ro}
                    value={svc.cbrsInd?.hrPerWk ?? 0} max={20}
                    onChange={v => upd("cbrsInd", { hrPerWk: v })}/>
                  <SvcInput label="CBRS Grp hr/wk" ro={ro}
                    value={svc.cbrsGrp?.hrPerWk ?? 0} max={20}
                    onChange={v => upd("cbrsGrp", { hrPerWk: v })}/>
                  <SvcInput label="Group size" sublabel="students" ro={ro}
                    value={svc.cbrsGrp?.groupSize ?? 4} max={12} step={1}
                    onChange={v => upd("cbrsGrp", { groupSize: Math.max(1, v) })}/>
                </div>
              </div>
            )}

            <div>
              <div style={{ ...labelStyle, color: "#3b5fc0", marginBottom: 6 }}>Transportation (A0080)</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <SvcInput label="Miles/wk" sublabel="per mile" ro={ro}
                  value={svc.transport?.milesPerWk ?? 0} max={500} step={1}
                  onChange={v => upd("transport", { milesPerWk: v })}/>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Clinician card
// ─────────────────────────────────────────────────────────────────────────────
function SchoolClinicianCard({ cl, payrollBurdenPct, rates, schoolYear, productivity, onUpdate, onRemove, onAddStudent, onUpdateStudent, onRemoveStudent, userRole, canEdit }) {
  const [expanded, setExpanded] = useState(true);
  const m = calcSchoolClinician(cl, payrollBurdenPct, rates, schoolYear, productivity);
  const ro = !canEdit;

  const utilColor   = m.utilization > 1.05 ? "#cf6e6e" : m.utilization > 0.85 ? "#22c55e" : m.utilization > 0.65 ? "#f59e0b" : "#cf6e6e";
  const marginColor = m.grossMargin > 0.35 ? "#22c55e" : m.grossMargin > 0.15 ? "#f59e0b" : "#cf6e6e";

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <button onClick={() => setExpanded(e => !e)} style={{
          border: "none", background: "transparent", cursor: "pointer",
          fontSize: 14, color: "#5a3800", width: 20,
        }}>{expanded ? "▼" : "▶"}</button>

        <input type="text" value={cl.name}
          onChange={e => onUpdate(cl.id, { name: e.target.value })}
          readOnly={ro}
          style={{ ...textInput, fontWeight: 700, flex: 1, minWidth: 120, fontSize: 14, pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>

        <div>
          <div style={labelStyle}>Discipline</div>
          <select value={cl.discipline}
            onChange={e => onUpdate(cl.id, { discipline: e.target.value, tier: disciplineTiers(e.target.value)[0] })}
            disabled={ro}
            style={{ ...textInput, fontSize: 11, padding: "3px 6px", pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}>
            {Object.keys(DISCIPLINES).map(d => <option key={d} value={d}>{disciplineLabel(d)}</option>)}
          </select>
        </div>

        <div>
          <div style={labelStyle}>Tier</div>
          <select value={cl.tier}
            onChange={e => onUpdate(cl.id, { tier: e.target.value })}
            disabled={ro}
            style={{ ...textInput, fontSize: 11, padding: "3px 6px", pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}>
            {disciplineTiers(cl.discipline).map(t => <option key={t} value={t}>{tierLabel(cl.discipline, t)}</option>)}
          </select>
        </div>

        {wageDisplayMode(userRole) !== 'hidden' && (
          <div>
            <div style={labelStyle}>Wage / hr</div>
            <input type="number" min={10} max={120} step={0.5} value={cl.hourlyWage}
              onChange={e => onUpdate(cl.id, { hourlyWage: +e.target.value })}
              readOnly={wageDisplayMode(userRole) !== 'dollars' || ro}
              style={{ ...numInput, pointerEvents: (wageDisplayMode(userRole) !== 'dollars' || ro) ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>
          </div>
        )}

        <div>
          <div style={labelStyle}>Admin hr/wk</div>
          <input type="number" min={0} max={40} step={0.5} value={cl.adminHrsPerWeek ?? 5}
            onChange={e => onUpdate(cl.id, { adminHrsPerWeek: +e.target.value })}
            readOnly={ro}
            style={{ ...numInput, width: 48, pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>
        </div>

        <div>
          <div style={labelStyle}>School</div>
          <input type="text" value={cl.schoolName ?? ''}
            onChange={e => onUpdate(cl.id, { schoolName: e.target.value })}
            readOnly={ro}
            placeholder="optional"
            style={{ ...textInput, width: 90, fontSize: 11, pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>
        </div>

        {canEdit && <button onClick={() => onRemove(cl.id)} style={{
          border: "1px solid #e8d4d4", background: "#fff5f5",
          color: "#a14848", padding: "4px 10px", borderRadius: 5,
          fontSize: 10, cursor: "pointer", ...M,
        }}>Remove</button>}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: expanded ? 12 : 0 }}>
        <Stat label="Caseload"        value={m.caseloadSize} />
        {canSeeCompanyDollars(userRole) && <Stat label="Annual Rev"   value={$k(m.annualRev)} color="#D4A520"/>}
        {canSeeCompanyDollars(userRole) && <Stat label="Annual Labor" value={$k(m.annualLabor)} />}
        {canSeeCompanyDollars(userRole) && <Stat label="Gross"        value={$k(m.gross)} color={marginColor}/>}
        <Stat label="Margin"          value={pct(m.grossMargin)} color={marginColor}/>
        <Stat label="Utilization"     value={pct(m.utilization)} color={utilColor}/>
        <Stat label="Billable share"  value={pct(m.billableShare)} />
      </div>

      {expanded && (
        <div>
          <div style={{ fontSize: 9, color: "#94a3b8", ...M, marginBottom: 6, marginLeft: 2 }}>
            Service inputs match the clinician's discipline; CBRS group hours use group efficiency (group hrs ÷ group size). Click ▶ on a student to edit services.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(cl.students ?? []).map(s =>
              <SchoolStudentRow key={s.id} s={s} clinician={cl} rates={rates}
                schoolYear={schoolYear} productivity={productivity}
                onUpdate={(id, f, v) => onUpdateStudent(cl.id, id, f, v)}
                onRemove={(id) => onRemoveStudent(cl.id, id)}
                userRole={userRole}
                canEdit={canEdit}/>
            )}
          </div>
          {canEdit && <button onClick={() => onAddStudent(cl.id)} style={{
            marginTop: 10, padding: "6px 14px",
            background: "#fff", border: "1px dashed #c8d4e4", borderRadius: 6,
            color: "#5a3800", cursor: "pointer", fontSize: 12, fontWeight: 600, ...M,
          }}>+ Add student</button>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Roster tab
// ─────────────────────────────────────────────────────────────────────────────
export function SchoolBasedRosterTab({ config, onUpdate, userRole }) {
  const summary  = calcSchoolBasedService(config);
  const rates    = effectiveRates(config.rateOverrides ?? {});
  const canEdit  = canEditServiceLines(userRole);
  const ro       = !canEdit;

  const clinicians   = config.clinicians ?? [];
  const schoolYear   = config.schoolYear ?? {};
  const productivity = config.productivity ?? {};

  const updateField = (field, value) => onUpdate({ ...config, [field]: value });

  const updateClinician = (clId, partial) =>
    onUpdate({ ...config, clinicians: clinicians.map(cl => cl.id === clId ? { ...cl, ...partial } : cl) });

  const removeClinician = (clId) =>
    onUpdate({ ...config, clinicians: clinicians.filter(cl => cl.id !== clId) });

  const addClinician = () =>
    onUpdate({
      ...config,
      clinicians: [
        ...clinicians,
        mkClinician(`Clinician ${clinicians.length + 1}`, config.defaultDiscipline ?? 'SPEECH', config.defaultTier ?? 'PROFESSIONAL', config.defaultHourlyWage ?? 30),
      ],
    });

  const addStudent = (clId) =>
    onUpdate({
      ...config,
      clinicians: clinicians.map(cl =>
        cl.id === clId
          ? { ...cl, students: [...(cl.students ?? []), mkStudent(`Student ${(cl.students ?? []).length + 1}`)] }
          : cl
      ),
    });

  const updateStudent = (clId, sId, field, value) =>
    onUpdate({
      ...config,
      clinicians: clinicians.map(cl =>
        cl.id === clId
          ? { ...cl, students: (cl.students ?? []).map(s => s.id === sId ? { ...s, [field]: value } : s) }
          : cl
      ),
    });

  const removeStudent = (clId, sId) =>
    onUpdate({
      ...config,
      clinicians: clinicians.map(cl =>
        cl.id === clId
          ? { ...cl, students: (cl.students ?? []).filter(s => s.id !== sId) }
          : cl
      ),
    });

  const sup = config.supervision ?? { count: 0, salary: 70000 };
  const updateSup = (field, val) => updateField("supervision", { ...sup, [field]: val });
  const updateYear = (field, val) => updateField("schoolYear", { ...schoolYear, [field]: val });

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <Stat label="Clinicians"     value={summary.clinicianCount} />
        <Stat label="Total caseload" value={summary.totalCaseload} />
        <Stat label="Service weeks"  value={summary.weeks} />
        {canSeeCompanyDollars(userRole) && <Stat label="Annual Rev"   value={$k(summary.totalAnnualRev)} color="#D4A520"/>}
        {canSeeCompanyDollars(userRole) && <Stat label="Direct Labor" value={$k(summary.totalAnnualLabor)} />}
        {canSeeCompanyDollars(userRole) && <Stat label="Gross"        value={$k(summary.totalGross)} color={summary.totalMargin > 0.25 ? "#22c55e" : "#cf6e6e"}/>}
        <Stat label="Margin"         value={pct(summary.totalMargin)} color={summary.totalMargin > 0.25 ? "#22c55e" : "#cf6e6e"}/>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <span style={labelStyle}>Burden %</span>
          <input type="number" min={0} max={50} step={0.5} value={config.payrollBurdenPct ?? 22}
            onChange={e => updateField("payrollBurdenPct", +e.target.value)}
            readOnly={ro}
            style={{ ...numInput, pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>
        </div>
      </div>

      {/* School year & supervision settings */}
      <div style={{ ...card, marginBottom: 16, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ ...labelStyle, fontSize: 10 }}>School Year</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={labelStyle}>Weeks / year</span>
          <input type="number" min={10} max={45} value={schoolYear.weeksPerYear ?? 36}
            onChange={e => updateYear("weeksPerYear", +e.target.value)}
            readOnly={ro}
            style={{ ...numInput, width: 48, pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={labelStyle}>ESY weeks</span>
          <input type="number" min={0} max={12} value={schoolYear.esyWeeks ?? 0}
            onChange={e => updateYear("esyWeeks", +e.target.value)}
            readOnly={ro}
            style={{ ...numInput, width: 48, pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>
        </div>
        <span style={{ ...labelStyle, fontSize: 10, marginLeft: 10 }}>Clinical Supervision</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={labelStyle}>Supervisors</span>
          <input type="number" min={0} max={20} value={sup.count ?? 0}
            onChange={e => updateSup("count", +e.target.value)}
            readOnly={ro}
            style={{ ...numInput, width: 48, pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={labelStyle}>Supervisor salary</span>
          <input type="number" min={30000} max={200000} step={1000} value={sup.salary ?? 70000}
            onChange={e => updateSup("salary", +e.target.value)}
            readOnly={ro}
            style={{ ...numInput, width: 80, pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>
        </div>
        {canSeeCompanyDollars(userRole) && (sup.count ?? 0) > 0 && (
          <div style={{ fontSize: 10, color: "#64748b", ...M }}>
            Annual cost: {$k((sup.count ?? 0) * (sup.salary ?? 70000) * (1 + (config.payrollBurdenPct ?? 22) / 100))}
          </div>
        )}
      </div>

      {/* Clinician cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {clinicians.length === 0 && (
          <div style={{ ...card, textAlign: "center", padding: 40, color: "#64748b" }}>
            <div style={{ fontSize: 13, marginBottom: 8 }}>No clinicians yet.</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Add a clinician to start building your school-based caseload model.</div>
          </div>
        )}
        {clinicians.map(cl =>
          <SchoolClinicianCard key={cl.id} cl={cl}
            payrollBurdenPct={config.payrollBurdenPct}
            rates={rates}
            schoolYear={schoolYear}
            productivity={productivity}
            onUpdate={updateClinician}
            onRemove={removeClinician}
            onAddStudent={addStudent}
            onUpdateStudent={updateStudent}
            onRemoveStudent={removeStudent}
            userRole={userRole}
            canEdit={canEdit}/>
        )}
      </div>

      {canEdit && <button onClick={addClinician} style={{
        marginTop: 16, padding: "8px 18px",
        background: "#D4A520", border: "none", borderRadius: 6,
        color: "#5a3800", cursor: "pointer", fontSize: 12, fontWeight: 700, ...M,
      }}>+ Add clinician</button>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Productivity tab
// ─────────────────────────────────────────────────────────────────────────────
export function SchoolBasedProductivityTab({ config, userRole }) {
  const summary = calcSchoolBasedService(config);
  const prod    = config.productivity ?? {};

  if (summary.clinicianCount === 0) {
    return (
      <div style={{ ...card, textAlign: "center", padding: 40, color: "#64748b" }}>
        <div style={{ fontSize: 13 }}>Add clinicians in the Roster tab to see productivity analysis.</div>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ ...M, fontSize: 14, color: "#5a3800", margin: "0 0 14px 0", letterSpacing: 1, textTransform: "uppercase" }}>
        Clinician productivity
      </h3>

      <div style={{ ...card, marginBottom: 16, display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={labelStyle}>Billable hrs / day assumption</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#5a3800", ...M }}>{prod.billableHrsPerDay ?? 5}</div>
        </div>
        <div>
          <div style={labelStyle}>Student absence rate</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b", ...M }}>{prod.absenceRate ?? 10}%</div>
        </div>
        <div>
          <div style={labelStyle}>Documentation time</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#64748b", ...M }}>{prod.documentationTimePct ?? 15}%</div>
        </div>
        <div>
          <div style={labelStyle}>Travel between schools</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#64748b", ...M }}>{prod.travelBetweenSchoolsPct ?? 10}%</div>
        </div>
        <div>
          <div style={labelStyle}>Effective billable %</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#22c55e", ...M }}>
            {(100 - (prod.absenceRate ?? 10) - (prod.documentationTimePct ?? 15) - (prod.travelBetweenSchoolsPct ?? 10)).toFixed(0)}%
          </div>
        </div>
        <div>
          <div style={labelStyle}>Service weeks / year</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#5a3800", ...M }}>{summary.weeks}</div>
        </div>
      </div>

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1.6fr 1.1fr 0.8fr 1fr 1fr 1fr 0.8fr 0.8fr",
          padding: "10px 14px", background: "#eef1f6", borderBottom: "1px solid #d0dae8", ...labelStyle,
        }}>
          <span>Clinician</span>
          <span style={{ textAlign: "right" }}>Discipline</span>
          <span style={{ textAlign: "right" }}>Caseload</span>
          <span style={{ textAlign: "right" }}>Billed hr/wk</span>
          <span style={{ textAlign: "right" }}>Svc hr/wk</span>
          <span style={{ textAlign: "right" }}>Total hr/wk</span>
          <span style={{ textAlign: "right" }}>Utilization</span>
          <span style={{ textAlign: "right" }}>Margin</span>
        </div>
        {summary.clinicians.map(cl => {
          const utilColor   = cl.metrics.utilization > 1.05 ? "#cf6e6e" : cl.metrics.utilization > 0.85 ? "#22c55e" : cl.metrics.utilization > 0.65 ? "#f59e0b" : "#cf6e6e";
          const marginColor = cl.metrics.grossMargin > 0.35 ? "#22c55e" : cl.metrics.grossMargin > 0.15 ? "#f59e0b" : "#cf6e6e";
          return (
            <div key={cl.id} style={{
              display: "grid", gridTemplateColumns: "1.6fr 1.1fr 0.8fr 1fr 1fr 1fr 0.8fr 0.8fr",
              padding: "10px 14px", borderBottom: "1px solid #f1f5f9", alignItems: "center", fontSize: 12, ...M,
            }}>
              <span style={{ color: "#5a3800", fontWeight: 600 }}>{cl.name}</span>
              <span style={{ textAlign: "right", fontSize: 10, color: "#475569" }}>{disciplineLabel(cl.discipline)} · {tierLabel(cl.discipline, cl.tier)}</span>
              <span style={{ textAlign: "right", color: "#334155" }}>{cl.metrics.caseloadSize}</span>
              <span style={{ textAlign: "right", color: "#334155" }}>{cl.metrics.weeklyBilledHrs.toFixed(1)}</span>
              <span style={{ textAlign: "right", color: "#334155" }}>{cl.metrics.weeklyServiceHrs.toFixed(1)}</span>
              <span style={{ textAlign: "right", color: "#334155" }}>{cl.metrics.weeklyHrs.toFixed(1)}</span>
              <span style={{ textAlign: "right", color: utilColor, fontWeight: 700 }}>{pct(cl.metrics.utilization)}</span>
              <span style={{ textAlign: "right", color: marginColor, fontWeight: 700 }}>{pct(cl.metrics.grossMargin)}</span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, padding: 14, background: "#fffbe8", border: "1px solid #f4e4a8", borderRadius: 8, fontSize: 11, color: "#5a3800", ...M, lineHeight: 1.6 }}>
        <strong>School-year note:</strong> All annual figures are annualized over {summary.weeks} service weeks
        ({config.schoolYear?.weeksPerYear ?? 36} school weeks{(config.schoolYear?.esyWeeks ?? 0) > 0 ? ` + ${config.schoolYear.esyWeeks} ESY weeks` : ''}), not 52.
        The student absence rate ({prod.absenceRate ?? 10}%) directly reduces billable sessions and is applied to revenue and service hours.
      </div>
      <div style={{ marginTop: 10, padding: 12, background: "#f7f9fc", border: "1px solid #d0dae8", borderRadius: 8, fontSize: 10, color: "#64748b", ...M }}>
        <strong>Hours note:</strong> "Svc hr/wk" is clinician time after CBRS group efficiency (group hrs ÷ group size);
        "Billed hr/wk" is what students receive, which drives revenue. Utilization compares total weekly hours
        (service + admin) against a 40-hour week.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// P&L tab (with optional school grouping)
// ─────────────────────────────────────────────────────────────────────────────
export function SchoolBasedPLTab({ config, userRole }) {
  const summary     = calcSchoolBasedService(config);
  const showDollars = canSeeCompanyDollars(userRole);

  if (summary.clinicianCount === 0) {
    return (
      <div style={{ ...card, textAlign: "center", padding: 40, color: "#64748b" }}>
        <div style={{ fontSize: 13 }}>Add clinicians in the Roster tab to see P&amp;L.</div>
      </div>
    );
  }

  const schools = {};
  summary.clinicians.forEach(cl => {
    const key = cl.schoolName?.trim() || '— Unassigned —';
    (schools[key] = schools[key] || []).push(cl);
  });
  const isMultiSchool = Object.keys(schools).some(k => k !== '— Unassigned —');

  const cols = showDollars ? "2fr 1fr 1fr 1fr 1fr" : "2fr 1fr";
  const rowStyle = {
    display: "grid", gridTemplateColumns: cols,
    padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 12, ...M,
  };

  const renderClinicianRow = (cl) => (
    <div key={cl.id} style={rowStyle}>
      <span style={{ color: "#5a3800", fontWeight: 600 }}>{cl.name}
        <span style={{ fontSize: 9, color: "#94a3b8", marginLeft: 6 }}>{disciplineLabel(cl.discipline)} · {tierLabel(cl.discipline, cl.tier)}</span>
      </span>
      {showDollars && <span style={{ textAlign: "right", color: "#D4A520" }}>{$k(cl.metrics.annualRev)}</span>}
      {showDollars && <span style={{ textAlign: "right", color: "#334155" }}>{$k(cl.metrics.annualLabor)}</span>}
      {showDollars && <span style={{ textAlign: "right", color: cl.metrics.gross > 0 ? "#22c55e" : "#cf6e6e" }}>{$k(cl.metrics.gross)}</span>}
      <span style={{ textAlign: "right", color: cl.metrics.grossMargin > 0.3 ? "#22c55e" : cl.metrics.grossMargin > 0.15 ? "#f59e0b" : "#cf6e6e" }}>
        {pct(cl.metrics.grossMargin)}
      </span>
    </div>
  );

  const renderSchoolSubtotal = (cls, label) => {
    const rev   = cls.reduce((a, cl) => a + cl.metrics.annualRev, 0);
    const labor = cls.reduce((a, cl) => a + cl.metrics.annualLabor, 0);
    const gross = rev - labor;
    return (
      <div key={`sub_${label}`} style={{ ...rowStyle, background: "#f7f9fc", fontWeight: 700, borderTop: "1px solid #d0dae8" }}>
        <span style={{ color: "#475569" }}>{label} subtotal</span>
        {showDollars && <span style={{ textAlign: "right", color: "#D4A520" }}>{$k(rev)}</span>}
        {showDollars && <span style={{ textAlign: "right", color: "#334155" }}>{$k(labor)}</span>}
        {showDollars && <span style={{ textAlign: "right", color: gross > 0 ? "#22c55e" : "#cf6e6e" }}>{$k(gross)}</span>}
        <span style={{ textAlign: "right", color: rev > 0 && gross / rev > 0.3 ? "#22c55e" : "#f59e0b" }}>{rev > 0 ? pct(gross / rev) : "—"}</span>
      </div>
    );
  };

  return (
    <div>
      <h3 style={{ ...M, fontSize: 14, color: "#5a3800", margin: "0 0 14px 0", letterSpacing: 1, textTransform: "uppercase" }}>
        School-based services line P&amp;L
      </h3>

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: cols,
          padding: "10px 14px", background: "#eef1f6", borderBottom: "1px solid #d0dae8", ...labelStyle,
        }}>
          <span>Clinician</span>
          {showDollars && <span style={{ textAlign: "right" }}>Annual Rev</span>}
          {showDollars && <span style={{ textAlign: "right" }}>Annual Labor</span>}
          {showDollars && <span style={{ textAlign: "right" }}>Gross</span>}
          <span style={{ textAlign: "right" }}>Margin</span>
        </div>

        {isMultiSchool
          ? Object.entries(schools).map(([school, cls]) => (
              <div key={school}>
                <div style={{ ...rowStyle, background: "#eef7ff", fontWeight: 700, fontSize: 10, color: "#3b5fc0", borderBottom: "1px solid #c7d9f0" }}>
                  <span>🏫 {school}</span>
                </div>
                {cls.map(renderClinicianRow)}
                {renderSchoolSubtotal(cls, school)}
              </div>
            ))
          : summary.clinicians.map(renderClinicianRow)
        }

        {showDollars && summary.supervisionCost > 0 && (
          <div style={{ ...rowStyle, background: "#fdf4e7", color: "#78350f" }}>
            <span style={{ fontStyle: "italic" }}>Clinical supervision ({config.supervision?.count ?? 0} supervisor{(config.supervision?.count ?? 0) !== 1 ? 's' : ''})</span>
            <span style={{ textAlign: "right" }}>—</span>
            <span style={{ textAlign: "right" }}>{$k(summary.supervisionCost)}</span>
            <span style={{ textAlign: "right", color: "#cf6e6e" }}>({$k(summary.supervisionCost)})</span>
            <span style={{ textAlign: "right" }}>—</span>
          </div>
        )}

        {showDollars && summary.adminStaffCost > 0 && (
          <div style={{ ...rowStyle, background: "#fdf4e7", color: "#78350f" }}>
            <span style={{ fontStyle: "italic" }}>Admin staff ({(config.adminStaff ?? []).length})</span>
            <span style={{ textAlign: "right" }}>—</span>
            <span style={{ textAlign: "right" }}>{$k(summary.adminStaffCost)}</span>
            <span style={{ textAlign: "right", color: "#cf6e6e" }}>({$k(summary.adminStaffCost)})</span>
            <span style={{ textAlign: "right" }}>—</span>
          </div>
        )}

        <div style={{
          display: "grid", gridTemplateColumns: cols,
          padding: "12px 14px", background: "#141d2c", color: "#D4A520",
          fontSize: 13, fontWeight: 800, ...M,
        }}>
          <span>Total</span>
          {showDollars && <span style={{ textAlign: "right" }}>{$k(summary.totalAnnualRev)}</span>}
          {showDollars && <span style={{ textAlign: "right", color: "#e4eaf2" }}>{$k(summary.totalAnnualLabor + summary.supervisionCost + summary.adminStaffCost)}</span>}
          {showDollars && <span style={{ textAlign: "right", color: summary.totalGross > 0 ? "#22c55e" : "#cf6e6e" }}>{$k(summary.totalGross)}</span>}
          <span style={{ textAlign: "right" }}>{pct(summary.totalMargin)}</span>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 14, background: "#f7f9fc", border: "1px solid #d0dae8", borderRadius: 8, fontSize: 11, color: "#475569", ...M, lineHeight: 1.6 }}>
        <strong>Note:</strong> Annualized over {summary.weeks} service weeks (school year{(config.schoolYear?.esyWeeks ?? 0) > 0 ? ' + ESY' : ''}), not 52.
        Direct labor covers clinician service + admin hours at {config.payrollBurdenPct ?? 22}% burden, paid for service weeks only.
        Company overhead, management fees, and billing fees flow through the Whole Company P&amp;L roll-up.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate Schedule tab — unit-aware (15-min, per-visit, and per-mile codes)
// ─────────────────────────────────────────────────────────────────────────────
const UNIT_LABELS = { '15min': '15 min', visit: 'visit', mile: 'mile' };

export function SchoolBasedRateScheduleTab({ config, onUpdate, userRole }) {
  const overrides    = config.rateOverrides ?? {};
  const hasOverrides = Object.keys(overrides).length > 0;
  const canEdit      = canEditServiceLines(userRole);
  const ro           = !canEdit;

  const setRate = (key, val) => onUpdate({ ...config, rateOverrides: { ...overrides, [key]: val } });
  const resetRate = (key) => {
    const { [key]: _removed, ...rest } = overrides;
    onUpdate({ ...config, rateOverrides: rest });
  };
  const resetAll = () => onUpdate({ ...config, rateOverrides: {} });

  const groups = {};
  SCHOOL_RATE_TABLE.forEach(r => {
    if (!groups[r.group]) groups[r.group] = [];
    groups[r.group].push(r);
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ ...M, fontSize: 14, color: "#5a3800", margin: 0, letterSpacing: 1, textTransform: "uppercase" }}>
          Idaho School-Based Rate Schedule
        </h3>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 10, color: "#64748b", ...M }}>
            {hasOverrides ? `${Object.keys(overrides).length} rate${Object.keys(overrides).length !== 1 ? 's' : ''} overridden` : 'All rates at Idaho defaults'}
          </div>
          {hasOverrides && canEdit && (
            <button onClick={resetAll} style={{
              padding: "4px 10px", fontSize: 10, cursor: "pointer",
              border: "1px solid #d0dae8", borderRadius: 5, background: "#fff", ...M,
            }}>Reset all to defaults</button>
          )}
        </div>
      </div>

      <div style={{ fontSize: 10, color: "#64748b", ...M, marginBottom: 16, lineHeight: 1.6 }}>
        Rates are post-9/1/2025 (post-4% reduction). Billing units are mixed: therapies, CBRS, and the psych eval bill
        per 15-minute unit; psychotherapy bills per visit; transportation bills per mile. Edit any rate to override it
        for scenario modeling. Overridden rates are highlighted in amber. Click ↩ to reset an individual rate.
      </div>

      {Object.entries(groups).map(([groupName, rows]) => (
        <div key={groupName} style={{ marginBottom: 20 }}>
          <div style={{
            padding: "7px 12px", background: "#141d2c", color: "#D4A520",
            borderRadius: "6px 6px 0 0", fontSize: 11, fontWeight: 700, ...M,
          }}>{groupName}</div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "0.6fr 0.9fr 2.2fr 1.2fr 0.6fr 0.9fr 0.7fr",
            padding: "6px 12px", background: "#eef1f6",
            borderBottom: "1px solid #d0dae8", ...labelStyle,
          }}>
            <span>Code</span>
            <span>Modifier</span>
            <span>Description</span>
            <span>Tier</span>
            <span style={{ textAlign: "right" }}>Unit</span>
            <span style={{ textAlign: "right" }}>Rate / unit</span>
            <span style={{ textAlign: "right" }}>Rate / hr</span>
          </div>

          {rows.map(r => {
            const isOverridden = r.key in overrides;
            const activeRate   = isOverridden ? overrides[r.key] : r.defaultRate;
            return (
              <div key={r.key} style={{
                display: "grid",
                gridTemplateColumns: "0.6fr 0.9fr 2.2fr 1.2fr 0.6fr 0.9fr 0.7fr",
                padding: "7px 12px", borderBottom: "1px solid #f1f5f9",
                alignItems: "center", fontSize: 11, ...M,
                background: isOverridden ? "#fffbe8" : "#fff",
              }}>
                <span style={{ fontWeight: 600, color: "#3b5fc0" }}>{r.code}</span>
                <span style={{ color: "#64748b", fontSize: 10 }}>{r.modifier || '—'}</span>
                <span style={{ color: "#334155" }}>{r.description}</span>
                <span style={{ color: "#475569", fontSize: 10 }}>{r.tier}</span>
                <span style={{ textAlign: "right", color: "#64748b", fontSize: 10 }}>{UNIT_LABELS[r.unit] ?? r.unit}</span>
                <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "flex-end" }}>
                  <input
                    type="number" min={0} max={300} step={0.01}
                    value={activeRate}
                    onChange={e => setRate(r.key, +e.target.value)}
                    readOnly={ro}
                    style={{ ...numInput, width: 68, border: isOverridden ? "1px solid #f59e0b" : undefined, pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>
                  {isOverridden && canEdit && (
                    <button onClick={() => resetRate(r.key)} title={`Reset to $${r.defaultRate}`} style={{
                      border: "none", background: "transparent", cursor: "pointer",
                      color: "#f59e0b", fontSize: 13, padding: 0, lineHeight: 1,
                    }}>↩</button>
                  )}
                </div>
                <span style={{ textAlign: "right", color: "#64748b" }}>
                  {r.unit === '15min' ? $r(activeRate * 4) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      ))}

      <div style={{ padding: 12, background: "#f7f9fc", border: "1px solid #d0dae8", borderRadius: 8, fontSize: 10, color: "#64748b", ...M, lineHeight: 1.7, marginTop: 4 }}>
        <strong>Source:</strong> Idaho Medicaid school-based services fee schedule, effective 9/1/2025. Rates reflect the statewide 4% reduction.
        HM = Assistant. HO = Professional. CQ = PT Assistant. HO_S = OT Professional. SCHOOL_HQ = group service.
        Hourly equivalents are shown only for 15-minute-unit codes; per-visit and per-mile codes have no hourly basis.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Staffing tab — admin staff + productivity assumptions
// ─────────────────────────────────────────────────────────────────────────────
export function SchoolBasedStaffingTab({ config, onUpdate, userRole }) {
  const adminResult = calcSchoolAdminStaff(config.adminStaff ?? []);
  const prod = config.productivity ?? {};
  const canEdit   = canEditServiceLines(userRole);
  const showCosts = canSeeCompanyDollars(userRole);
  const ro = !canEdit;

  const updateProd = (field, val) =>
    onUpdate({ ...config, productivity: { ...prod, [field]: val } });

  const addStaff = () => onUpdate({
    ...config,
    adminStaff: [...(config.adminStaff ?? []), mkSchoolAdminStaffMember()],
  });
  const removeStaff = (id) => onUpdate({
    ...config,
    adminStaff: (config.adminStaff ?? []).filter(m => m.id !== id),
  });
  const updateStaff = (id, field, val) => onUpdate({
    ...config,
    adminStaff: (config.adminStaff ?? []).map(m => m.id === id ? { ...m, [field]: val } : m),
  });

  const effectiveBillablePct = Math.max(0, 100 - (prod.absenceRate ?? 10) - (prod.documentationTimePct ?? 15) - (prod.travelBetweenSchoolsPct ?? 10));
  const nonBillablePct = (prod.absenceRate ?? 10) + (prod.documentationTimePct ?? 15) + (prod.travelBetweenSchoolsPct ?? 10);

  return (
    <div>
      <h3 style={{ ...M, fontSize: 14, color: "#5a3800", margin: "0 0 14px 0", letterSpacing: 1, textTransform: "uppercase" }}>
        Administrative & management staffing
      </h3>

      {/* Admin staff table */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <div>
              <div style={labelStyle}>Admin staff count</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#5a3800", ...M }}>{(config.adminStaff ?? []).length}</div>
            </div>
            {showCosts && (
              <div>
                <div style={labelStyle}>Total annual cost</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#cf6e6e", ...M }}>{$k(adminResult.totalAnnualCost)}</div>
              </div>
            )}
          </div>
          {canEdit && <button onClick={addStaff} style={{
            padding: "6px 14px", background: "#fff", border: "1px dashed #c8d4e4",
            borderRadius: 6, color: "#5a3800", cursor: "pointer", fontSize: 12, fontWeight: 600, ...M,
          }}>+ Add staff</button>}
        </div>

        {(config.adminStaff ?? []).length === 0 && (
          <div style={{ textAlign: "center", padding: 20, color: "#94a3b8", fontSize: 12, ...M }}>
            No admin staff added. Direct clinician labor only.
          </div>
        )}

        {adminResult.staff.length > 0 && (
          <>
            <div style={{
              display: "grid", gridTemplateColumns: `2fr 0.8fr 1fr 0.7fr 0.7fr${showCosts ? " 1fr" : ""} 0.4fr`,
              padding: "8px 10px", background: "#eef1f6", borderRadius: 6,
              ...labelStyle, marginBottom: 6,
            }}>
              <span>Role</span>
              <span style={{ textAlign: "right" }}>Mode</span>
              <span style={{ textAlign: "right" }}>Value</span>
              <span style={{ textAlign: "right" }}>FTE %</span>
              <span style={{ textAlign: "right" }}>Benefits %</span>
              {showCosts && <span style={{ textAlign: "right" }}>Annual cost</span>}
              <span></span>
            </div>
            {adminResult.staff.map(m => (
              <div key={m.id} style={{
                display: "grid", gridTemplateColumns: `2fr 0.8fr 1fr 0.7fr 0.7fr${showCosts ? " 1fr" : ""} 0.4fr`,
                gap: 6, alignItems: "center", padding: "6px 10px",
                borderBottom: "1px solid #f1f5f9", fontSize: 12, ...M,
              }}>
                <input type="text" value={m.role}
                  onChange={e => updateStaff(m.id, "role", e.target.value)}
                  readOnly={ro}
                  style={{ ...textInput, fontSize: 12, pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>
                <select value={m.mode}
                  onChange={e => updateStaff(m.id, "mode", e.target.value)}
                  disabled={ro}
                  style={{ ...textInput, fontSize: 11, padding: "3px 6px", textAlign: "right", pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}>
                  <option value="salary">Salary</option>
                  <option value="hourly">Hourly</option>
                </select>
                <input type="number" min={0} value={m.value}
                  onChange={e => updateStaff(m.id, "value", +e.target.value)}
                  readOnly={ro}
                  style={{ ...numInput, width: "100%", pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>
                <input type="number" min={0} max={100} value={m.ftePct}
                  onChange={e => updateStaff(m.id, "ftePct", +e.target.value)}
                  readOnly={ro}
                  style={{ ...numInput, width: "100%", pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>
                <input type="number" min={0} max={50} value={m.benefitsPct}
                  onChange={e => updateStaff(m.id, "benefitsPct", +e.target.value)}
                  readOnly={ro}
                  style={{ ...numInput, width: "100%", pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>
                {showCosts && <span style={{ textAlign: "right", color: "#cf6e6e", fontWeight: 700 }}>{$k(m.annualCost)}</span>}
                {canEdit && <button onClick={() => removeStaff(m.id)} style={{
                  border: "none", background: "transparent", cursor: "pointer",
                  color: "#cf6e6e", fontSize: 14, padding: 4,
                }}>✕</button>}
                {!canEdit && <span/>}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Productivity assumptions */}
      <h3 style={{ ...M, fontSize: 14, color: "#5a3800", margin: "0 0 14px 0", letterSpacing: 1, textTransform: "uppercase" }}>
        Productivity assumptions
      </h3>

      <div style={{ ...card, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={labelStyle}>Billable hours / day</div>
          <input type="number" min={1} max={10} step={0.5} value={prod.billableHrsPerDay ?? 5}
            onChange={e => updateProd("billableHrsPerDay", +e.target.value)}
            readOnly={ro}
            style={{ ...numInput, width: 64, marginTop: 4, pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>
        </div>
        <div>
          <div style={labelStyle}>Student absence %</div>
          <div style={{ fontSize: 10, color: "#64748b", ...M, marginBottom: 4 }}>Applied to revenue & service hours</div>
          <input type="number" min={0} max={50} value={prod.absenceRate ?? 10}
            onChange={e => updateProd("absenceRate", +e.target.value)}
            readOnly={ro}
            style={{ ...numInput, width: 64, pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>
        </div>
        <div>
          <div style={labelStyle}>Documentation time %</div>
          <input type="number" min={0} max={50} value={prod.documentationTimePct ?? 15}
            onChange={e => updateProd("documentationTimePct", +e.target.value)}
            readOnly={ro}
            style={{ ...numInput, width: 64, marginTop: 4, pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>
        </div>
        <div>
          <div style={labelStyle}>Travel between schools %</div>
          <input type="number" min={0} max={50} value={prod.travelBetweenSchoolsPct ?? 10}
            onChange={e => updateProd("travelBetweenSchoolsPct", +e.target.value)}
            readOnly={ro}
            style={{ ...numInput, width: 64, marginTop: 4, pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>
        </div>

        {/* Visual breakdown bar */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={labelStyle}>Hours breakdown (per school day)</div>
          <div style={{ display: "flex", height: 20, borderRadius: 4, overflow: "hidden", marginTop: 6, border: "1px solid #d0dae8" }}>
            {[
              { label: "Billable", pct: effectiveBillablePct,                  color: "#22c55e" },
              { label: "Absence",  pct: prod.absenceRate ?? 10,               color: "#cf6e6e" },
              { label: "Docs",     pct: prod.documentationTimePct ?? 15,      color: "#f59e0b" },
              { label: "Travel",   pct: prod.travelBetweenSchoolsPct ?? 10,   color: "#94a3b8" },
            ].map(seg => (
              <div key={seg.label} style={{ width: `${Math.max(seg.pct, 0)}%`, background: seg.color, minWidth: seg.pct > 0 ? 2 : 0 }}/>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4, fontSize: 9, color: "#64748b", ...M }}>
            <span>🟩 Billable {effectiveBillablePct.toFixed(0)}%</span>
            <span>🟥 Absence {prod.absenceRate ?? 10}%</span>
            <span>🟨 Docs {prod.documentationTimePct ?? 15}%</span>
            <span>⬜ Travel {prod.travelBetweenSchoolsPct ?? 10}%</span>
          </div>
          {nonBillablePct > 60 && (
            <div style={{ marginTop: 6, fontSize: 10, color: "#cf6e6e", ...M }}>
              ⚠️ Non-billable burden exceeds 60% — clinicians may be under-producing.
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 12, background: "#f7f9fc", border: "1px solid #d0dae8", borderRadius: 8, fontSize: 10, color: "#64748b", ...M, lineHeight: 1.6 }}>
        <strong>Note:</strong> Student absence directly reduces billable sessions and is applied to revenue and service hours
        in the calculators. Documentation and travel percentages are operational planning inputs shown for context.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario tab — rate / caseload / productivity / school-year what-ifs
// ─────────────────────────────────────────────────────────────────────────────
const SCENARIO_RATE_KEYS = ['speech_prof', 'pt_prof', 'ot_prof', 'psycho_45', 'cbrs_ind'];

export function SchoolBasedScenarioTab({ config, onUpdate, userRole }) {
  const sc = config.scenario ?? { rateAdjPct: 0, caseloadCount: null, productivityAdjPct: 0, weeksPerYear: null };
  const canEdit     = canEditServiceLines(userRole);
  const showDollars = canSeeCompanyDollars(userRole);
  const ro = !canEdit;

  const { base, scenario, delta } = calcSchoolScenario(config);
  const caseloadCountVal = sc.caseloadCount ?? base.totalCaseload;
  const weeksVal         = sc.weeksPerYear ?? (config.schoolYear?.weeksPerYear ?? 36);

  const overrides = config.rateOverrides ?? {};
  const [ratesOpen, setRatesOpen] = useState(true);
  const setRate = (key, val) =>
    onUpdate({ ...config, rateOverrides: { ...overrides, [key]: val } });

  const updateScenario = (field, val) =>
    onUpdate({ ...config, scenario: { ...sc, [field]: val } });

  const $d = n => (n >= 0 ? "+" : "") + n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const pctD = n => (n >= 0 ? "+" : "") + (n * 100).toFixed(1) + "%";
  const deltaColor = n => n >= 0 ? "#22c55e" : "#cf6e6e";

  const dollarRows = [
    { label: "Annual Revenue", base: base.totalAnnualRev,   scen: scenario.totalAnnualRev,   d: delta.totalAnnualRev,   fmt: $k, fmtD: $d },
    { label: "Annual Labor",   base: base.totalAnnualLabor, scen: scenario.totalAnnualLabor, d: delta.totalAnnualLabor, fmt: $k, fmtD: $d },
    { label: "Gross",          base: base.totalGross,       scen: scenario.totalGross,       d: delta.totalGross,       fmt: $k, fmtD: $d },
  ];
  const pctRows = [
    { label: "Margin",         base: base.totalMargin,    scen: scenario.totalMargin,    d: delta.totalMargin,                            fmt: pct,    fmtD: pctD },
    { label: "Clinicians",     base: base.clinicianCount, scen: scenario.clinicianCount, d: scenario.clinicianCount - base.clinicianCount, fmt: n => n, fmtD: n => (n >= 0 ? "+" : "") + n },
    { label: "Total Caseload", base: base.totalCaseload,  scen: scenario.totalCaseload,  d: scenario.totalCaseload - base.totalCaseload,   fmt: n => n, fmtD: n => (n >= 0 ? "+" : "") + n },
    { label: "Service Weeks",  base: base.weeks,          scen: scenario.weeks,          d: scenario.weeks - base.weeks,                   fmt: n => n, fmtD: n => (n >= 0 ? "+" : "") + n },
  ];
  const tableRows = showDollars ? [...dollarRows, ...pctRows] : pctRows;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>
      {/* Left: reimbursement rate overrides */}
      {canEdit ? (
        <div style={{ padding: "10px 12px", background: "#f8f6f0", borderRadius: 9, border: "1px solid #e0e8f0" }}>
          <button onClick={() => setRatesOpen(o => !o)} style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
            display: "flex", alignItems: "center", gap: 6, width: "100%",
            fontSize: 9, color: "#9a8050", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700,
          }}>
            <span style={{ fontSize: 11, transition: "transform 200ms", transform: ratesOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
            Reimbursement Rates
          </button>
          {ratesOpen && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {SCENARIO_RATE_KEYS.map(key => {
                const row = SCHOOL_RATE_TABLE.find(r => r.key === key);
                const val = overrides[key] ?? row.defaultRate;
                return (
                  <div key={key}>
                    <div style={{ fontSize: 9, color: "#5a7498", marginBottom: 3 }}>
                      {row.group} <span style={{ color: "#9aabb8" }}>/{UNIT_LABELS[row.unit]} · {row.code}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 3, flex: 1 }}>
                        <span style={{ fontSize: 10, color: "#9aabb8" }}>$</span>
                        <input type="number" step="0.01" value={val}
                          onChange={e => setRate(key, parseFloat(e.target.value) || 0)}
                          style={{ width: 60, fontSize: 12, fontWeight: 600, color: "#5a3800",
                            background: "#f8f8f8", border: "1px solid #d0dae8", borderRadius: 5,
                            padding: "3px 6px", textAlign: "right" }}/>
                      </div>
                      <div style={{ display: "flex", gap: 3 }}>
                        {[2, 4, 6].map(p => (
                          <button key={p} onClick={() =>
                            setRate(key, parseFloat((row.defaultRate * (1 - p / 100)).toFixed(4)))}
                            style={{ fontSize: 9, padding: "2px 4px", borderRadius: 4, border: "1px solid #d0dae8",
                              background: "#fff", color: "#64748b", cursor: "pointer" }}>
                            −{p}%
                          </button>
                        ))}
                        <button onClick={() => setRate(key, row.defaultRate)}
                          style={{ fontSize: 9, padding: "2px 4px", borderRadius: 4, border: "1px solid #d0dae8",
                            background: "#fff", color: "#64748b", cursor: "pointer" }}>
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div style={{ borderTop: "1px solid #e0e8f0", marginTop: 2, paddingTop: 8, fontSize: 9, color: "#5a7498", lineHeight: 1.6 }}>
                Full schedule (all 13 codes) on the Rate Schedule tab.<br/>
                Unit basis: 1 unit = 15 min for therapies/CBRS; psychotherapy is per visit; transport per mile.
              </div>
            </div>
          )}
        </div>
      ) : <div/>}

      {/* Right: scenario modeling */}
      <div>
        <h3 style={{ ...M, fontSize: 14, color: "#5a3800", margin: "0 0 14px 0", letterSpacing: 1, textTransform: "uppercase" }}>
          Scenario modeling
        </h3>

        {/* Adjustment inputs */}
        <div style={{ ...card, marginBottom: 20, display: "flex", gap: 32, flexWrap: "wrap" }}>
          {[
            { label: "Rate adjustment",        field: "rateAdjPct",         hint: "Adjusts billed rates ±50%",                          val: sc.rateAdjPct ?? 0,         min: -50,  max: 50, unit: "%" },
            { label: "Caseload (students)",    field: "caseloadCount",      hint: "Target student count for scenario (1–120)",          val: caseloadCountVal,           min: 1,    max: 120, unit: "st" },
            { label: "Productivity adjustment",field: "productivityAdjPct", hint: "Adjusts service volume per student (−100% to +100%)",val: sc.productivityAdjPct ?? 0, min: -100, max: 100, unit: "%" },
            { label: "School year weeks",      field: "weeksPerYear",       hint: "What-if service weeks (ESY, calendar changes)",      val: weeksVal,                   min: 10,   max: 52, unit: "wks" },
          ].map(({ label, field, hint, val, min, max, unit }) => (
            <div key={field}>
              <div style={labelStyle}>{label}</div>
              <div style={{ fontSize: 10, color: "#64748b", ...M, marginBottom: 4 }}>{hint}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="range" min={min} max={max} step={1} value={val}
                  onChange={e => updateScenario(field, +e.target.value)}
                  disabled={ro}
                  style={{ width: 120, pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>
                <input type="number" min={min} max={max} value={val}
                  onChange={e => updateScenario(field, +e.target.value)}
                  readOnly={ro}
                  style={{ ...numInput, width: 56, pointerEvents: ro ? "none" : "auto", opacity: ro ? 0.65 : 1 }}/>
                <span style={{ fontSize: 11, color: "#334155", ...M }}>{unit}</span>
              </div>
            </div>
          ))}
          {canEdit && <button onClick={() => onUpdate({ ...config, scenario: { rateAdjPct: 0, caseloadCount: null, productivityAdjPct: 0, weeksPerYear: null } })}
            style={{ alignSelf: "flex-end", padding: "6px 12px", background: "#fff", border: "1px solid #c8d4e4", borderRadius: 5, fontSize: 10, cursor: "pointer", ...M }}>
            Reset
          </button>}
        </div>

        {/* Base vs scenario comparison */}
        <div style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 20 }}>
          <div style={{
            display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
            padding: "10px 14px", background: "#eef1f6", borderBottom: "1px solid #d0dae8", ...labelStyle,
          }}>
            <span>Metric</span>
            <span style={{ textAlign: "right" }}>Base</span>
            <span style={{ textAlign: "right" }}>Scenario</span>
            <span style={{ textAlign: "right" }}>Delta</span>
          </div>
          {tableRows.map(({ label, base: b, scen, d, fmt, fmtD }) => (
            <div key={label} style={{
              display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
              padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 12, ...M,
            }}>
              <span style={{ color: "#475569" }}>{label}</span>
              <span style={{ textAlign: "right", color: "#5a3800" }}>{fmt(b)}</span>
              <span style={{ textAlign: "right", color: "#D4A520", fontWeight: 700 }}>{fmt(scen)}</span>
              <span style={{ textAlign: "right", color: deltaColor(d), fontWeight: 700 }}>{fmtD(d)}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: 12, background: "#f7f9fc", border: "1px solid #d0dae8", borderRadius: 8, fontSize: 10, color: "#64748b", ...M, lineHeight: 1.6 }}>
          <strong>Note:</strong> Rate adjustment scales revenue only (labor is wage-driven). Caseload and productivity
          scale per-student service volumes, so labor moves with them. The school-year-weeks what-if re-annualizes both
          revenue and labor — useful for modeling ESY expansion or calendar changes.
        </div>
      </div>
    </div>
  );
}
