# Idaho Medicaid Service Rate Reference

This document consolidates official Idaho Medicaid fee schedule data and key modeling requirements for the TSC, Children's DDA, and CSE projection tools. All rates reflect the post-9/1/2025 schedule.

---

## Implementation Notes

- **G9007 (Plan Development):** Model as units per year, not per month. Use a ceiling of 48 units annually.
- **H2011 (Crisis Assistance):** Do not display on the primary roster or caseload view. Surface it only through detailed configuration views.

---

## Children's DDA Services

### System Architecture Requirements

The Children's DDA tool must support:

- Code-level and modifier-level reimbursement tracking
- Individual vs. group service economics
- EBM vs. non-EBM profitability comparisons
- Revenue forecasting by clinical credential
- Filtering by technician, specialist, professional, EBM tier, group/individual, and rural/urban setting

---

### Habilitative Skill Building

| Code  | Modifier | Service                                  | Unit   | Rate  |
|-------|----------|------------------------------------------|--------|-------|
| H2014 | —        | Habilitative Skill Building – Individual | 15 min | 13.54 |
| H2014 | HQ       | Habilitative Skill Building – Group      | 15 min | 5.41  |

**Modeling requirements:** Group profitability scaling; transportation time burden; school-based utilization overlap; parent cancellation impacts; technician staffing ratios.

---

### Eligibility / Assessment / Treatment Planning

| Code  | Modifier | Service                                                  | Rate  |
|-------|----------|----------------------------------------------------------|-------|
| H2000 | HN       | Eligibility Screening – Specialist                       | 15.48 |
| H2000 | HO       | Eligibility Screening – Professional                     | 21.34 |
| H2000 | TF       | Eligibility Screening – EBM Specialist                   | 17.63 |
| H2000 | TG       | Eligibility Screening – EBM Professional                 | 21.82 |
| H0032 | HN       | Assessment & Clinical Treatment Plan – Specialist        | 15.48 |
| H0032 | HO       | Assessment & Clinical Treatment Plan – Professional      | 21.34 |
| H0032 | TF       | Assessment & Clinical Treatment Plan – EBM Specialist    | 17.63 |
| H0032 | TG       | Assessment & Clinical Treatment Plan – EBM Professional  | 21.82 |

**Modeling requirements:** Assessment-to-authorization conversion tracking; reauthorization timing; annual renewal forecasting; intake pipeline forecasting.

---

### Behavioral Intervention — Individual

| Code  | Modifier | Service               | Rate  |
|-------|----------|-----------------------|-------|
| H0004 | HA       | Technician            | 13.54 |
| H0004 | HN       | Specialist            | 15.48 |
| H0004 | HO       | Professional          | 21.34 |
| H0004 | —        | EBM Paraprofessional  | 14.34 |
| H0004 | TF       | EBM Specialist        | 18.51 |
| H0004 | TG       | EBM Professional      | 24.68 |

**Modeling requirements:** Revenue differential by credential level; supervision burden; EBM vs. non-EBM profitability comparison; session cancellation and parent no-show assumptions; school schedule variability.

---

### Behavioral Intervention — Group

| Code  | Modifier | Service               | Rate |
|-------|----------|-----------------------|------|
| H0005 | HA       | Technician            | 5.41 |
| H0005 | HN       | Specialist            | 6.18 |
| H0005 | HO       | Professional          | 8.53 |
| H0005 | —        | EBM Paraprofessional  | 5.73 |
| H0005 | TF       | EBM Specialist        | 7.41 |
| H0005 | TG       | EBM Professional      | 9.88 |

**Modeling requirements:** Group size assumptions; profitability thresholds by group composition; maximum safe staffing ratios; utilization sensitivity analysis.

---

### Crisis Intervention

| Code  | Modifier | Service                  | Rate  |
|-------|----------|--------------------------|-------|
| H2011 | HA       | Technician               | 8.71  |
| H2011 | HM       | Intervention Technician  | 13.54 |
| H2011 | HN       | Specialist               | 15.48 |
| H2011 | HO       | Professional             | 21.34 |
| H2011 | —        | EBM Paraprofessional     | 14.34 |
| H2011 | TF       | EBM Specialist           | 17.63 |
| H2011 | TG       | EBM Professional         | 21.82 |

**Modeling requirements:** Crisis unpredictability assumptions; on-call staffing burden; non-billable standby time. Per the implementation notes above, H2011 should not appear on primary roster views.

---

### Children's Support Services

| Code  | Modifier | Service                               | Rate  |
|-------|----------|---------------------------------------|-------|
| H0024 | —        | Family Education – Individual         | 12.39 |
| H0024 | HQ       | Family Education – Group              | 4.13  |
| H2015 | HA       | Community Based Supports – Individual | 6.97  |
| H2015 | HQ       | Community Based Supports – Group      | 2.78  |
| T1005 | —        | Respite – Individual                  | 3.51  |
| T1005 | HQ       | Respite – Group                       | 1.17  |

**Modeling requirements:** Group profitability warnings; transportation and travel assumptions; utilization caps; parent scheduling inconsistency.

---

### Children's DDA Operational Assumptions

The tool must model and expose editable assumptions for:

- School calendar fluctuations and summer utilization spikes
- Session cancellation and parent no-show rates
- Drive-time inefficiency
- Supervision ratios
- Documentation and clinical QA burden
- Billable %, payroll burden %, PTO %, turnover %, training %, supervisor-to-staff ratios

---

## TSC Services

### Rate Tables

**Adult DD Service Coordination**

| Code  | Modifier | Service                                       | Unit   | Rate  |
|-------|----------|-----------------------------------------------|--------|-------|
| G9002 | —        | DD Service Coordination                       | 15 min | 20.97 |
| G9002 | HM       | DD Service Coordination – Paraprofessional    | 15 min | 13.46 |
| G9007 | —        | DD Plan Development                           | 15 min | 20.97 |
| H2011 | —        | DD Crisis Assistance                          | 15 min | 20.97 |
| H2011 | HM       | DD Crisis Assistance – Paraprofessional       | 15 min | 13.46 |

**Children's Service Coordination**

| Code  | Modifier | Service                                            | Unit   | Rate  |
|-------|----------|----------------------------------------------------|--------|-------|
| G9002 | —        | Children's Service Coordination                    | 15 min | 20.97 |
| G9002 | HM       | Children's Service Coordination – Paraprofessional | 15 min | 13.46 |
| G9007 | —        | Children's Plan Development                        | 15 min | 20.97 |
| H2011 | —        | Children's Crisis Assistance                       | 15 min | 20.97 |
| H2011 | HM       | Children's Crisis Assistance – Paraprofessional    | 15 min | 13.46 |

### Modeling Requirements

The TSC tool must support configurable assumptions for:

- Monthly contact completion rates
- Quarterly face-to-face compliance
- Annual plan development completion (G9007 capped at 48 units/year; configurable)
- Caseload churn and intake growth
- Travel burden and documentation lag
- QA correction rework time
- Non-billable coordination time
- Medicaid denial and write-off assumptions
- Monthly unit limitations and caseload saturation points
- Rural drive-time inefficiency and staff turnover impacts

**Key financial visibility required:**

- Revenue per coordinator and per caseload tier
- Margin per coordinator
- Break-even caseload size

---

## CSE / Adult DDA Services

### Rate Tables

| Code  | Service                                  | Unit   | Rate  |
|-------|------------------------------------------|--------|-------|
| 97537 | Home/Community Developmental Therapy     | 15 min | 6.01  |
| H2032 | Center-Based Developmental Therapy       | 15 min | 4.00  |
| H2000 | Developmental Therapy Evaluation         | 15 min | 16.27 |
| H2011 | Community Crisis Supports                | 15 min | 10.90 |

### Modeling Requirements

The CSE tool should support:

- Individual job coaching and group employment supports
- Job development, employer outreach, and placement activities
- Stabilization and retention/follow-along services
- Transportation burden and travel inefficiency
- Rural employer density limitations

**Configurable assumptions:**

- Billable coaching %, placement conversion %, retention %
- Average participant intensity and coaching hours per week

---

## Scaling Logic (All Tools)

All three tools should automatically identify:

- When additional supervisors are needed based on caseload thresholds
- When QA staff become necessary
- When dedicated intake staff become necessary
- When geography creates staffing inefficiency
- When utilization drops below sustainability thresholds

The goal is operational intelligence, not a static spreadsheet.
