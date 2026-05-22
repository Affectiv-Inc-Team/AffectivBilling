import { useState } from "react";
import { canSeeCompanyDollars, wageDisplayMode } from '../lib/access';

// Idaho Adult DDA / Employment rates, post-9/1/2025
const CSE_RATES = {
  SUPPORTED_EMPLOYMENT: 11.44,  // H2023  — Supported Employment
  COMM_DEV_THERAPY:      6.01,  // 97537  — Community/Home Development Therapy
  CENTER_DEV_THERAPY:    4.00,  // H2032  — Center-Based Development Therapy
  DT_EVALUATION:        16.27,  // H2000  — Development Therapy Evaluation
  COMMUNITY_CRISIS:     10.90,  // H2011  — Community Crisis Intervention
};

const CODE_LABELS = {
  SUPPORTED_EMPLOYMENT: 'H2023 – Supported Employment ($11.44/15min)',
  COMM_DEV_THERAPY:     '97537 – Comm/Home Dev Therapy ($6.01/15min)',
  CENTER_DEV_THERAPY:   'H2032 – Center-Based Dev Therapy ($4.00/15min)',
  DT_EVALUATION:        'H2000 – Dev Therapy Evaluation ($16.27/15min)',
  COMMUNITY_CRISIS:     'H2011 – Community Crisis ($10.90/15min)',
};

const BILLING_CODES = Object.keys(CSE_RATES);

const PHASES = ['initial', 'stabilization', 'retention'];
const PHASE_LABELS = {
  initial:       'Initial Intensive',
  stabilization: 'Stabilization',
  retention:     'Long-Term Retention',
};

// Typical weekly hours by phase (reference only — not enforced)
const PHASE_THRESHOLDS = {
  initial:       { min: 20, typical: 25 },
  stabilization: { min: 10, typical: 15 },
  retention:     { min: 2,  typical: 5  },
};

// ──────────────────────────────────────────────────────────────────────
// Factories
// ──────────────────────────────────────────────────────────────────────
let _cseUid = 0;
const cseUid = () => ++_cseUid;

export function mkCSEParticipant(name = 'New Participant') {
  return {
    id: `csep_${cseUid()}`,
    name,
    hoursPerWeek:  20,
    phase:         'initial',
    billingCode:   'SUPPORTED_EMPLOYMENT',
  };
}

export function mkCSESpecialist(name = 'New Specialist', hourlyWage = 20) {
  return {
    id: `cses_${cseUid()}`,
    name,
    hourlyWage,
    profile: 'urban',
    officeName: '',
    participants: [],
  };
}

export function defaultCSEConfig() {
  return {
    specialists: [],
    jobDevelopment: {
      fteCount:             1,
      salary:               52000,
      outreachHoursPerWeek: 20,
      conversionRate:       15,  // % of outreach contacts that convert to placements
    },
    productivity: {
      billableHrsPerDay:    5,
      driveTimePct:         25,
      documentationTimePct: 15,
      noShowPct:            10,
    },
    revenue: {
      completionRate:      90,
      billingSuccessRate:  95,
      collectionRate:      99,
    },
    payrollBurdenPct:  22,
    defaultHourlyWage: 20,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Calculators
// ──────────────────────────────────────────────────────────────────────
export function calcCSEParticipant(p) {
  const rate         = CSE_RATES[p.billingCode ?? 'SUPPORTED_EMPLOYMENT'] ?? CSE_RATES.SUPPORTED_EMPLOYMENT;
  const monthlyHours = (p.hoursPerWeek ?? 20) * 4.33;
  const monthlyUnits = monthlyHours * 4;  // 4 units per hour (15-min units)
  const monthlyRev   = monthlyUnits * rate;
  return {
    monthlyRev,
    annualRev:   monthlyRev * 12,
    monthlyHours,
    annualHours: monthlyHours * 12,
  };
}

export function calcCSESpecialist(s, payrollBurdenPct = 22) {
  const px = (s.participants ?? []).map(calcCSEParticipant);

  const monthlyRev      = px.reduce((a, p) => a + p.monthlyRev, 0);
  const monthlyBillable = px.reduce((a, p) => a + p.monthlyHours, 0);
  const adminMonthly    = 5 * 4.33;  // 5 admin hrs/week
  const totalMonthlyHrs = monthlyBillable + adminMonthly;

  const burden       = 1 + (payrollBurdenPct ?? 22) / 100;
  const monthlyLabor = totalMonthlyHrs * (s.hourlyWage ?? 20) * burden;
  const annualLabor  = monthlyLabor * 12;
  const annualRev    = monthlyRev * 12;
  const gross        = annualRev - annualLabor;
  const FTE_HRS      = 160;

  return {
    px,
    caseloadSize:   (s.participants ?? []).length,
    monthlyRev,
    annualRev,
    monthlyBillable,
    adminMonthly,
    totalMonthlyHrs,
    monthlyLabor,
    annualLabor,
    gross,
    grossMargin:    annualRev > 0 ? gross / annualRev : 0,
    utilization:    totalMonthlyHrs / FTE_HRS,
    billableShare:  totalMonthlyHrs > 0 ? monthlyBillable / totalMonthlyHrs : 0,
  };
}

export function calcCSEService(config) {
  const payrollBurdenPct = config.payrollBurdenPct ?? 22;

  const specialists = (config.specialists ?? []).map(s => ({
    ...s,
    metrics: calcCSESpecialist(s, payrollBurdenPct),
  }));

  const totalCaseload  = specialists.reduce((a, s) => a + s.metrics.caseloadSize, 0);
  const totalAnnualRev = specialists.reduce((a, s) => a + s.metrics.annualRev, 0);
  const totalAnnualLab = specialists.reduce((a, s) => a + s.metrics.annualLabor, 0);

  const jd = config.jobDevelopment ?? { fteCount: 1, salary: 52000 };
  const jobDevCost = (jd.fteCount ?? 1) * (jd.salary ?? 52000) * (1 + payrollBurdenPct / 100);

  const totalGross = totalAnnualRev - totalAnnualLab - jobDevCost;

  return {
    specialists,
    totalCaseload,
    totalAnnualRev,
    totalAnnualLabor: totalAnnualLab,
    jobDevCost,
    totalGross,
    totalMargin:      totalAnnualRev > 0 ? totalGross / totalAnnualRev : 0,
    specialistCount:  specialists.length,
  };
}

// ──────────────────────────────────────────────────────────────────────
// UI helpers
// ──────────────────────────────────────────────────────────────────────
const $k  = n => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
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
  width: 64, padding: "3px 6px", border: "1px solid #c8d4e4",
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

// ──────────────────────────────────────────────────────────────────────
// Participant row
// ──────────────────────────────────────────────────────────────────────
function CSEParticipantRow({ p, onUpdate, onRemove, userRole }) {
  const m             = calcCSEParticipant(p);
  const thresholds    = PHASE_THRESHOLDS[p.phase ?? 'initial'];
  const belowTypical  = (p.hoursPerWeek ?? 20) < thresholds.typical;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1.4fr 0.7fr 1fr 1.6fr 0.9fr 0.4fr",
      gap: 8, alignItems: "center", padding: "6px 8px",
      borderRadius: 6, background: "#f7f9fc", border: "1px solid #e2e8f0",
    }}>
      <input type="text" value={p.name}
        onChange={e => onUpdate(p.id, "name", e.target.value)}
        style={textInput}/>
      <div>
        <div style={labelStyle}>Hr / wk</div>
        <input type="number" min={0} max={40} step={0.5} value={p.hoursPerWeek ?? 20}
          onChange={e => onUpdate(p.id, "hoursPerWeek", +e.target.value)}
          style={{ ...numInput, border: belowTypical ? "1px solid #f59e0b" : undefined }}/>
      </div>
      <div>
        <div style={labelStyle}>Phase</div>
        <select value={p.phase ?? 'initial'}
          onChange={e => onUpdate(p.id, "phase", e.target.value)}
          style={{ ...textInput, fontSize: 11, padding: "3px 6px" }}>
          {PHASES.map(ph => <option key={ph} value={ph}>{PHASE_LABELS[ph]}</option>)}
        </select>
      </div>
      <div>
        <div style={labelStyle}>Billing code</div>
        <select value={p.billingCode ?? 'SUPPORTED_EMPLOYMENT'}
          onChange={e => onUpdate(p.id, "billingCode", e.target.value)}
          style={{ ...textInput, fontSize: 10, padding: "3px 6px", width: "100%" }}>
          {BILLING_CODES.map(c => <option key={c} value={c}>{CODE_LABELS[c]}</option>)}
        </select>
      </div>
      <div style={{ textAlign: "right" }}>
        {canSeeCompanyDollars(userRole) && <div style={{ fontSize: 13, fontWeight: 700, color: "#5a3800", ...M }}>{$k(m.monthlyRev)}/mo</div>}
        <div style={{ fontSize: 9, color: "#64748b", ...M }}>{m.monthlyHours.toFixed(1)} hr/mo</div>
      </div>
      <button onClick={() => onRemove(p.id)} style={{
        border: "none", background: "transparent", cursor: "pointer",
        color: "#cf6e6e", fontSize: 14, padding: 4,
      }}>✕</button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Specialist card
// ──────────────────────────────────────────────────────────────────────
function CSESpecialistCard({ s, payrollBurdenPct, onUpdate, onRemove, onAddParticipant, onUpdateParticipant, onRemoveParticipant, userRole }) {
  const [expanded, setExpanded] = useState(true);
  const m = calcCSESpecialist(s, payrollBurdenPct);

  const utilColor   = m.utilization > 1.05 ? "#cf6e6e" : m.utilization > 0.85 ? "#22c55e" : m.utilization > 0.65 ? "#f59e0b" : "#cf6e6e";
  const marginColor = m.grossMargin > 0.35 ? "#22c55e" : m.grossMargin > 0.15 ? "#f59e0b" : "#cf6e6e";

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <button onClick={() => setExpanded(e => !e)} style={{
          border: "none", background: "transparent", cursor: "pointer",
          fontSize: 14, color: "#5a3800", width: 20,
        }}>{expanded ? "▼" : "▶"}</button>

        <input type="text" value={s.name}
          onChange={e => onUpdate(s.id, "name", e.target.value)}
          style={{ ...textInput, fontWeight: 700, flex: 1, minWidth: 120, fontSize: 14 }}/>

        <div>
          <div style={labelStyle}>Profile</div>
          <select value={s.profile ?? 'urban'}
            onChange={e => onUpdate(s.id, "profile", e.target.value)}
            style={{ ...textInput, fontSize: 11, padding: "3px 6px" }}>
            <option value="urban">Urban</option>
            <option value="rural">Rural</option>
          </select>
        </div>

        {wageDisplayMode(userRole) !== 'hidden' && (
          <div>
            <div style={labelStyle}>Wage / hr</div>
            <input type="number" min={10} max={60} step={0.5} value={s.hourlyWage}
              onChange={e => onUpdate(s.id, "hourlyWage", +e.target.value)}
              readOnly={wageDisplayMode(userRole) !== 'dollars'}
              style={numInput}/>
          </div>
        )}

        <div>
          <div style={labelStyle}>Office</div>
          <input type="text" value={s.officeName ?? ''}
            onChange={e => onUpdate(s.id, "officeName", e.target.value)}
            placeholder="optional"
            style={{ ...textInput, width: 90, fontSize: 11 }}/>
        </div>

        <button onClick={() => onRemove(s.id)} style={{
          border: "1px solid #e8d4d4", background: "#fff5f5",
          color: "#a14848", padding: "4px 10px", borderRadius: 5,
          fontSize: 10, cursor: "pointer", ...M,
        }}>Remove</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: expanded ? 12 : 0 }}>
        <Stat label="Caseload"      value={m.caseloadSize} />
        {canSeeCompanyDollars(userRole) && <Stat label="Annual Rev"   value={$k(m.annualRev)} color="#D4A520"/>}
        {canSeeCompanyDollars(userRole) && <Stat label="Annual Labor" value={$k(m.annualLabor)} />}
        {canSeeCompanyDollars(userRole) && <Stat label="Gross"        value={$k(m.gross)} color={marginColor}/>}
        <Stat label="Margin"        value={pct(m.grossMargin)} color={marginColor}/>
        <Stat label="Utilization"   value={pct(m.utilization)} color={utilColor}/>
        <Stat label="Billable share" value={pct(m.billableShare)} />
      </div>

      {expanded && (
        <div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 0.7fr 1fr 1.6fr 0.9fr 0.4fr",
            gap: 8, padding: "4px 8px", ...labelStyle, marginBottom: 4,
          }}>
            <span>Participant</span>
            <span>Hr/wk</span>
            <span>Phase</span>
            <span>Billing code</span>
            <span style={{ textAlign: "right" }}>Revenue</span>
            <span></span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(s.participants ?? []).map(p =>
              <CSEParticipantRow key={p.id} p={p}
                onUpdate={(id, f, v) => onUpdateParticipant(s.id, id, f, v)}
                onRemove={(id) => onRemoveParticipant(s.id, id)}
                userRole={userRole}/>
            )}
          </div>
          <button onClick={() => onAddParticipant(s.id)} style={{
            marginTop: 10, padding: "6px 14px",
            background: "#fff", border: "1px dashed #c8d4e4", borderRadius: 6,
            color: "#5a3800", cursor: "pointer", fontSize: 12, fontWeight: 600, ...M,
          }}>+ Add participant</button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Roster tab
// ──────────────────────────────────────────────────────────────────────
export function CSERosterTab({ config, onUpdate, userRole }) {
  const summary = calcCSEService(config);

  const updateField = (field, value) => onUpdate({ ...config, [field]: value });

  const updateSpecialist = (sId, field, value) =>
    onUpdate({ ...config, specialists: config.specialists.map(s => s.id === sId ? { ...s, [field]: value } : s) });

  const removeSpecialist = (sId) =>
    onUpdate({ ...config, specialists: config.specialists.filter(s => s.id !== sId) });

  const addSpecialist = () =>
    onUpdate({
      ...config,
      specialists: [
        ...config.specialists,
        mkCSESpecialist(`Specialist ${config.specialists.length + 1}`, config.defaultHourlyWage ?? 20),
      ],
    });

  const addParticipant = (sId) =>
    onUpdate({
      ...config,
      specialists: config.specialists.map(s =>
        s.id === sId
          ? { ...s, participants: [...(s.participants ?? []), mkCSEParticipant(`Participant ${(s.participants ?? []).length + 1}`)] }
          : s
      ),
    });

  const updateParticipant = (sId, pId, field, value) =>
    onUpdate({
      ...config,
      specialists: config.specialists.map(s =>
        s.id === sId
          ? { ...s, participants: s.participants.map(p => p.id === pId ? { ...p, [field]: value } : p) }
          : s
      ),
    });

  const removeParticipant = (sId, pId) =>
    onUpdate({
      ...config,
      specialists: config.specialists.map(s =>
        s.id === sId
          ? { ...s, participants: s.participants.filter(p => p.id !== pId) }
          : s
      ),
    });

  const jd = config.jobDevelopment ?? { fteCount: 1, salary: 52000, outreachHoursPerWeek: 20, conversionRate: 15 };
  const updateJD = (field, val) => updateField("jobDevelopment", { ...jd, [field]: val });

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <Stat label="Specialists"    value={summary.specialistCount} />
        <Stat label="Total caseload"  value={summary.totalCaseload} />
        {canSeeCompanyDollars(userRole) && <Stat label="Annual Rev"      value={$k(summary.totalAnnualRev)} color="#D4A520"/>}
        {canSeeCompanyDollars(userRole) && <Stat label="Direct Labor"    value={$k(summary.totalAnnualLabor)} />}
        {canSeeCompanyDollars(userRole) && <Stat label="Job Development" value={$k(summary.jobDevCost)} />}
        {canSeeCompanyDollars(userRole) && <Stat label="Gross"           value={$k(summary.totalGross)} color={summary.totalMargin > 0.2 ? "#22c55e" : "#cf6e6e"}/>}
        <Stat label="Margin"          value={pct(summary.totalMargin)} color={summary.totalMargin > 0.2 ? "#22c55e" : "#cf6e6e"}/>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <span style={labelStyle}>Burden %</span>
          <input type="number" min={0} max={50} step={0.5} value={config.payrollBurdenPct ?? 22}
            onChange={e => updateField("payrollBurdenPct", +e.target.value)}
            style={numInput}/>
        </div>
      </div>

      {/* Job Development settings */}
      <div style={{ ...card, marginBottom: 16, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ ...labelStyle, fontSize: 10 }}>Job Development Staff</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={labelStyle}>FTE count</span>
          <input type="number" min={0} max={10} step={0.5} value={jd.fteCount ?? 1}
            onChange={e => updateJD("fteCount", +e.target.value)} style={{ ...numInput, width: 48 }}/>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={labelStyle}>Annual salary</span>
          <input type="number" min={25000} max={150000} step={1000} value={jd.salary ?? 52000}
            onChange={e => updateJD("salary", +e.target.value)} style={{ ...numInput, width: 80 }}/>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={labelStyle}>Outreach hr/wk</span>
          <input type="number" min={0} max={40} value={jd.outreachHoursPerWeek ?? 20}
            onChange={e => updateJD("outreachHoursPerWeek", +e.target.value)} style={{ ...numInput, width: 48 }}/>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={labelStyle}>Conversion rate %</span>
          <input type="number" min={0} max={100} value={jd.conversionRate ?? 15}
            onChange={e => updateJD("conversionRate", +e.target.value)} style={{ ...numInput, width: 48 }}/>
        </div>
        {canSeeCompanyDollars(userRole) && (
          <div style={{ fontSize: 10, color: "#64748b", ...M }}>
            Annual cost: {$k((jd.fteCount ?? 1) * (jd.salary ?? 52000) * (1 + (config.payrollBurdenPct ?? 22) / 100))}
          </div>
        )}
      </div>

      {/* Specialist cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {config.specialists.length === 0 && (
          <div style={{ ...card, textAlign: "center", padding: 40, color: "#64748b" }}>
            <div style={{ fontSize: 13, marginBottom: 8 }}>No specialists yet.</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Add an employment specialist to start building your CSE caseload model.</div>
          </div>
        )}
        {config.specialists.map(s =>
          <CSESpecialistCard key={s.id} s={s}
            payrollBurdenPct={config.payrollBurdenPct}
            onUpdate={updateSpecialist}
            onRemove={removeSpecialist}
            onAddParticipant={addParticipant}
            onUpdateParticipant={updateParticipant}
            onRemoveParticipant={removeParticipant}
            userRole={userRole}/>
        )}
      </div>

      <button onClick={addSpecialist} style={{
        marginTop: 16, padding: "8px 18px",
        background: "#D4A520", border: "none", borderRadius: 6,
        color: "#5a3800", cursor: "pointer", fontSize: 12, fontWeight: 700, ...M,
      }}>+ Add specialist</button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Productivity tab
// ──────────────────────────────────────────────────────────────────────
export function CSEProductivityTab({ config, userRole }) {
  const summary = calcCSEService(config);
  const prod    = config.productivity ?? {};
  const revenue = config.revenue      ?? {};

  if (summary.specialistCount === 0) {
    return (
      <div style={{ ...card, textAlign: "center", padding: 40, color: "#64748b" }}>
        <div style={{ fontSize: 13 }}>Add specialists in the Roster tab to see productivity analysis.</div>
      </div>
    );
  }

  const effectivePct = 100 - (prod.driveTimePct ?? 25) - (prod.documentationTimePct ?? 15) - (prod.noShowPct ?? 10);
  const revWaterfall = (rev) => ({
    authorized: rev,
    earned:     rev * ((revenue.completionRate ?? 90) / 100),
    billed:     rev * ((revenue.completionRate ?? 90) / 100) * ((revenue.billingSuccessRate ?? 95) / 100),
    collected:  rev * ((revenue.completionRate ?? 90) / 100) * ((revenue.billingSuccessRate ?? 95) / 100) * ((revenue.collectionRate ?? 99) / 100),
  });
  const wf = revWaterfall(summary.totalAnnualRev);

  return (
    <div>
      <h3 style={{ ...M, fontSize: 14, color: "#5a3800", margin: "0 0 14px 0", letterSpacing: 1, textTransform: "uppercase" }}>
        Employment specialist productivity
      </h3>

      {/* Productivity assumptions */}
      <div style={{ ...card, marginBottom: 16, display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={labelStyle}>Billable hrs / day</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#5a3800", ...M }}>{prod.billableHrsPerDay ?? 5}</div>
        </div>
        <div>
          <div style={labelStyle}>Drive time</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b", ...M }}>{prod.driveTimePct ?? 25}%</div>
        </div>
        <div>
          <div style={labelStyle}>Documentation</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#64748b", ...M }}>{prod.documentationTimePct ?? 15}%</div>
        </div>
        <div>
          <div style={labelStyle}>No-show / cancel</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#cf6e6e", ...M }}>{prod.noShowPct ?? 10}%</div>
        </div>
        <div>
          <div style={labelStyle}>Effective billable</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: effectivePct > 50 ? "#22c55e" : "#cf6e6e", ...M }}>{effectivePct.toFixed(0)}%</div>
        </div>
        <div style={{ padding: "6px 10px", background: "#fff3cd", borderRadius: 6, fontSize: 10, color: "#7a5100", ...M, maxWidth: 200, lineHeight: 1.5 }}>
          Rural specialists: drive time often exceeds 30%+ of workday. Consider rural wage differential.
        </div>
      </div>

      {/* Revenue waterfall */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ ...labelStyle, marginBottom: 10 }}>Revenue waterfall (annual)</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[
            { label: "Authorized", value: wf.authorized, color: "#94a3b8" },
            { label: `Earned (${revenue.completionRate ?? 90}%)`, value: wf.earned, color: "#5a3800" },
            { label: `Billed (${revenue.billingSuccessRate ?? 95}%)`, value: wf.billed, color: "#D4A520" },
            { label: `Collected (${revenue.collectionRate ?? 99}%)`, value: wf.collected, color: "#22c55e" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#64748b", ...M, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color, ...M }}>
                {canSeeCompanyDollars(userRole) ? $k(value) : "—"}
              </div>
            </div>
          ))}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#cf6e6e", ...M, marginBottom: 2 }}>Total leakage</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#cf6e6e", ...M }}>
              {canSeeCompanyDollars(userRole) ? $k(wf.authorized - wf.collected) : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Phase scaling thresholds */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ ...labelStyle, marginBottom: 10 }}>Phase-based service intensity thresholds</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {PHASES.map(ph => (
            <div key={ph} style={{ padding: "10px 14px", background: "#f7f9fc", borderRadius: 7, border: "1px solid #e2e8f0" }}>
              <div style={{ ...labelStyle, color: "#3b5fc0", marginBottom: 4 }}>{PHASE_LABELS[ph]}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#5a3800", ...M }}>
                {PHASE_THRESHOLDS[ph].typical} hr/wk <span style={{ fontWeight: 400, fontSize: 10, color: "#64748b" }}>typical</span>
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", ...M, marginTop: 2 }}>min: {PHASE_THRESHOLDS[ph].min} hr/wk</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "#64748b", ...M, marginTop: 10, lineHeight: 1.5 }}>
          Amber input highlight indicates a participant's hours are below the typical threshold for their phase.
          This does not affect calculations — it's a planning flag only.
        </div>
      </div>

      {/* Rate reference */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ ...labelStyle, marginBottom: 8 }}>Idaho adult DDA / CSE billing code reference</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 0.5fr 0.5fr", gap: 4, fontSize: 10, ...M }}>
          <div style={{ ...labelStyle, fontSize: 8 }}>Code</div>
          <div style={{ ...labelStyle, fontSize: 8, textAlign: "right" }}>Per 15-min</div>
          <div style={{ ...labelStyle, fontSize: 8, textAlign: "right" }}>Per hour</div>
          {BILLING_CODES.map(c => (
            <div key={c} style={{ display: "contents" }}>
              <span style={{ color: "#334155", padding: "3px 0" }}>{CODE_LABELS[c]}</span>
              <span style={{ textAlign: "right", color: "#D4A520", fontWeight: 700 }}>${CSE_RATES[c].toFixed(2)}</span>
              <span style={{ textAlign: "right", color: "#64748b" }}>${(CSE_RATES[c] * 4).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Specialist table */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1.6fr 0.7fr 0.8fr 1fr 1fr 0.8fr 0.8fr 0.8fr",
          padding: "10px 14px", background: "#eef1f6", borderBottom: "1px solid #d0dae8", ...labelStyle,
        }}>
          <span>Specialist</span>
          <span style={{ textAlign: "right" }}>Profile</span>
          <span style={{ textAlign: "right" }}>Caseload</span>
          <span style={{ textAlign: "right" }}>Billable hr/mo</span>
          <span style={{ textAlign: "right" }}>Total hr/mo</span>
          <span style={{ textAlign: "right" }}>Utilization</span>
          <span style={{ textAlign: "right" }}>Billable %</span>
          <span style={{ textAlign: "right" }}>Margin</span>
        </div>
        {summary.specialists.map(s => {
          const utilColor   = s.metrics.utilization > 1.05 ? "#cf6e6e" : s.metrics.utilization > 0.85 ? "#22c55e" : s.metrics.utilization > 0.65 ? "#f59e0b" : "#cf6e6e";
          const marginColor = s.metrics.grossMargin > 0.35 ? "#22c55e" : s.metrics.grossMargin > 0.15 ? "#f59e0b" : "#cf6e6e";
          return (
            <div key={s.id} style={{
              display: "grid", gridTemplateColumns: "1.6fr 0.7fr 0.8fr 1fr 1fr 0.8fr 0.8fr 0.8fr",
              padding: "10px 14px", borderBottom: "1px solid #f1f5f9", alignItems: "center", fontSize: 12, ...M,
            }}>
              <span style={{ color: "#5a3800", fontWeight: 600 }}>{s.name}</span>
              <span style={{ textAlign: "right", fontSize: 10, color: "#64748b" }}>{s.profile === 'rural' ? '🌾 Rural' : '🏙 Urban'}</span>
              <span style={{ textAlign: "right" }}>{s.metrics.caseloadSize}</span>
              <span style={{ textAlign: "right" }}>{s.metrics.monthlyBillable.toFixed(1)}</span>
              <span style={{ textAlign: "right" }}>{s.metrics.totalMonthlyHrs.toFixed(1)}</span>
              <span style={{ textAlign: "right", color: utilColor, fontWeight: 700 }}>{pct(s.metrics.utilization)}</span>
              <span style={{ textAlign: "right" }}>{pct(s.metrics.billableShare)}</span>
              <span style={{ textAlign: "right", color: marginColor, fontWeight: 700 }}>{pct(s.metrics.grossMargin)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// P&L tab (with office grouping when officeName is set)
// ──────────────────────────────────────────────────────────────────────
export function CSEPLTab({ config, userRole }) {
  const summary     = calcCSEService(config);
  const jd          = config.jobDevelopment ?? { fteCount: 1, salary: 52000 };
  const showDollars = canSeeCompanyDollars(userRole);

  if (summary.specialistCount === 0) {
    return (
      <div style={{ ...card, textAlign: "center", padding: 40, color: "#64748b" }}>
        <div style={{ fontSize: 13 }}>Add specialists in the Roster tab to see P&amp;L.</div>
      </div>
    );
  }

  const offices = {};
  summary.specialists.forEach(s => {
    const key = s.officeName?.trim() || '— Unassigned —';
    (offices[key] = offices[key] || []).push(s);
  });
  const isMultiOffice = Object.keys(offices).some(k => k !== '— Unassigned —');

  const cols = showDollars ? "2fr 1fr 1fr 1fr 1fr" : "2fr 1fr";
  const rowStyle = {
    display: "grid", gridTemplateColumns: cols,
    padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 12, ...M,
  };

  const renderSpecialistRow = (s) => (
    <div key={s.id} style={rowStyle}>
      <span style={{ color: "#5a3800", fontWeight: 600 }}>{s.name}
        <span style={{ fontSize: 9, color: "#94a3b8", marginLeft: 6 }}>{s.profile === 'rural' ? '🌾 Rural' : '🏙 Urban'}</span>
      </span>
      {showDollars && <span style={{ textAlign: "right", color: "#D4A520" }}>{$k(s.metrics.annualRev)}</span>}
      {showDollars && <span style={{ textAlign: "right" }}>{$k(s.metrics.annualLabor)}</span>}
      {showDollars && <span style={{ textAlign: "right", color: s.metrics.gross > 0 ? "#22c55e" : "#cf6e6e" }}>{$k(s.metrics.gross)}</span>}
      <span style={{ textAlign: "right", color: s.metrics.grossMargin > 0.3 ? "#22c55e" : s.metrics.grossMargin > 0.15 ? "#f59e0b" : "#cf6e6e" }}>
        {pct(s.metrics.grossMargin)}
      </span>
    </div>
  );

  const renderOfficeSubtotal = (ss, label) => {
    const rev   = ss.reduce((a, s) => a + s.metrics.annualRev, 0);
    const labor = ss.reduce((a, s) => a + s.metrics.annualLabor, 0);
    const gross = rev - labor;
    return (
      <div key={`sub_${label}`} style={{ ...rowStyle, background: "#f7f9fc", fontWeight: 700, borderTop: "1px solid #d0dae8" }}>
        <span style={{ color: "#475569" }}>{label} subtotal</span>
        {showDollars && <span style={{ textAlign: "right", color: "#D4A520" }}>{$k(rev)}</span>}
        {showDollars && <span style={{ textAlign: "right" }}>{$k(labor)}</span>}
        {showDollars && <span style={{ textAlign: "right", color: gross > 0 ? "#22c55e" : "#cf6e6e" }}>{$k(gross)}</span>}
        <span style={{ textAlign: "right", color: rev > 0 && gross / rev > 0.3 ? "#22c55e" : "#f59e0b" }}>{rev > 0 ? pct(gross / rev) : "—"}</span>
      </div>
    );
  };

  return (
    <div>
      <h3 style={{ ...M, fontSize: 14, color: "#5a3800", margin: "0 0 14px 0", letterSpacing: 1, textTransform: "uppercase" }}>
        Supported employment service line P&amp;L
      </h3>

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: cols,
          padding: "10px 14px", background: "#eef1f6", borderBottom: "1px solid #d0dae8", ...labelStyle,
        }}>
          <span>Specialist</span>
          {showDollars && <span style={{ textAlign: "right" }}>Annual Rev</span>}
          {showDollars && <span style={{ textAlign: "right" }}>Annual Labor</span>}
          {showDollars && <span style={{ textAlign: "right" }}>Gross</span>}
          <span style={{ textAlign: "right" }}>Margin</span>
        </div>

        {isMultiOffice
          ? Object.entries(offices).map(([office, ss]) => (
              <div key={office}>
                <div style={{ ...rowStyle, background: "#eef7ff", fontWeight: 700, fontSize: 10, color: "#3b5fc0", borderBottom: "1px solid #c7d9f0" }}>
                  <span>📍 {office}</span>
                </div>
                {ss.map(renderSpecialistRow)}
                {renderOfficeSubtotal(ss, office)}
              </div>
            ))
          : summary.specialists.map(renderSpecialistRow)
        }

        {/* Job development cost row */}
        {showDollars && (
          <div style={{ ...rowStyle, background: "#fdf4e7", color: "#78350f" }}>
            <span style={{ fontStyle: "italic" }}>Job development staff ({jd.fteCount ?? 1} FTE × {$k(jd.salary ?? 52000)}/yr)</span>
            <span style={{ textAlign: "right" }}>—</span>
            <span style={{ textAlign: "right" }}>{$k(summary.jobDevCost)}</span>
            <span style={{ textAlign: "right", color: "#cf6e6e" }}>({$k(summary.jobDevCost)})</span>
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
          {showDollars && <span style={{ textAlign: "right", color: "#e4eaf2" }}>{$k(summary.totalAnnualLabor + summary.jobDevCost)}</span>}
          {showDollars && <span style={{ textAlign: "right", color: summary.totalGross > 0 ? "#22c55e" : "#cf6e6e" }}>{$k(summary.totalGross)}</span>}
          <span style={{ textAlign: "right" }}>{pct(summary.totalMargin)}</span>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 14, background: "#f7f9fc", border: "1px solid #d0dae8", borderRadius: 8, fontSize: 11, color: "#475569", ...M, lineHeight: 1.6 }}>
        <strong>Note:</strong> Revenue reflects each participant's billing code rate (H2023 at {$k(CSE_RATES.SUPPORTED_EMPLOYMENT * 4)}/hr, 97537 at {$k(CSE_RATES.COMM_DEV_THERAPY * 4)}/hr, etc.). Direct labor only — company overhead, management fees, and billing fees flow through the Whole Company P&amp;L roll-up.
      </div>
    </div>
  );
}
