import { useState } from "react";

// Idaho CHIS (Children's Habilitation Intervention Services) rates post-9/1/2025
const CHIS_RATES = {
  BI_IND:  { TECH: 13.54, SPECIALIST: 15.48, PROFESSIONAL: 21.34, EBM_PARA: 14.34, EBM_SPEC: 18.51, EBM_PROF: 24.68 },
  BI_GRP:  { TECH: 5.41,  SPECIALIST: 6.18,  PROFESSIONAL: 8.53,  EBM_PARA: 5.73,  EBM_SPEC: 7.41,  EBM_PROF: 9.88  },
  SKILL_IND: 13.54,   // H2014 individual skill building / habilitative services
  FAMILY:    12.39,   // H0024 family education & training
  ASSESS:  { SPECIALIST: 15.48, PROFESSIONAL: 21.34, EBM_SPEC: 17.63, EBM_PROF: 21.82 },
  CRISIS:  { TECH: 8.71, SPECIALIST: 15.48, PROFESSIONAL: 21.34, EBM_PARA: 14.34, EBM_SPEC: 17.63, EBM_PROF: 21.82 },
};

const TIERS = ['TECH', 'SPECIALIST', 'PROFESSIONAL', 'EBM_PARA', 'EBM_SPEC', 'EBM_PROF'];
const TIER_LABELS = {
  TECH:         'Technician',
  SPECIALIST:   'Specialist',
  PROFESSIONAL: 'Professional',
  EBM_PARA:     'EBM Paraprofessional',
  EBM_SPEC:     'EBM Specialist',
  EBM_PROF:     'EBM Professional',
};

// ──────────────────────────────────────────────────────────────────────
// Factories
// ──────────────────────────────────────────────────────────────────────
let _ddaUid = 0;
const ddaUid = () => ++_ddaUid;

export function mkDDAParticipant(name = 'New Participant') {
  return {
    id: `ddap_${ddaUid()}`,
    name,
    services: {
      biIndividual:  { hrPerWk: 10 },
      biGroup:       { hrPerWk: 0  },
      skillBuilding: { hrPerWk: 0  },
      familyEd:      { hrPerMonth: 2 },
      assessment:    { sessionsPerYear: 1 },
    },
  };
}

export function mkDDAProvider(name = 'New Provider', tier = 'SPECIALIST', hourlyWage = 22) {
  return {
    id: `ddapv_${ddaUid()}`,
    name,
    tier,
    hourlyWage,
    officeName: '',
    participants: [],
  };
}

export function defaultChildrensDDAConfig() {
  return {
    providers: [],
    supervision: { count: 1, salary: 65000, providersPerSupervisor: 8 },
    seasonality: { enabled: false, summerMultiplier: 0.7, holidayReductionPct: 10 },
    productivity: { billableHrsPerDay: 5.5, cancellationRate: 12, driveTimePct: 15, documentationTimePct: 20 },
    payrollBurdenPct: 22,
    defaultHourlyWage: 22,
    defaultTier: 'SPECIALIST',
  };
}

// ──────────────────────────────────────────────────────────────────────
// Calculators
// ──────────────────────────────────────────────────────────────────────
export function calcDDAParticipant(p, tier = 'SPECIALIST') {
  const biIndMonthlyUnits  = (p.services?.biIndividual?.hrPerWk  ?? 0) * 4.33 * 4;
  const biGrpMonthlyUnits  = (p.services?.biGroup?.hrPerWk       ?? 0) * 4.33 * 4;
  const skillMonthlyUnits  = (p.services?.skillBuilding?.hrPerWk ?? 0) * 4.33 * 4;
  const familyMonthlyUnits = (p.services?.familyEd?.hrPerMonth   ?? 0) * 4;
  const assessMonthlyUnits = ((p.services?.assessment?.sessionsPerYear ?? 0) / 12) * 4;

  const biIndRate  = CHIS_RATES.BI_IND[tier]  ?? CHIS_RATES.BI_IND.SPECIALIST;
  const biGrpRate  = CHIS_RATES.BI_GRP[tier]  ?? CHIS_RATES.BI_GRP.SPECIALIST;
  const assessRate = CHIS_RATES.ASSESS[tier]  ?? CHIS_RATES.ASSESS.SPECIALIST ?? 15.48;

  const monthlyRev =
      biIndMonthlyUnits  * biIndRate
    + biGrpMonthlyUnits  * biGrpRate
    + skillMonthlyUnits  * CHIS_RATES.SKILL_IND
    + familyMonthlyUnits * CHIS_RATES.FAMILY
    + assessMonthlyUnits * assessRate;

  const monthlyHours =
    (biIndMonthlyUnits + biGrpMonthlyUnits + skillMonthlyUnits + familyMonthlyUnits + assessMonthlyUnits) / 4;

  return {
    monthlyRev,
    annualRev:   monthlyRev * 12,
    monthlyHours,
    annualHours: monthlyHours * 12,
  };
}

export function calcDDAProvider(pv, payrollBurdenPct = 22) {
  const px = (pv.participants ?? []).map(p => calcDDAParticipant(p, pv.tier));

  const monthlyRev      = px.reduce((a, p) => a + p.monthlyRev, 0);
  const monthlyBillable = px.reduce((a, p) => a + p.monthlyHours, 0);
  const adminMonthly    = 5 * 4.33; // 5 admin hrs/week — documentation, team meetings
  const totalMonthlyHrs = monthlyBillable + adminMonthly;

  const burden       = 1 + (payrollBurdenPct ?? 22) / 100;
  const monthlyLabor = totalMonthlyHrs * (pv.hourlyWage ?? 22) * burden;
  const annualLabor  = monthlyLabor * 12;
  const annualRev    = monthlyRev * 12;
  const gross        = annualRev - annualLabor;
  const FTE_HRS      = 160;

  return {
    px,
    caseloadSize:    (pv.participants ?? []).length,
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

export function calcChildrensDDAService(config) {
  const payrollBurdenPct = config.payrollBurdenPct ?? 22;

  const providers = (config.providers ?? []).map(pv => ({
    ...pv,
    metrics: calcDDAProvider(pv, payrollBurdenPct),
  }));

  const totalCaseload  = providers.reduce((a, pv) => a + pv.metrics.caseloadSize, 0);
  const totalAnnualRev = providers.reduce((a, pv) => a + pv.metrics.annualRev, 0);
  const totalAnnualLab = providers.reduce((a, pv) => a + pv.metrics.annualLabor, 0);

  const sup = config.supervision ?? { count: 1, salary: 65000 };
  const supervisionCost = (sup.count ?? 1) * (sup.salary ?? 65000) * (1 + payrollBurdenPct / 100);

  const totalGross = totalAnnualRev - totalAnnualLab - supervisionCost;

  return {
    providers,
    totalCaseload,
    totalAnnualRev,
    totalAnnualLabor: totalAnnualLab,
    supervisionCost,
    totalGross,
    totalMargin:   totalAnnualRev > 0 ? totalGross / totalAnnualRev : 0,
    providerCount: providers.length,
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

// ──────────────────────────────────────────────────────────────────────
// Participant row
// ──────────────────────────────────────────────────────────────────────
function DDAParticipantRow({ p, tier, onUpdate, onRemove }) {
  const m = calcDDAParticipant(p, tier);
  const svc = p.services ?? {};

  const updSvc = (field, subField, val) => onUpdate(p.id, "services", {
    ...svc, [field]: { ...(svc[field] ?? {}), [subField]: val },
  });

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1.3fr 0.6fr 0.6fr 0.6fr 0.7fr 0.7fr 1fr 0.4fr",
      gap: 6, alignItems: "center", padding: "6px 8px",
      borderRadius: 6, background: "#f7f9fc", border: "1px solid #e2e8f0",
    }}>
      <input type="text" value={p.name}
        onChange={e => onUpdate(p.id, "name", e.target.value)}
        style={textInput}/>
      <div>
        <div style={labelStyle}>BI Ind hr/wk</div>
        <input type="number" min={0} max={40} step={0.5}
          value={svc.biIndividual?.hrPerWk ?? 0}
          onChange={e => updSvc("biIndividual", "hrPerWk", +e.target.value)}
          style={numInput}/>
      </div>
      <div>
        <div style={labelStyle}>BI Grp hr/wk</div>
        <input type="number" min={0} max={40} step={0.5}
          value={svc.biGroup?.hrPerWk ?? 0}
          onChange={e => updSvc("biGroup", "hrPerWk", +e.target.value)}
          style={numInput}/>
      </div>
      <div>
        <div style={labelStyle}>Skill hr/wk</div>
        <input type="number" min={0} max={40} step={0.5}
          value={svc.skillBuilding?.hrPerWk ?? 0}
          onChange={e => updSvc("skillBuilding", "hrPerWk", +e.target.value)}
          style={numInput}/>
      </div>
      <div>
        <div style={labelStyle}>Family hr/mo</div>
        <input type="number" min={0} max={40} step={0.5}
          value={svc.familyEd?.hrPerMonth ?? 0}
          onChange={e => updSvc("familyEd", "hrPerMonth", +e.target.value)}
          style={numInput}/>
      </div>
      <div>
        <div style={labelStyle}>Assess/yr</div>
        <input type="number" min={0} max={12}
          value={svc.assessment?.sessionsPerYear ?? 0}
          onChange={e => updSvc("assessment", "sessionsPerYear", +e.target.value)}
          style={numInput}/>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#5a3800", ...M }}>{$k(m.monthlyRev)}/mo</div>
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
// Provider card
// ──────────────────────────────────────────────────────────────────────
function DDAProviderCard({ pv, payrollBurdenPct, onUpdate, onRemove, onAddParticipant, onUpdateParticipant, onRemoveParticipant }) {
  const [expanded, setExpanded] = useState(true);
  const m = calcDDAProvider(pv, payrollBurdenPct);

  const utilColor   = m.utilization > 1.05 ? "#cf6e6e" : m.utilization > 0.85 ? "#22c55e" : m.utilization > 0.65 ? "#f59e0b" : "#cf6e6e";
  const marginColor = m.grossMargin > 0.35 ? "#22c55e" : m.grossMargin > 0.15 ? "#f59e0b" : "#cf6e6e";

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <button onClick={() => setExpanded(e => !e)} style={{
          border: "none", background: "transparent", cursor: "pointer",
          fontSize: 14, color: "#5a3800", width: 20,
        }}>{expanded ? "▼" : "▶"}</button>

        <input type="text" value={pv.name}
          onChange={e => onUpdate(pv.id, "name", e.target.value)}
          style={{ ...textInput, fontWeight: 700, flex: 1, minWidth: 120, fontSize: 14 }}/>

        <div>
          <div style={labelStyle}>Tier</div>
          <select value={pv.tier}
            onChange={e => onUpdate(pv.id, "tier", e.target.value)}
            style={{ ...textInput, fontSize: 11, padding: "3px 6px" }}>
            {TIERS.map(t => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
          </select>
        </div>

        <div>
          <div style={labelStyle}>Wage / hr</div>
          <input type="number" min={10} max={80} step={0.5} value={pv.hourlyWage}
            onChange={e => onUpdate(pv.id, "hourlyWage", +e.target.value)}
            style={numInput}/>
        </div>

        <div>
          <div style={labelStyle}>Office</div>
          <input type="text" value={pv.officeName ?? ''}
            onChange={e => onUpdate(pv.id, "officeName", e.target.value)}
            placeholder="optional"
            style={{ ...textInput, width: 90, fontSize: 11 }}/>
        </div>

        <button onClick={() => onRemove(pv.id)} style={{
          border: "1px solid #e8d4d4", background: "#fff5f5",
          color: "#a14848", padding: "4px 10px", borderRadius: 5,
          fontSize: 10, cursor: "pointer", ...M,
        }}>Remove</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: expanded ? 12 : 0 }}>
        <Stat label="Caseload"       value={m.caseloadSize} />
        <Stat label="Annual Rev"     value={$k(m.annualRev)} color="#D4A520"/>
        <Stat label="Annual Labor"   value={$k(m.annualLabor)} />
        <Stat label="Gross"          value={$k(m.gross)} color={marginColor}/>
        <Stat label="Margin"         value={pct(m.grossMargin)} color={marginColor}/>
        <Stat label="Utilization"    value={pct(m.utilization)} color={utilColor}/>
        <Stat label="Billable share" value={pct(m.billableShare)} />
      </div>

      {expanded && (
        <div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1.3fr 0.6fr 0.6fr 0.6fr 0.7fr 0.7fr 1fr 0.4fr",
            gap: 6, padding: "4px 8px", ...labelStyle, marginBottom: 4,
          }}>
            <span>Participant</span>
            <span>BI Ind</span><span>BI Grp</span><span>Skill</span>
            <span>Family</span><span>Assess</span>
            <span style={{ textAlign: "right" }}>Revenue</span>
            <span></span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(pv.participants ?? []).map(p =>
              <DDAParticipantRow key={p.id} p={p} tier={pv.tier}
                onUpdate={(id, f, v) => onUpdateParticipant(pv.id, id, f, v)}
                onRemove={(id) => onRemoveParticipant(pv.id, id)}/>
            )}
          </div>
          <button onClick={() => onAddParticipant(pv.id)} style={{
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
export function ChildrensDDARosterTab({ config, onUpdate }) {
  const summary = calcChildrensDDAService(config);

  const updateField = (field, value) => onUpdate({ ...config, [field]: value });

  const updateProvider = (pvId, field, value) =>
    onUpdate({ ...config, providers: config.providers.map(pv => pv.id === pvId ? { ...pv, [field]: value } : pv) });

  const removeProvider = (pvId) =>
    onUpdate({ ...config, providers: config.providers.filter(pv => pv.id !== pvId) });

  const addProvider = () =>
    onUpdate({
      ...config,
      providers: [
        ...config.providers,
        mkDDAProvider(`Provider ${config.providers.length + 1}`, config.defaultTier ?? 'SPECIALIST', config.defaultHourlyWage ?? 22),
      ],
    });

  const addParticipant = (pvId) =>
    onUpdate({
      ...config,
      providers: config.providers.map(pv =>
        pv.id === pvId
          ? { ...pv, participants: [...(pv.participants ?? []), mkDDAParticipant(`Participant ${(pv.participants ?? []).length + 1}`)] }
          : pv
      ),
    });

  const updateParticipant = (pvId, pId, field, value) =>
    onUpdate({
      ...config,
      providers: config.providers.map(pv =>
        pv.id === pvId
          ? { ...pv, participants: pv.participants.map(p => p.id === pId ? { ...p, [field]: value } : p) }
          : pv
      ),
    });

  const removeParticipant = (pvId, pId) =>
    onUpdate({
      ...config,
      providers: config.providers.map(pv =>
        pv.id === pvId
          ? { ...pv, participants: pv.participants.filter(p => p.id !== pId) }
          : pv
      ),
    });

  const sup = config.supervision ?? { count: 1, salary: 65000, providersPerSupervisor: 8 };
  const updateSup = (field, val) => updateField("supervision", { ...sup, [field]: val });

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <Stat label="Providers"     value={summary.providerCount} />
        <Stat label="Total caseload" value={summary.totalCaseload} />
        <Stat label="Annual Rev"    value={$k(summary.totalAnnualRev)} color="#D4A520"/>
        <Stat label="Direct Labor"  value={$k(summary.totalAnnualLabor)} />
        <Stat label="Supervision"   value={$k(summary.supervisionCost)} />
        <Stat label="Gross"         value={$k(summary.totalGross)} color={summary.totalMargin > 0.25 ? "#22c55e" : "#cf6e6e"}/>
        <Stat label="Margin"        value={pct(summary.totalMargin)} color={summary.totalMargin > 0.25 ? "#22c55e" : "#cf6e6e"}/>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={labelStyle}>Burden %</span>
            <input type="number" min={0} max={50} step={0.5} value={config.payrollBurdenPct ?? 22}
              onChange={e => updateField("payrollBurdenPct", +e.target.value)}
              style={numInput}/>
          </div>
        </div>
      </div>

      {/* Supervision settings */}
      <div style={{ ...card, marginBottom: 16, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ ...labelStyle, fontSize: 10 }}>Clinical Supervision</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={labelStyle}>Supervisors</span>
          <input type="number" min={0} max={20} value={sup.count ?? 1}
            onChange={e => updateSup("count", +e.target.value)} style={{ ...numInput, width: 48 }}/>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={labelStyle}>Supervisor salary</span>
          <input type="number" min={30000} max={200000} step={1000} value={sup.salary ?? 65000}
            onChange={e => updateSup("salary", +e.target.value)} style={{ ...numInput, width: 80 }}/>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={labelStyle}>Providers / supervisor</span>
          <input type="number" min={1} max={20} value={sup.providersPerSupervisor ?? 8}
            onChange={e => updateSup("providersPerSupervisor", +e.target.value)} style={{ ...numInput, width: 48 }}/>
        </div>
        <div style={{ fontSize: 10, color: "#64748b", ...M }}>
          Annual cost: {$k((sup.count ?? 1) * (sup.salary ?? 65000) * (1 + (config.payrollBurdenPct ?? 22) / 100))}
        </div>
      </div>

      {/* Provider cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {config.providers.length === 0 && (
          <div style={{ ...card, textAlign: "center", padding: 40, color: "#64748b" }}>
            <div style={{ fontSize: 13, marginBottom: 8 }}>No providers yet.</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Add a provider to start building your Children's DDA caseload model.</div>
          </div>
        )}
        {config.providers.map(pv =>
          <DDAProviderCard key={pv.id} pv={pv}
            payrollBurdenPct={config.payrollBurdenPct}
            onUpdate={updateProvider}
            onRemove={removeProvider}
            onAddParticipant={addParticipant}
            onUpdateParticipant={updateParticipant}
            onRemoveParticipant={removeParticipant}/>
        )}
      </div>

      <button onClick={addProvider} style={{
        marginTop: 16, padding: "8px 18px",
        background: "#D4A520", border: "none", borderRadius: 6,
        color: "#5a3800", cursor: "pointer", fontSize: 12, fontWeight: 700, ...M,
      }}>+ Add provider</button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Productivity tab
// ──────────────────────────────────────────────────────────────────────
export function ChildrensDDAProductivityTab({ config }) {
  const summary = calcChildrensDDAService(config);
  const prod    = config.productivity ?? {};

  if (summary.providerCount === 0) {
    return (
      <div style={{ ...card, textAlign: "center", padding: 40, color: "#64748b" }}>
        <div style={{ fontSize: 13 }}>Add providers in the Roster tab to see productivity analysis.</div>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ ...M, fontSize: 14, color: "#5a3800", margin: "0 0 14px 0", letterSpacing: 1, textTransform: "uppercase" }}>
        Provider productivity
      </h3>

      <div style={{ ...card, marginBottom: 16, display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={labelStyle}>Billable hrs / day assumption</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#5a3800", ...M }}>{prod.billableHrsPerDay ?? 5.5}</div>
        </div>
        <div>
          <div style={labelStyle}>Cancellation rate</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b", ...M }}>{prod.cancellationRate ?? 12}%</div>
        </div>
        <div>
          <div style={labelStyle}>Drive time</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#64748b", ...M }}>{prod.driveTimePct ?? 15}%</div>
        </div>
        <div>
          <div style={labelStyle}>Documentation time</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#64748b", ...M }}>{prod.documentationTimePct ?? 20}%</div>
        </div>
        <div>
          <div style={labelStyle}>Effective billable %</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#22c55e", ...M }}>
            {(100 - (prod.cancellationRate ?? 12) - (prod.driveTimePct ?? 15) - (prod.documentationTimePct ?? 20)).toFixed(0)}%
          </div>
        </div>
        <div>
          <div style={labelStyle}>Supervision ratio</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#5a3800", ...M }}>
            {summary.providerCount}/{(config.supervision?.count ?? 1)}
          </div>
        </div>
      </div>

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1.6fr 0.7fr 1fr 1fr 1fr 0.8fr 0.8fr 0.8fr",
          padding: "10px 14px", background: "#eef1f6", borderBottom: "1px solid #d0dae8", ...labelStyle,
        }}>
          <span>Provider</span>
          <span style={{ textAlign: "right" }}>Tier</span>
          <span style={{ textAlign: "right" }}>Caseload</span>
          <span style={{ textAlign: "right" }}>Billable hr/mo</span>
          <span style={{ textAlign: "right" }}>Total hr/mo</span>
          <span style={{ textAlign: "right" }}>Utilization</span>
          <span style={{ textAlign: "right" }}>Billable %</span>
          <span style={{ textAlign: "right" }}>Margin</span>
        </div>
        {summary.providers.map(pv => {
          const utilColor   = pv.metrics.utilization > 1.05 ? "#cf6e6e" : pv.metrics.utilization > 0.85 ? "#22c55e" : pv.metrics.utilization > 0.65 ? "#f59e0b" : "#cf6e6e";
          const marginColor = pv.metrics.grossMargin > 0.35 ? "#22c55e" : pv.metrics.grossMargin > 0.15 ? "#f59e0b" : "#cf6e6e";
          return (
            <div key={pv.id} style={{
              display: "grid", gridTemplateColumns: "1.6fr 0.7fr 1fr 1fr 1fr 0.8fr 0.8fr 0.8fr",
              padding: "10px 14px", borderBottom: "1px solid #f1f5f9", alignItems: "center", fontSize: 12, ...M,
            }}>
              <span style={{ color: "#5a3800", fontWeight: 600 }}>{pv.name}</span>
              <span style={{ textAlign: "right", fontSize: 10, color: "#64748b" }}>{TIER_LABELS[pv.tier] ?? pv.tier}</span>
              <span style={{ textAlign: "right" }}>{pv.metrics.caseloadSize}</span>
              <span style={{ textAlign: "right" }}>{pv.metrics.monthlyBillable.toFixed(1)}</span>
              <span style={{ textAlign: "right" }}>{pv.metrics.totalMonthlyHrs.toFixed(1)}</span>
              <span style={{ textAlign: "right", color: utilColor, fontWeight: 700 }}>{pct(pv.metrics.utilization)}</span>
              <span style={{ textAlign: "right" }}>{pct(pv.metrics.billableShare)}</span>
              <span style={{ textAlign: "right", color: marginColor, fontWeight: 700 }}>{pct(pv.metrics.grossMargin)}</span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, padding: 14, background: "#fffbe8", border: "1px solid #f4e4a8", borderRadius: 8, fontSize: 11, color: "#5a3800", ...M, lineHeight: 1.6 }}>
        <strong>Supervision note:</strong> {summary.providerCount} direct providers ÷ {config.supervision?.count ?? 1} supervisors =&nbsp;
        {summary.providerCount > 0 ? (summary.providerCount / (config.supervision?.count ?? 1)).toFixed(1) : 0} providers/supervisor
        (target: ≤{config.supervision?.providersPerSupervisor ?? 8}).&nbsp;
        {summary.providerCount / (config.supervision?.count ?? 1) > (config.supervision?.providersPerSupervisor ?? 8)
          ? "⚠️ Over ratio — consider adding a supervisor."
          : "✓ Within recommended ratio."}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// P&L tab (with office grouping when officeName is set)
// ──────────────────────────────────────────────────────────────────────
export function ChildrensDDAPLTab({ config }) {
  const summary = calcChildrensDDAService(config);

  if (summary.providerCount === 0) {
    return (
      <div style={{ ...card, textAlign: "center", padding: 40, color: "#64748b" }}>
        <div style={{ fontSize: 13 }}>Add providers in the Roster tab to see P&amp;L.</div>
      </div>
    );
  }

  // Group by officeName when at least one provider has one set
  const offices = {};
  summary.providers.forEach(pv => {
    const key = pv.officeName?.trim() || '— Unassigned —';
    (offices[key] = offices[key] || []).push(pv);
  });
  const isMultiOffice = Object.keys(offices).some(k => k !== '— Unassigned —');

  const rowStyle = {
    display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
    padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 12, ...M,
  };

  const renderProviderRow = (pv) => (
    <div key={pv.id} style={rowStyle}>
      <span style={{ color: "#5a3800", fontWeight: 600 }}>{pv.name}
        <span style={{ fontSize: 9, color: "#94a3b8", marginLeft: 6 }}>{TIER_LABELS[pv.tier] ?? pv.tier}</span>
      </span>
      <span style={{ textAlign: "right", color: "#D4A520" }}>{$k(pv.metrics.annualRev)}</span>
      <span style={{ textAlign: "right" }}>{$k(pv.metrics.annualLabor)}</span>
      <span style={{ textAlign: "right", color: pv.metrics.gross > 0 ? "#22c55e" : "#cf6e6e" }}>{$k(pv.metrics.gross)}</span>
      <span style={{ textAlign: "right", color: pv.metrics.grossMargin > 0.3 ? "#22c55e" : pv.metrics.grossMargin > 0.15 ? "#f59e0b" : "#cf6e6e" }}>
        {pct(pv.metrics.grossMargin)}
      </span>
    </div>
  );

  const renderOfficeSubtotal = (pvs, label) => {
    const rev   = pvs.reduce((a, pv) => a + pv.metrics.annualRev, 0);
    const labor = pvs.reduce((a, pv) => a + pv.metrics.annualLabor, 0);
    const gross = rev - labor;
    return (
      <div key={`sub_${label}`} style={{
        ...rowStyle, background: "#f7f9fc", fontWeight: 700, borderTop: "1px solid #d0dae8",
      }}>
        <span style={{ color: "#475569" }}>{label} subtotal</span>
        <span style={{ textAlign: "right", color: "#D4A520" }}>{$k(rev)}</span>
        <span style={{ textAlign: "right" }}>{$k(labor)}</span>
        <span style={{ textAlign: "right", color: gross > 0 ? "#22c55e" : "#cf6e6e" }}>{$k(gross)}</span>
        <span style={{ textAlign: "right", color: rev > 0 && gross / rev > 0.3 ? "#22c55e" : "#f59e0b" }}>{rev > 0 ? pct(gross / rev) : "—"}</span>
      </div>
    );
  };

  return (
    <div>
      <h3 style={{ ...M, fontSize: 14, color: "#5a3800", margin: "0 0 14px 0", letterSpacing: 1, textTransform: "uppercase" }}>
        Children's DDA service line P&amp;L
      </h3>

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
          padding: "10px 14px", background: "#eef1f6", borderBottom: "1px solid #d0dae8", ...labelStyle,
        }}>
          <span>Provider</span>
          <span style={{ textAlign: "right" }}>Annual Rev</span>
          <span style={{ textAlign: "right" }}>Annual Labor</span>
          <span style={{ textAlign: "right" }}>Gross</span>
          <span style={{ textAlign: "right" }}>Margin</span>
        </div>

        {isMultiOffice
          ? Object.entries(offices).map(([office, pvs]) => (
              <div key={office}>
                <div style={{ ...rowStyle, background: "#eef7ff", fontWeight: 700, fontSize: 10, color: "#3b5fc0", borderBottom: "1px solid #c7d9f0" }}>
                  <span>📍 {office}</span>
                </div>
                {pvs.map(renderProviderRow)}
                {renderOfficeSubtotal(pvs, office)}
              </div>
            ))
          : summary.providers.map(renderProviderRow)
        }

        {/* Supervision cost row */}
        <div style={{ ...rowStyle, background: "#fdf4e7", color: "#78350f" }}>
          <span style={{ fontStyle: "italic" }}>Clinical supervision ({config.supervision?.count ?? 1} supervisor{(config.supervision?.count ?? 1) !== 1 ? 's' : ''})</span>
          <span style={{ textAlign: "right" }}>—</span>
          <span style={{ textAlign: "right" }}>{$k(summary.supervisionCost)}</span>
          <span style={{ textAlign: "right", color: "#cf6e6e" }}>({$k(summary.supervisionCost)})</span>
          <span style={{ textAlign: "right" }}>—</span>
        </div>

        {/* Total row */}
        <div style={{
          display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
          padding: "12px 14px", background: "#141d2c", color: "#D4A520",
          fontSize: 13, fontWeight: 800, ...M,
        }}>
          <span>Total</span>
          <span style={{ textAlign: "right" }}>{$k(summary.totalAnnualRev)}</span>
          <span style={{ textAlign: "right", color: "#e4eaf2" }}>{$k(summary.totalAnnualLabor + summary.supervisionCost)}</span>
          <span style={{ textAlign: "right", color: summary.totalGross > 0 ? "#22c55e" : "#cf6e6e" }}>{$k(summary.totalGross)}</span>
          <span style={{ textAlign: "right" }}>{pct(summary.totalMargin)}</span>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 14, background: "#f7f9fc", border: "1px solid #d0dae8", borderRadius: 8, fontSize: 11, color: "#475569", ...M, lineHeight: 1.6 }}>
        <strong>Note:</strong> Direct labor only. Supervision is the clinical supervisor cost at {$k((config.supervision?.count ?? 1) * (config.supervision?.salary ?? 65000))}/yr salary + {config.payrollBurdenPct ?? 22}% burden.
        Company overhead, management fees, and billing fees flow through the Whole Company P&amp;L roll-up.
      </div>
    </div>
  );
}
