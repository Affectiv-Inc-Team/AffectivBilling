/**
 * TSC (Targeted Service Coordination) Service Line Module
 *
 * Caseload-coordinator financial model:
 *   - Each coordinator owns a caseload of participants
 *   - Each participant has authorized monthly units across:
 *       G9002 (Service Coordination)        — $20.97 / 15min  (HM = $13.46 paraprofessional)
 *       G9007 (Plan Development)            — $20.97 / 15min
 *       H2011 (Crisis Assistance)           — $20.97 / 15min  (HM = $13.46 paraprofessional)
 *   - Revenue = sum across participants × rate
 *   - Cost = coordinator hourly wage × (productive hrs from billed units + admin hrs)
 *
 * Config shape (lives at serviceLine.config when type === 'TSC'):
 * {
 *   coordinators: [
 *     {
 *       id: string,
 *       name: string,
 *       hourlyWage: number,
 *       adminHrsPerWeek: number,    // non-billable admin / drive / documentation
 *       participants: [
 *         {
 *           id, name,
 *           unitsCoord: number,     // G9002 monthly units
 *           unitsPlanDev: number,   // G9007 monthly units (typical: 0-4)
 *           unitsCrisis: number,    // H2011 monthly units (typical: 0)
 *           isParapro: boolean,     // bill at HM (paraprofessional) rate
 *         }
 *       ],
 *     }
 *   ],
 *   payrollBurdenPct: number,       // employer-side burden, default 22
 *   defaultUnitsPerParticipant: number,
 *   defaultHourlyWage: number,
 *   defaultAdminHrsPerWeek: number,
 * }
 */

import { useState } from "react";
import { wageDisplayMode, canSeeCompanyDollars } from "../lib/access.js";

// ──────────────────────────────────────────────────────────────────────
// Rate constants (mirror the post-9/1/2025 Idaho catalog)
// Could be pulled from idahoRates.js; inlined here so the module
// is self-contained for review.
// ──────────────────────────────────────────────────────────────────────
const TSC_RATES = {
  COORD:           20.97,  // G9002
  COORD_PARAPRO:   13.46,  // G9002 HM
  PLAN_DEV:        20.97,  // G9007
  CRISIS:          20.97,  // H2011
  CRISIS_PARAPRO:  13.46,  // H2011 HM
};

// ──────────────────────────────────────────────────────────────────────
// Factories
// ──────────────────────────────────────────────────────────────────────
let _tscUid = 0;
const tscUid = () => ++_tscUid;

export function mkParticipant(name = "New Participant", unitsCoord = 16) {
  return {
    id: `tscp_${tscUid()}`,
    name,
    unitsCoord,
    unitsPlanDev: 0,
    unitsCrisis: 0,
    isParapro: false,
  };
}

export function mkCoordinator(name = "New Coordinator", hourlyWage = 22) {
  return {
    id: `tscc_${tscUid()}`,
    name,
    hourlyWage,
    adminHrsPerWeek: 5,
    participants: [],
  };
}

export function defaultTSCConfig() {
  return {
    coordinators: [],
    payrollBurdenPct: 22,
    defaultUnitsPerParticipant: 16,
    defaultHourlyWage: 22,
    defaultAdminHrsPerWeek: 5,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Calculators
// ──────────────────────────────────────────────────────────────────────
export function calcTSCParticipant(p) {
  const rateCoord  = p.isParapro ? TSC_RATES.COORD_PARAPRO  : TSC_RATES.COORD;
  const rateCrisis = p.isParapro ? TSC_RATES.CRISIS_PARAPRO : TSC_RATES.CRISIS;
  const ratePlan   = TSC_RATES.PLAN_DEV;

  const monthlyRev = (p.unitsCoord    ?? 0) * rateCoord
                   + (p.unitsPlanDev  ?? 0) * ratePlan
                   + (p.unitsCrisis   ?? 0) * rateCrisis;

  // 1 unit = 15 min, so 4 units = 1 hour
  const monthlyHours = ((p.unitsCoord ?? 0) + (p.unitsPlanDev ?? 0) + (p.unitsCrisis ?? 0)) / 4;

  return {
    monthlyRev,
    annualRev:    monthlyRev * 12,
    monthlyHours,
    annualHours:  monthlyHours * 12,
  };
}

export function calcTSCCoordinator(c, payrollBurdenPct = 22) {
  const px = (c.participants ?? []).map(calcTSCParticipant);

  const monthlyRev      = px.reduce((a, p) => a + p.monthlyRev, 0);
  const monthlyBillable = px.reduce((a, p) => a + p.monthlyHours, 0);
  const adminMonthly    = (c.adminHrsPerWeek ?? 0) * 4.33;  // weeks/month
  const totalMonthlyHrs = monthlyBillable + adminMonthly;

  const burden = 1 + (payrollBurdenPct ?? 22) / 100;
  const monthlyLabor = totalMonthlyHrs * (c.hourlyWage ?? 22) * burden;
  const annualLabor  = monthlyLabor * 12;
  const annualRev    = monthlyRev * 12;
  const gross        = annualRev - annualLabor;

  // Utilization metrics — assume 160 hr/month FTE
  const FTE_HRS = 160;
  const utilization = totalMonthlyHrs / FTE_HRS;
  const billableShare = totalMonthlyHrs > 0 ? monthlyBillable / totalMonthlyHrs : 0;

  return {
    px,
    caseloadSize:    (c.participants ?? []).length,
    monthlyRev,
    annualRev,
    monthlyBillable,
    adminMonthly,
    totalMonthlyHrs,
    monthlyLabor,
    annualLabor,
    gross,
    grossMargin:     annualRev > 0 ? gross / annualRev : 0,
    utilization,
    billableShare,
  };
}

export function calcTSCService(config) {
  const coordinators = (config.coordinators ?? []).map(c => ({
    ...c,
    metrics: calcTSCCoordinator(c, config.payrollBurdenPct ?? 22),
  }));

  const totalCaseload  = coordinators.reduce((a, c) => a + c.metrics.caseloadSize, 0);
  const totalAnnualRev = coordinators.reduce((a, c) => a + c.metrics.annualRev, 0);
  const totalAnnualLab = coordinators.reduce((a, c) => a + c.metrics.annualLabor, 0);
  const totalGross     = totalAnnualRev - totalAnnualLab;

  return {
    coordinators,
    totalCaseload,
    totalAnnualRev,
    totalAnnualLabor: totalAnnualLab,
    totalGross,
    totalMargin: totalAnnualRev > 0 ? totalGross / totalAnnualRev : 0,
    coordinatorCount: coordinators.length,
  };
}

// ──────────────────────────────────────────────────────────────────────
// UI helpers
// ──────────────────────────────────────────────────────────────────────
const $k = n => n.toLocaleString("en-US", { style:"currency", currency:"USD", maximumFractionDigits:0 });
const $d = n => `$${n.toFixed(2)}`;
const pct = n => `${(n * 100).toFixed(1)}%`;
const M = { fontFamily:"'DM Mono',monospace" };

const card = {
  background:"#ffffff",
  borderRadius:10,
  padding:14,
  border:"1px solid #d0dae8",
  boxShadow:"0 2px 8px rgba(0,0,0,0.04)",
};

const labelStyle = {
  fontSize:9, color:"#64748b", textTransform:"uppercase", letterSpacing:1.5, ...M,
};

const numInput = {
  width:64, padding:"3px 6px", border:"1px solid #c8d4e4",
  borderRadius:5, fontSize:12, ...M, textAlign:"right", background:"#fff",
};

const textInput = {
  padding:"4px 8px", border:"1px solid #c8d4e4",
  borderRadius:5, fontSize:13, fontFamily:"'Sora',sans-serif", background:"#fff",
};

// ──────────────────────────────────────────────────────────────────────
// Stat tile
// ──────────────────────────────────────────────────────────────────────
function Stat({ label, value, color = "#5a3800" }) {
  return (
    <div style={{ background:"#eef1f6", borderRadius:7, padding:"6px 12px", border:"1px solid #d0dae8" }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize:15, fontWeight:800, color, ...M, marginTop:2 }}>{value}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Participant row (inside a coordinator's card)
// ──────────────────────────────────────────────────────────────────────
function ParticipantRow({ p, onUpdate, onRemove }) {
  const m = calcTSCParticipant(p);
  return (
    <div style={{
      display:"grid", gridTemplateColumns:"1.4fr 0.8fr 0.8fr 0.8fr 0.6fr 1fr 0.4fr",
      gap:8, alignItems:"center", padding:"6px 8px",
      borderRadius:6, background:"#f7f9fc", border:"1px solid #e2e8f0",
    }}>
      <input
        type="text" value={p.name}
        onChange={e => onUpdate(p.id, "name", e.target.value)}
        style={textInput}
      />
      <div>
        <div style={labelStyle}>G9002</div>
        <input type="number" min={0} max={200} value={p.unitsCoord ?? 0}
          onChange={e => onUpdate(p.id, "unitsCoord", +e.target.value)}
          style={numInput}/>
      </div>
      <div>
        <div style={labelStyle}>G9007</div>
        <input type="number" min={0} max={50} value={p.unitsPlanDev ?? 0}
          onChange={e => onUpdate(p.id, "unitsPlanDev", +e.target.value)}
          style={numInput}/>
      </div>
      <div>
        <div style={labelStyle}>H2011</div>
        <input type="number" min={0} max={50} value={p.unitsCrisis ?? 0}
          onChange={e => onUpdate(p.id, "unitsCrisis", +e.target.value)}
          style={numInput}/>
      </div>
      <label style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:"#64748b", ...M }}>
        <input type="checkbox" checked={!!p.isParapro}
          onChange={e => onUpdate(p.id, "isParapro", e.target.checked)}/>
        HM
      </label>
      <div style={{ textAlign:"right" }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#5a3800", ...M }}>{$k(m.monthlyRev)}/mo</div>
        <div style={{ fontSize:9, color:"#64748b", ...M }}>{m.monthlyHours.toFixed(1)} hr/mo</div>
      </div>
      <button onClick={() => onRemove(p.id)} style={{
        border:"none", background:"transparent", cursor:"pointer",
        color:"#cf6e6e", fontSize:14, padding:4,
      }}>✕</button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Coordinator card (shows roster, expandable participant list)
// ──────────────────────────────────────────────────────────────────────
function CoordinatorCard({ coord, onUpdate, onRemove, onAddParticipant, onUpdateParticipant, onRemoveParticipant, payrollBurdenPct, userRole }) {
  const [expanded, setExpanded] = useState(true);
  const m = calcTSCCoordinator(coord, payrollBurdenPct);

  const utilColor =
    m.utilization > 1.05 ? "#cf6e6e" :
    m.utilization > 0.85 ? "#22c55e" :
    m.utilization > 0.65 ? "#f59e0b" : "#cf6e6e";

  const marginColor =
    m.grossMargin > 0.40 ? "#22c55e" :
    m.grossMargin > 0.20 ? "#f59e0b" : "#cf6e6e";

  return (
    <div style={card}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
        <button onClick={() => setExpanded(e => !e)} style={{
          border:"none", background:"transparent", cursor:"pointer",
          fontSize:14, color:"#5a3800", width:20,
        }}>{expanded ? "▼" : "▶"}</button>

        <input type="text" value={coord.name}
          onChange={e => onUpdate(coord.id, "name", e.target.value)}
          style={{ ...textInput, fontWeight:700, flex:1, fontSize:14 }}/>

        {wageDisplayMode(userRole) !== 'hidden' && (
          <div>
            <div style={labelStyle}>Wage / hr</div>
            <input type="number" min={10} max={60} step={0.5} value={coord.hourlyWage}
              onChange={e => onUpdate(coord.id, "hourlyWage", +e.target.value)}
              readOnly={wageDisplayMode(userRole) !== 'dollars'}
              style={numInput}/>
          </div>
        )}

        <div>
          <div style={labelStyle}>Admin hr/wk</div>
          <input type="number" min={0} max={40} step={0.5} value={coord.adminHrsPerWeek}
            onChange={e => onUpdate(coord.id, "adminHrsPerWeek", +e.target.value)}
            style={numInput}/>
        </div>

        <button onClick={() => onRemove(coord.id)} style={{
          border:"1px solid #e8d4d4", background:"#fff5f5",
          color:"#a14848", padding:"4px 10px", borderRadius:5,
          fontSize:10, cursor:"pointer", ...M,
        }}>Remove coordinator</button>
      </div>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom: expanded ? 12 : 0 }}>
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
          <div style={{ display:"grid",
            gridTemplateColumns:"1.4fr 0.8fr 0.8fr 0.8fr 0.6fr 1fr 0.4fr",
            gap:8, padding:"4px 8px",
            ...labelStyle, marginBottom:4,
          }}>
            <span>Participant</span>
            <span style={{ textAlign:"left" }}>G9002 u/mo</span>
            <span style={{ textAlign:"left" }}>G9007 u/mo</span>
            <span style={{ textAlign:"left" }}>H2011 u/mo</span>
            <span>Para</span>
            <span style={{ textAlign:"right" }}>Revenue</span>
            <span></span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {(coord.participants ?? []).map(p =>
              <ParticipantRow key={p.id} p={p}
                onUpdate={(id, f, v) => onUpdateParticipant(coord.id, id, f, v)}
                onRemove={(id) => onRemoveParticipant(coord.id, id)}/>
            )}
          </div>
          <button onClick={() => onAddParticipant(coord.id)} style={{
            marginTop:10, padding:"6px 14px",
            background:"#fff", border:"1px dashed #c8d4e4", borderRadius:6,
            color:"#5a3800", cursor:"pointer", fontSize:12, fontWeight:600, ...M,
          }}>+ Add participant</button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Roster tab — main editing UI for TSC
// ──────────────────────────────────────────────────────────────────────
export function TSCRosterTab({ config, onUpdate, userRole }) {
  const summary = calcTSCService(config);

  const updateField    = (field, value) => onUpdate({ ...config, [field]: value });
  const updateCoord    = (coordId, field, value) =>
    onUpdate({
      ...config,
      coordinators: config.coordinators.map(c => c.id === coordId ? { ...c, [field]: value } : c),
    });
  const removeCoord    = (coordId) =>
    onUpdate({
      ...config,
      coordinators: config.coordinators.filter(c => c.id !== coordId),
    });
  const addCoord = () => onUpdate({
    ...config,
    coordinators: [
      ...config.coordinators,
      mkCoordinator(`Coordinator ${config.coordinators.length + 1}`, config.defaultHourlyWage),
    ],
  });
  const addParticipant = (coordId) => onUpdate({
    ...config,
    coordinators: config.coordinators.map(c =>
      c.id === coordId
        ? { ...c, participants: [...c.participants, mkParticipant(`Participant ${c.participants.length + 1}`, config.defaultUnitsPerParticipant)] }
        : c
    ),
  });
  const updateParticipant = (coordId, pId, field, value) => onUpdate({
    ...config,
    coordinators: config.coordinators.map(c =>
      c.id === coordId
        ? { ...c, participants: c.participants.map(p => p.id === pId ? { ...p, [field]: value } : p) }
        : c
    ),
  });
  const removeParticipant = (coordId, pId) => onUpdate({
    ...config,
    coordinators: config.coordinators.map(c =>
      c.id === coordId
        ? { ...c, participants: c.participants.filter(p => p.id !== pId) }
        : c
    ),
  });

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16, alignItems:"center" }}>
        <Stat label="Coordinators"  value={summary.coordinatorCount} />
        <Stat label="Total caseload" value={summary.totalCaseload} />
        {canSeeCompanyDollars(userRole) && <Stat label="Annual Rev"   value={$k(summary.totalAnnualRev)} color="#D4A520"/>}
        {canSeeCompanyDollars(userRole) && <Stat label="Annual Labor" value={$k(summary.totalAnnualLabor)} />}
        {canSeeCompanyDollars(userRole) && <Stat label="Gross"        value={$k(summary.totalGross)} color={summary.totalMargin > 0.3 ? "#22c55e" : "#cf6e6e"}/>}
        <Stat label="Margin"         value={pct(summary.totalMargin)} color={summary.totalMargin > 0.3 ? "#22c55e" : "#cf6e6e"}/>
        <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
          <span style={labelStyle}>Burden %</span>
          <input type="number" min={0} max={50} step={0.5} value={config.payrollBurdenPct ?? 22}
            onChange={e => updateField("payrollBurdenPct", +e.target.value)}
            style={numInput}/>
        </div>
      </div>

      {/* Coordinator cards */}
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {config.coordinators.length === 0 && (
          <div style={{ ...card, textAlign:"center", padding:40, color:"#64748b" }}>
            <div style={{ fontSize:13, marginBottom:8 }}>No coordinators yet.</div>
            <div style={{ fontSize:11, color:"#94a3b8" }}>Add a coordinator to start building your TSC caseload model.</div>
          </div>
        )}
        {config.coordinators.map(coord =>
          <CoordinatorCard key={coord.id} coord={coord}
            payrollBurdenPct={config.payrollBurdenPct}
            onUpdate={updateCoord}
            onRemove={removeCoord}
            onAddParticipant={addParticipant}
            onUpdateParticipant={updateParticipant}
            onRemoveParticipant={removeParticipant}
            userRole={userRole}/>
        )}
      </div>

      <button onClick={addCoord} style={{
        marginTop:16, padding:"8px 18px",
        background:"#D4A520", border:"none", borderRadius:6,
        color:"#5a3800", cursor:"pointer", fontSize:12, fontWeight:700, ...M,
      }}>+ Add coordinator</button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Productivity tab — utilization analysis
// ──────────────────────────────────────────────────────────────────────
export function TSCProductivityTab({ config }) {
  const summary = calcTSCService(config);

  if (summary.coordinatorCount === 0) {
    return (
      <div style={{ ...card, textAlign:"center", padding:40, color:"#64748b" }}>
        <div style={{ fontSize:13 }}>Add coordinators in the Roster tab to see productivity analysis.</div>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ ...M, fontSize:14, color:"#5a3800", margin:"0 0 14px 0", letterSpacing:1, textTransform:"uppercase" }}>
        Coordinator productivity
      </h3>

      <div style={{ ...card, padding:0, overflow:"hidden" }}>
        <div style={{
          display:"grid", gridTemplateColumns:"1.4fr 0.8fr 1fr 1fr 1fr 0.8fr 0.8fr 0.8fr",
          gap:0, padding:"10px 14px", background:"#eef1f6", borderBottom:"1px solid #d0dae8",
          ...labelStyle,
        }}>
          <span>Coordinator</span>
          <span style={{ textAlign:"right" }}>Caseload</span>
          <span style={{ textAlign:"right" }}>Billable hr/mo</span>
          <span style={{ textAlign:"right" }}>Admin hr/mo</span>
          <span style={{ textAlign:"right" }}>Total hr/mo</span>
          <span style={{ textAlign:"right" }}>Utilization</span>
          <span style={{ textAlign:"right" }}>Billable %</span>
          <span style={{ textAlign:"right" }}>Margin</span>
        </div>
        {summary.coordinators.map(c => {
          const utilColor =
            c.metrics.utilization > 1.05 ? "#cf6e6e" :
            c.metrics.utilization > 0.85 ? "#22c55e" :
            c.metrics.utilization > 0.65 ? "#f59e0b" : "#cf6e6e";
          const marginColor =
            c.metrics.grossMargin > 0.40 ? "#22c55e" :
            c.metrics.grossMargin > 0.20 ? "#f59e0b" : "#cf6e6e";
          return (
            <div key={c.id} style={{
              display:"grid", gridTemplateColumns:"1.4fr 0.8fr 1fr 1fr 1fr 0.8fr 0.8fr 0.8fr",
              padding:"10px 14px", borderBottom:"1px solid #f1f5f9", alignItems:"center",
              fontSize:12, ...M,
            }}>
              <span style={{ color:"#5a3800", fontWeight:600 }}>{c.name}</span>
              <span style={{ textAlign:"right" }}>{c.metrics.caseloadSize}</span>
              <span style={{ textAlign:"right" }}>{c.metrics.monthlyBillable.toFixed(1)}</span>
              <span style={{ textAlign:"right" }}>{c.metrics.adminMonthly.toFixed(1)}</span>
              <span style={{ textAlign:"right" }}>{c.metrics.totalMonthlyHrs.toFixed(1)}</span>
              <span style={{ textAlign:"right", color:utilColor, fontWeight:700 }}>{pct(c.metrics.utilization)}</span>
              <span style={{ textAlign:"right" }}>{pct(c.metrics.billableShare)}</span>
              <span style={{ textAlign:"right", color:marginColor, fontWeight:700 }}>{pct(c.metrics.grossMargin)}</span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop:16, padding:14, background:"#fffbe8", border:"1px solid #f4e4a8", borderRadius:8, fontSize:11, color:"#5a3800", ...M, lineHeight:1.6 }}>
        <strong>Utilization color key:</strong> green = healthy 85-105% of an FTE (160 hr/month), amber = under-loaded
        (65-85%), red = either over-capacity (&gt;105%, burnout risk) or significantly under-utilized (&lt;65%, margin
        suffers). Billable share &lt; 75% suggests admin overhead is too high for the caseload.
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// P&L tab — coordinator-level + total
// ──────────────────────────────────────────────────────────────────────
export function TSCPLTab({ config, userRole }) {
  const summary    = calcTSCService(config);
  const showDollars = canSeeCompanyDollars(userRole);
  const cols = showDollars ? "2fr 1fr 1fr 1fr 1fr" : "2fr 1fr";

  if (summary.coordinatorCount === 0) {
    return (
      <div style={{ ...card, textAlign:"center", padding:40, color:"#64748b" }}>
        <div style={{ fontSize:13 }}>Add coordinators in the Roster tab to see P&amp;L.</div>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ ...M, fontSize:14, color:"#5a3800", margin:"0 0 14px 0", letterSpacing:1, textTransform:"uppercase" }}>
        TSC service line P&amp;L
      </h3>

      <div style={{ ...card, padding:0, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:cols, padding:"10px 14px", background:"#eef1f6", borderBottom:"1px solid #d0dae8", ...labelStyle }}>
          <span>Coordinator</span>
          {showDollars && <span style={{ textAlign:"right" }}>Annual Rev</span>}
          {showDollars && <span style={{ textAlign:"right" }}>Annual Labor</span>}
          {showDollars && <span style={{ textAlign:"right" }}>Gross</span>}
          <span style={{ textAlign:"right" }}>Margin</span>
        </div>
        {summary.coordinators.map(c => (
          <div key={c.id} style={{ display:"grid", gridTemplateColumns:cols, padding:"10px 14px", borderBottom:"1px solid #f1f5f9", fontSize:12, ...M }}>
            <span style={{ color:"#5a3800", fontWeight:600 }}>{c.name}</span>
            {showDollars && <span style={{ textAlign:"right", color:"#D4A520" }}>{$k(c.metrics.annualRev)}</span>}
            {showDollars && <span style={{ textAlign:"right" }}>{$k(c.metrics.annualLabor)}</span>}
            {showDollars && <span style={{ textAlign:"right", color: c.metrics.gross > 0 ? "#22c55e" : "#cf6e6e" }}>{$k(c.metrics.gross)}</span>}
            <span style={{ textAlign:"right", color: c.metrics.grossMargin > 0.3 ? "#22c55e" : c.metrics.grossMargin > 0.15 ? "#f59e0b" : "#cf6e6e" }}>
              {pct(c.metrics.grossMargin)}
            </span>
          </div>
        ))}
        <div style={{ display:"grid", gridTemplateColumns:cols, padding:"12px 14px", background:"#141d2c", color:"#D4A520", fontSize:13, fontWeight:800, ...M }}>
          <span>Total</span>
          {showDollars && <span style={{ textAlign:"right" }}>{$k(summary.totalAnnualRev)}</span>}
          {showDollars && <span style={{ textAlign:"right", color:"#e4eaf2" }}>{$k(summary.totalAnnualLabor)}</span>}
          {showDollars && <span style={{ textAlign:"right", color: summary.totalGross > 0 ? "#22c55e" : "#cf6e6e" }}>{$k(summary.totalGross)}</span>}
          <span style={{ textAlign:"right" }}>{pct(summary.totalMargin)}</span>
        </div>
      </div>

      <div style={{ marginTop:16, padding:14, background:"#f7f9fc", border:"1px solid #d0dae8", borderRadius:8, fontSize:11, color:"#475569", ...M, lineHeight:1.6 }}>
        <strong>Note:</strong> This P&amp;L is the TSC service line in isolation — direct labor only.
        Allocated company overhead, management fees, and billing fees flow through the Whole Company P&amp;L
        roll-up tab using the company's chosen allocation method.
      </div>
    </div>
  );
}
