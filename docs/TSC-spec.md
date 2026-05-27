# Prompt: Idaho Human Services Projection & Budget Tools

**From:** Shawn Johansson  
**Date:** Mon 5/18/2026 1:14 PM  
**Context:** Design requirements for a suite of financial projection and operational budgeting tools for Idaho Medicaid-related human services lines (TSC, Children’s DDA, CSE). These tools should mirror the philosophy and structure of existing Residential Habilitation (ResHab) projection models, with a strong emphasis on operational intelligence, scalability, and future web/Affectiv integration.[page:1]

---

## Global Objectives

- Build robust financial projection and operational budgeting tools for:
  - Idaho Targeted Service Coordination (TSC)
  - Idaho Children’s Developmental Disability Agency (DDA)
  - Idaho Community Supported Employment (CSE)[page:1]
- Mirror the structure and philosophy of existing ResHab models:
  - Revenue tied directly to authorizations and realistic utilization
  - Staffing tied to caseload and service intensity
  - Operational scalability and margin visibility at every level[page:1]
- Emphasize:
  - Operational intelligence over simple accounting
  - Scenario testing (rates, staffing, productivity)
  - Future web app / Affectiv module / multi-state scalability[page:1]

---

## Shared Core Design Requirements

Across all three tools, the models should provide:[page:1]

- **Inputs & Assumptions**
  - Input sheets with editable assumptions
  - Service rate tables (by code, service, or line)
  - Staffing matrices (roles, compensation, benefits)
  - Caseload matrices (participants, service intensity, ratios)[page:1]

- **Revenue Logic**
  - Revenue based on:
    - Authorized units vs realistic/actual units
    - Utilization scenarios (ideal, realistic, conservative)
    - Service mix and intensity
  - Distinct tracking of:
    - Authorized revenue
    - Earned revenue
    - Successfully billed revenue
    - Collected revenue[page:1]

- **Expense Logic**
  - Labor expenditures by role (salary and hourly modes)
  - Benefits, PTO, and payroll tax load percentages
  - Administrative and overhead allocations (compliance, IT, rent, software, insurance, training, etc.)[page:1]

- **Dashboards & Outputs**
  - Revenue dashboards (by service, role, participant, office)
  - Operational dashboards (caseloads, productivity, utilization, documentation completion, authorization usage)
  - Financial dashboards (EBITDA, net margin, labor %, admin %, revenue per FTE, contribution margin, cost per billable hour)[page:1]

- **Scenario Modeling**
  - Toggling for:
    - Rate increases/reductions
    - Caseload changes
    - Staffing mix changes
    - Productivity shifts
    - Seasonal impacts where applicable[page:1]

---

## Tool 1: Idaho Targeted Service Coordination (TSC)

### Purpose

Build a financial projection and operational budgeting tool for Idaho Medicaid Targeted Service Coordination (TSC) services, structurally aligned with existing ResHab models but adapted to TSC operations.[page:1]

### Primary Goals

- Forecast revenue based on:
  - Caseloads
  - Service mix
  - Productivity
  - Medicaid billing limitations[page:1]
- Forecast labor and operational expenditures by role.[page:1]
- Model scaling scenarios as caseloads increase or decrease.[page:1]
- Show profitability by:
  - Office
  - Region
  - Director
  - Company[page:1]
- Enable scenario testing for:
  - Reimbursement changes
  - Staffing changes
  - Productivity assumptions[page:1]
- Surface operational leverage points and break-even thresholds.[page:1]

### Design Philosophy (TSC)

- Revenue tied directly to service authorizations and realistic utilization.
- Caseloads are the core operational driver.
- Staffing scales according to caseload thresholds.
- Labor and overhead ratios stay visible at all times.
- Productivity assumptions are editable, with at least three scenarios:
  - Ideal utilization
  - Realistic utilization
  - Conservative utilization[page:1]

### Revenue Drivers (TSC)

Revenue should scale based on:[page:1]

- Number of participants  
- Service eligibility  
- Average billable units  
- Case manager productivity  
- Documentation completion rates  
- Missed billing assumptions[page:1]

### Expense Drivers (TSC)

Expenses should scale based on:[page:1]

- Staffing structure  
- Supervisory layers  
- Administrative burden  
- Compliance requirements  
- Regional office overhead[page:1]

### Services to Include (TSC)

1. **Targeted Service Coordination**  
   - Likely primary code: `T2023` (or Idaho-specific equivalent)[page:1]
   - Editable fields:
     - Monthly unit caps
     - Annual authorization assumptions
     - Average completed contacts
     - Average travel burden
     - Rural vs urban productivity[page:1]

2. **Plan Development**
   - Include:
     - Annual person-centered plan development
     - Initial vs annual renewals
     - Average hours required
     - Completion ratios[page:1]
   - Known limitation:
     - Historically capped around ~12 hours annually per participant (make this configurable).[page:1]

3. **Quarterly Monitoring / Contact Requirements**
   - Operational assumptions for:
     - Face-to-face monitoring
     - Phone monitoring
     - Annual reassessments
     - Documentation requirements[page:1]
   - Configurable:
     - Average completion rates
     - Non-billable coordination time
     - Travel time burden[page:1]

### Idaho TSC Considerations

- **Caseload Ratios (examples to compare)**
  - 25 participants
  - 35 participants
  - 45 participants
  - 60 participants[page:1]

- **Caseload Strategy Labels**
  - High-touch
  - Standard
  - Lean efficiency[page:1]

- **Productivity Assumptions**
  - Billable hours per day
  - Documentation completion lag
  - No-show percentages
  - Travel time loss
  - Rework from QA corrections[page:1]

### Staffing Structure (TSC)

**Direct Service Roles**

- TSC / Service Coordinator  
- Lead TSC  
- Clinical Supervisor  
- QA Reviewer[page:1]

**Administrative Roles**

- Scheduler  
- Intake Coordinator  
- Billing Specialist  
- Payroll / HR allocation  
- Director  
- Executive oversight[page:1]

**Shared Services**

- Intrinsic compliance support  
- Affectiv software allocation  
- Accounting / bookkeeping  
- IT  
- Office rent  
- Insurance  
- Training[page:1]

**Compensation Modes Needed**

- Salary mode  
- Hourly mode  
- Benefits load %  
- PTO burden %  
- Payroll tax burden %[page:1]

### TSC Outputs

- **Revenue**
  - Monthly recurring revenue
  - Revenue by service type
  - Revenue by coordinator
  - Revenue per participant
  - Revenue by office[page:1]

- **Operations**
  - Caseload per coordinator
  - Productivity ratios
  - Documentation completion %
  - Utilization %
  - Authorization usage %[page:1]

- **Financial**
  - EBITDA
  - Net margin
  - Labor %
  - Administrative %
  - Revenue per FTE
  - Contribution margin by coordinator[page:1]

### TSC Model Structure

- Input sheets
- Editable assumptions
- Service rate tables
- Staffing matrix
- Caseload matrix
- P&L outputs
- Dashboard outputs
- Scenario toggles[page:1]

---

## Tool 2: Idaho Children’s Developmental Disability Agency (DDA)

### Purpose

Build a comprehensive financial and operational budgeting tool for Idaho Children’s DDA services, aligned with ResHab and TSC philosophies.[page:1]

### Core Philosophy (DDA)

- Revenue tied to authorizations and utilization.
- Staffing tied to caseload and service intensity.
- Operational scalability is explicitly visible.
- Financial forecasting by role and service line.
- High visibility into labor burden and compliance overhead.[page:1]

### Leadership Questions to Answer

- Which staffing structures are sustainable?
- Which services are profitable vs loss leaders?
- How does scaling affect margin?
- What is the impact of Medicaid rate changes?
- What are clinical productivity thresholds?[page:1]

### Core Services & Structures (DDA)

**Behavioral Intervention (BI)**

- Include:
  - Individual BI
  - Group BI
  - BI supervision
  - BI consultation[page:1]
- Configurable:
  - 15-minute billing structures
  - Session utilization
  - Cancellation assumptions
  - Parent training ratios
  - School-based sessions
  - Community-based sessions[page:1]

**Developmental Therapy (DT)**

- Include:
  - Individual DT
  - Group DT
  - Supervision structures[page:1]
- Need:
  - Productivity assumptions
  - Therapist caseload assumptions
  - Session cancellation rates[page:1]

**Family Education / Training**

- Need:
  - Parent training units
  - Group training
  - Travel assumptions
  - Non-billable prep time[page:1]

**Interdisciplinary Training / Supervision**

- Include:
  - Clinical supervision time
  - BCBA/QIDP oversight
  - Documentation review
  - Program oversight[page:1]

### Time & Effort Accounting (DDA)

Model and differentiate:[page:1]

- Direct billable time  
- Drive time  
- Documentation time  
- Parent coordination time  
- School coordination time  
- Team meetings  
- Non-billable utilization loss[page:1]

### Staffing Structure (DDA)

**Clinical Roles**

- Behavioral Intervention Professional  
- DT Provider  
- Clinical Supervisor  
- BCBA  
- QIDP  
- Program Manager[page:1]

**Administrative Roles**

- Intake Coordinator  
- Scheduler  
- Billing Specialist  
- QA Reviewer  
- Director  
- HR/Payroll allocation[page:1]

**Shared Infrastructure**

- Intrinsic compliance support  
- Affectiv allocation  
- Insurance  
- Office rent  
- Training costs  
- Mileage reimbursement[page:1]

### Productivity Modeling (DDA)

Editable assumptions for:[page:1]

- Billable hours/day  
- Billable % of payroll hours  
- Cancellation/no-show rates  
- Documentation completion lag  
- School calendar fluctuations  
- Summer utilization changes[page:1]

Scenario comparisons between:[page:1]

- Ideal productivity  
- Realistic productivity  
- Burnout-risk productivity[page:1]

### Financial Outputs (DDA)

- Revenue per clinician  
- Revenue per participant  
- Margin per service line  
- Labor ratios  
- Clinical supervision burden  
- Cost per billable hour  
- EBITDA  
- Break-even caseloads[page:1]

### Children’s DDA Nuances

The tool should reflect that:[page:1]

- Services are heavily labor dependent.  
- High drive time reduces margin.  
- Supervision requirements add indirect labor burden.  
- School calendars materially impact revenue.  
- Parent cancellations affect utilization.[page:1]

Include seasonality modeling for:[page:1]

- Summer spikes  
- School-year reductions  
- Holiday utilization changes[page:1]

### Long-Term DDA Goals

- Multi-agency rollup reporting  
- Affectiv integration  
- Real-time productivity analytics  
- AI-assisted staffing optimization[page:1]

---

## Tool 3: Idaho Community Supported Employment (CSE)

### Purpose

Build an operational and financial projection tool for Idaho Community Supported Employment (CSE) services, aligned with ResHab model sophistication.[page:1]

### Core Philosophy (CSE)

- Revenue driven by participant utilization.
- Staffing driven by caseload and intensity.
- Financial scaling visible at every stage.
- Role-based budgeting.
- Operational KPI visibility.[page:1]

### Strategic Questions

Model:[page:1]

- Sustainable employment service delivery  
- Coach productivity  
- Placement success  
- Retention impacts  
- Labor efficiency  
- Scaling strategies[page:1]

### Services & Rate Structures (CSE)

**Job Coaching / Supported Employment**

- Common code: `H2023` Supported Employment (or Idaho-specific equivalent).[page:1]
- Need:
  - Individual support modeling
  - Group support modeling
  - Community support time
  - Employer coordination time[page:1]

**Job Development**

- Include:
  - Intake/job discovery
  - Employer outreach
  - Resume/interview support
  - Placement activities[page:1]
- Assumptions:
  - Non-billable prep
  - Travel
  - Outreach conversion rates[page:1]

**Stabilization / Retention Services**

- Need:
  - Follow-along supports
  - Reduced support phases
  - Long-term retention modeling[page:1]

### Key Operational Variables (CSE)

Editable assumptions for:[page:1]

- Average participant hours/week  
- Average coaching intensity  
- Rural travel burden  
- Employer density  
- Transportation challenges  
- Seasonal employment variation[page:1]

### Staffing Model (CSE)

**Direct Roles**

- Employment Specialist  
- Job Coach  
- Senior Job Coach  
- Employment Supervisor[page:1]

**Administrative Roles**

- Intake Coordinator  
- Billing  
- QA  
- Director  
- Recruiting Coordinator[page:1]

**Shared Services**

- Intrinsic support allocation  
- Affectiv software allocation  
- Insurance  
- Mileage  
- Office overhead  
- Recruiting/training costs[page:1]

### Productivity Modeling (CSE)

Configurable assumptions for:[page:1]

- Billable hours/day  
- Drive time %  
- Documentation time  
- Employer outreach conversion rates  
- Placement success rates  
- Retention percentages  
- Staff turnover impact[page:1]

Scenario comparisons for:[page:1]

- Rural office  
- Urban office  
- High-intensity participant mix  
- Independent participant mix[page:1]

### Financial Outputs (CSE)

Dashboards for:[page:1]

- Revenue per job coach  
- Revenue per participant  
- Margin by office  
- Labor ratios  
- Placement conversion rates  
- Retention outcomes  
- EBITDA  
- Cost per successful placement[page:1]

### Scaling Logic (CSE)

The model should automatically indicate when new hires are required based on:[page:1]

- Caseload thresholds  
- Geographic spread  
- Participant intensity  
- Documentation burden[page:1]

It should also indicate when:[page:1]

- Supervisors are required  
- QA becomes necessary  
- Dedicated intake staff become necessary[page:1]

### Long-Term CSE Structure

Design as though it will become:[page:1]

- A web-based operational intelligence platform  
- A module inside Affectiv  
- A multi-state scalable forecasting engine[page:1]

---

## Implementation Notes

- All three tools should share a consistent structural pattern (inputs → assumptions → rate tables → staffing/caseload matrices → P&L → dashboards → scenario toggles). This supports reuse and future integration.[page:1]
- Prioritize transparency of assumptions and drivers, so operators can quickly trace how changes in caseloads, rates, and staffing propagate to EBITDA and margins.[page:1]
- Build with an eye toward later converting these into production web modules (Affectiv), including multi-entity and multi-state support.[page:1]