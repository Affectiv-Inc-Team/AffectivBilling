# Rate specific and Service Rate Prompt

These updated fee schedules materially improve the projection prompts because now Mason can build the models around actual reimbursement mechanics instead of placeholder assumptions.  
Below are the revised/additional instructions you should append into each build prompt so the system architecture, rate tables, and utilization logic are grounded correctly.  

---

## Implementation notes (critical)

- G9007 must be displayed and modeled as **units a year**, not units a month, with an assumed ceiling of 48 units annually for plan development.  
- H2011 (all crisis assistance variants) should not appear on the main roster/caseload view; treat it as a secondary, rarely used code that is available in detailed views and configuration only.  

---

## Addition to the Children’s DDA Projection Tool Prompt

### Official Idaho Children’s DDA Fee Schedules

Build the system with editable Medicaid fee schedule tables using the following actual Idaho reimbursement rates.  
The tool architecture must support:

- Code-level reimbursement tracking  
- Modifier-level reimbursement differences  
- Individual vs group service economics  
- EBM vs non-EBM comparisons  
- Clinical credential profitability comparisons  
- Revenue forecasting by staff credential  

The model should allow filtering and forecasting by:

- Technician  
- Specialist  
- Professional  
- EBM Professional  
- Group vs Individual  
- Rural vs urban delivery  

---

## Habilitative Skill Building

| Code  | Modifier | Service                                    | Unit   | Rate   |
|-------|----------|---------------------------------------------|--------|--------|
| H2014 | —        | Habilitative Skill Building – Individual    | 15 min | 13.54  |
| H2014 | HQ       | Habilitative Skill Building – Group         | 15 min | 5.41   |

**Important modeling concepts:**

- Group profitability scaling  
- Transportation time burden  
- School-based utilization overlap  
- Parent cancellation impacts  
- Technician staffing ratios  

---

## Eligibility / Assessment / Treatment Planning

| Code  | Modifier | Service                                        | Rate   |
|-------|----------|------------------------------------------------|--------|
| H2000 | HN       | Eligibility Screening – Specialist             | 15.48  |
| H2000 | HO       | Eligibility Screening – Professional           | 21.34  |
| H2000 | TF       | Eligibility Screening – EBM Specialist         | 17.63  |
| H2000 | TG       | Eligibility Screening – EBM Professional       | 21.82  |
| H0032 | HN       | Assessment & Clinical Treatment Plan – Specialist    | 15.48  |
| H0032 | HO       | Assessment & Clinical Treatment Plan – Professional  | 21.34  |
| H0032 | TF       | Assessment & Clinical Treatment Plan – EBM Specialist | 17.63  |
| H0032 | TG       | Assessment & Clinical Treatment Plan – EBM Professional | 21.82  |

**Need:**

- Assessment conversion tracking  
- Reauthorization timing  
- Annual renewal forecasting  
- Intake pipeline forecasting  

---

## Behavioral Intervention — Individual

| Code  | Modifier | Service               | Rate   |
|-------|----------|-----------------------|--------|
| H0004 | HA       | Technician            | 13.54  |
| H0004 | HN       | Specialist            | 15.48  |
| H0004 | HO       | Professional          | 21.34  |
| H0004 | —        | EBM Paraprofessional  | 14.34  |
| H0004 | TF       | EBM Specialist        | 18.51  |
| H0004 | TG       | EBM Professional      | 24.68  |

**Important modeling concepts:**

- Revenue differences by credential level  
- Supervision burden  
- EBM profitability comparison  
- Session cancellation assumptions  
- Parent no-show impacts  
- School schedule variability  

---

## Behavioral Intervention — Group

| Code  | Modifier | Service          | Rate   |
|-------|----------|------------------|--------|
| H0005 | HA       | Technician       | 5.41   |
| H0005 | HN       | Specialist       | 6.18   |
| H0005 | HO       | Professional     | 8.53   |
| H0005 | —        | EBM Paraprofessional | 5.73 |
| H0005 | TF       | EBM Specialist   | 7.41   |
| H0005 | TG       | EBM Professional | 9.88   |

**Need:**

- Group size assumptions  
- Group profitability thresholds  
- Maximum safe staffing ratios  
- Utilization sensitivity analysis  

---

## Crisis Intervention

| Code  | Modifier | Service                  | Rate   |
|-------|----------|--------------------------|--------|
| H2011 | HA       | Technician               | 8.71   |
| H2011 | HM       | Intervention Technician  | 13.54  |
| H2011 | HN       | Specialist               | 15.48  |
| H2011 | HO       | Professional             | 21.34  |
| H2011 | —        | EBM Paraprofessional     | 14.34  |
| H2011 | TF       | EBM Specialist           | 17.63  |
| H2011 | TG       | EBM Professional         | 21.82  |

**Need:**

- Crisis unpredictability assumptions  
- On-call staffing burden  
- Non-billable standby time  

---

## Children’s Support Services

| Code  | Modifier | Service                               | Rate   |
|-------|----------|---------------------------------------|--------|
| H0024 | —        | Family Education – Individual         | 12.39  |
| H0024 | HQ       | Family Education – Group              | 4.13   |
| H2015 | HA       | Community Based Supports – Individual | 6.97   |
| H2015 | HQ       | Community Based Supports – Group      | 2.78   |
| T1005 | —        | Respite – Individual                  | 3.51   |
| T1005 | HQ       | Respite – Group                       | 1.17   |

**Need:**

- Group profitability warnings  
- Transportation and travel assumptions  
- Utilization caps  
- Parent scheduling inconsistency assumptions  

---

## Important Children’s DDA Limitations to Model

The tool must support:

- School calendar fluctuations  
- Summer utilization spikes  
- Session cancellation rates  
- Parent no-shows  
- Drive-time inefficiency  
- Supervision ratios  
- Documentation burden  
- Clinical QA burden  
- Credential-specific productivity assumptions  

**Need editable assumptions for:**

- Billable %  
- Payroll burden %  
- PTO %  
- Turnover %  
- Training %  
- Supervisor-to-staff ratios  

---

## Addition to the TSC Projection Tool Prompt

### Official Idaho TSC Fee Schedules

The system must use the following Idaho reimbursement structure.  
The architecture should support:

- Adult TSC  
- Children’s TSC  
- Professional vs paraprofessional reimbursement  
- Plan development forecasting  
- Crisis assistance forecasting  
- Caseload scaling  

---

## Adult DD Service Coordination

| Code  | Modifier | Service                               | Unit   | Rate   |
|-------|----------|---------------------------------------|--------|--------|
| G9002 | —        | DD Service Coordination              | 15 min | 20.97  |
| G9002 | HM       | DD Service Coordination – Paraprofessional | 15 min | 13.46 |
| G9007 | —        | DD Plan Development                  | 15 min | 20.97  |
| H2011 | —        | DD Crisis Assistance                 | 15 min | 20.97  |
| H2011 | HM       | DD Crisis Assistance – Paraprofessional | 15 min | 13.46 |

---

## Children’s Service Coordination

| Code  | Modifier | Service                                      | Unit   | Rate   |
|-------|----------|----------------------------------------------|--------|--------|
| G9002 | —        | Children’s Service Coordination              | 15 min | 20.97  |
| G9002 | HM       | Children’s Service Coordination – Paraprofessional | 15 min | 13.46 |
| G9007 | —        | Children’s Plan Development                  | 15 min | 20.97  |
| H2011 | —        | Children’s Crisis Assistance                 | 15 min | 20.97  |
| H2011 | HM       | Children’s Crisis Assistance – Paraprofessional | 15 min | 13.46 |

---

## Important TSC Modeling Requirements

**Need configurable assumptions for:**

- Monthly contact completion rates  
- Quarterly face-to-face compliance  
- Annual plan development completion  
- Caseload churn  
- Intake growth  
- Travel burden  
- Documentation lag  
- QA corrections  
- Non-billable coordination time  

**Known TSC limitations to model (configurable operational assumptions):**

- Monthly unit limitations  
- Annual plan development limitations  
- Caseload saturation points  
- Rural drive-time inefficiency  
- Staff turnover impacts  
- Medicaid denial/write-off assumptions  

**Need visibility into:**

- Revenue per coordinator  
- Revenue per caseload tier  
- Margin per coordinator  
- Break-even caseload size  

---

## Addition to the Community Supported Employment (CSE) Prompt

### Official Idaho Adult DDA / Employment-Related Fee Schedules

Use the following actual Idaho HCBS reimbursement structures wherever applicable.  

---

## Adult DDA Clinical / HCBS Services

| Code  | Service                                  | Unit   | Rate   |
|-------|------------------------------------------|--------|--------|
| 97537 | Home/Community Developmental Therapy     | 15 min | 6.01   |
| H2032 | Center-Based Developmental Therapy       | 15 min | 4.00   |
| H2000 | Developmental Therapy Evaluation         | 15 min | 16.27  |
| H2011 | Community Crisis Supports                | 15 min | 10.90  |

---

## Community Supported Employment Modeling Concepts

Even where employment-specific rates vary by provider structure, the system should support:

- Individual job coaching  
- Group employment supports  
- Job development  
- Employer outreach  
- Retention/follow-along services  
- Transportation burden  
- Travel inefficiency  
- Rural employer density limitations  

**Need configurable:**

- Billable coaching %  
- Placement conversion %  
- Retention %  
- Average participant intensity  
- Average coaching hours/week  

---

## Important Scaling Logic

The system should identify:

- When additional supervisors are needed  
- When QA staff become necessary  
- When dedicated intake staff become necessary  
- When geography creates staffing inefficiency  
- When utilization drops below sustainability thresholds  

The goal is to build an operational intelligence engine, not merely a spreadsheet.  
