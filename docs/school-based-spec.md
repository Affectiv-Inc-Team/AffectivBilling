# School-Based Services — Modeling Specification

This document consolidates the Idaho Medicaid school-based services fee schedule data and the
modeling decisions behind the School-Based Services projection tool. All rates reflect the
post-9/1/2025 schedule (statewide 4% reduction). Companion to `service-rate-spec.md` (TSC,
Children's DDA, CSE) and `TSC-spec.md`.

---

## Rate Table

Billing units are **mixed** — this is the defining feature of the service line. Therapies,
CBRS, and the psychiatric evaluation bill per 15-minute unit; psychotherapy bills per visit;
transportation bills per mile.

| Code  | Modifier   | Service                                    | Tier               | Unit   | Rate   |
|-------|------------|--------------------------------------------|--------------------|--------|--------|
| 90791 | SCHOOL     | Psychiatric Diagnostic Evaluation          | Licensed clinician | 15 min | 36.34  |
| 90832 | SCHOOL     | Psychotherapy 30 min                       | Licensed clinician | visit  | 68.96  |
| 90834 | SCHOOL     | Psychotherapy 45 min                       | Licensed clinician | visit  | 91.03  |
| 90837 | SCHOOL     | Psychotherapy 60 min                       | Licensed clinician | visit  | 134.77 |
| 92507 | HM         | Speech/Hearing Therapy — Individual        | Assistant          | 15 min | 13.69  |
| 92507 | HO         | Speech/Hearing Therapy — Individual        | Professional       | 15 min | 16.10  |
| 97110 | HO         | Individual Physical Therapy                | Professional       | 15 min | 24.60  |
| 97110 | CQ         | Individual Physical Therapy                | PT Assistant       | 15 min | 20.91  |
| 97530 | —          | Individual Occupational Therapy            | Tech               | 15 min | 6.23   |
| 97530 | HO_S       | Individual Occupational Therapy            | Professional       | 15 min | 29.33  |
| H2017 | SCHOOL     | Skills Building / CBRS — Individual        | CBRS Specialist    | 15 min | 15.44  |
| H2017 | SCHOOL_HQ  | Skills Building / CBRS — Group             | CBRS Specialist    | 15 min | 3.86   |
| A0080 | SCHOOL     | Transportation by School                   | —                  | mile   | 0.44   |

The catalog covers these 13 representative codes. The full Idaho school-based fee schedule
contains additional codes (evaluations, nursing, personal care); expansion is deferred until
licensee demand surfaces it.

---

## Model Architecture

The tool uses a **clinician roster** model, mirroring Children's DDA's provider → participant
structure: clinicians each carry a discipline, credential tier, hourly wage, weekly admin
hours, an optional school assignment, and a student caseload with per-service volumes.

### Disciplines and credential tiers

| Discipline | Tiers | Billing |
|---|---|---|
| Speech Therapy | Professional (HO) / Assistant (HM) | 15-min therapy units at tier rate |
| Physical Therapy | Professional (HO) / PT Assistant (CQ) | 15-min therapy units at tier rate |
| Occupational Therapy | Professional (HO_S) / Tech | 15-min therapy units at tier rate |
| Behavioral Health | Licensed clinician | Per-visit psychotherapy (30/45/60) + 90791 eval units |
| CBRS Skills Building | CBRS Specialist | H2017 individual/group 15-min units |

Changing a clinician's discipline resets their tier to the new discipline's first tier; the
rate resolver also falls back to the first tier on stale discipline/tier combinations so a
mismatch can never bill nothing silently. Transportation (A0080) is available to every
discipline as a revenue add-on with no clinician hours.

---

## Modeling Decisions (locked)

1. **School-year annualization.** Revenue and labor annualize over
   `schoolYear.weeksPerYear` (default **36**) plus `esyWeeks` (Extended School Year, default 0)
   — *not* 52 weeks and *not* a seasonality multiplier. This is the primary structural
   difference from the year-round service lines.
2. **Student absence rate is applied.** School absences directly kill billable sessions, so
   the absence rate (default 10%) scales both revenue and clinician service hours. Admin
   hours are unaffected. Documentation %, travel-between-schools %, and billable-hrs/day are
   display-only operational planning inputs (matching Children's DDA, where
   `calcDDAParticipant` never reads productivity).
3. **Clinicians are hourly, paid for service weeks only.** Annual labor =
   (weekly service hours + weekly admin hours) × service weeks × wage × (1 + payroll burden).
   Salaried year-round clinicians are a future option.
4. **CBRS group efficiency.** Group hours bill in full per student, but clinician time is
   shared: group hours ÷ group size (DDA rule).
5. **Psychotherapy fixes clinician time by visit length** (0.5 / 0.75 / 1.0 hours for
   30/45/60-minute visits). The 90791 eval bills annual 15-min units (4 units ≈ one 1-hour
   eval) outside the weekly cadence.
6. **Supervision and admin staff are excluded from the company roll-up's direct labor**
   (`totalAnnualLabor`), consistent with Children's DDA and TSC. They reduce the service
   line's own gross/margin.
7. **Company occupancy factor applies to school revenue in the Whole Company roll-up.**
   Occupancy is conceptually residential, but TSC/DDA/CSE accept the same treatment; the
   line is not special-cased.

---

## Tabs

| Tab | Contents | Access |
|---|---|---|
| Roster | School-year + supervision settings, clinician cards, expandable student service editors (discipline-aware) | All tiers; edit tiers 1–4 |
| Productivity | Assumption cards, per-clinician utilization table, school-year notes | All tiers |
| P&L | Per-clinician P&L grouped by school, supervision/admin rows, company-allocated P&L above | Tiers 1–3 only (dollar-gated `school_pl`) |
| Rate Schedule | All 13 codes with unit-aware columns and per-rate overrides | All tiers; edit tiers 1–4 |
| Staffing | Admin staff matrix (salary/hourly, FTE %, benefits %), productivity assumption editors, hours breakdown bar | All tiers; edit tiers 1–4 |
| Scenario | Rate / caseload / productivity / **school-year weeks** what-ifs, rate override panel, base-vs-scenario table | Tiers 1–4 only (senior-gated `school_scenario`) |

The Rate Schedule's hourly-equivalent column renders only for 15-minute-unit codes —
per-visit and per-mile codes have no hourly basis.

---

## Configurable Assumptions

- School weeks per year (default 36) and ESY weeks (default 0)
- Student absence rate % (applied; default 10)
- Documentation time % and travel-between-schools % (display-only; defaults 15 / 10)
- Billable hours per day (display-only; default 5)
- Payroll burden % (default 22), default hourly wage (default 30)
- Clinical supervision (count × salary, default 0 × $70,000)
- Admin staff (salary or hourly, FTE %, benefits %)
- Per-code rate overrides (`rateOverrides`, keyed by rate-table key)

## Scenario levers

- **Rate adjustment ±50%** — scales revenue only (labor is wage-driven)
- **Caseload count** — scales per-student service volumes proportionally (labor moves with it)
- **Productivity adjustment ±100%** — scales service volume per student
- **School-year weeks (10–52)** — re-annualizes revenue and labor; models ESY expansion or
  calendar changes

---

## Implementation Notes

- Module: `src/serviceLines/school_based.jsx` (rate table, calculators, six tabs).
- The types.js default config is an inline literal (the established convention — types.js
  never imports service-line modules). Calculators and tabs tolerate `config === {}` so
  service lines saved while the type was still catalog-status render safely.
- Tab gating lives in `FinancialTool.jsx` (`GATED_TABS` + `SENIOR_GATED_TABS`, duplicated in
  the reset effect and the render filter — update both). See
  `access-levels-and-rights.md` for the full tier matrix.
