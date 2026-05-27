# Idaho Human Services Projection Tools — Design Specification

**Author:** Shawn Johansson  
**Date:** May 18, 2026  
**Purpose:** Design requirements for a suite of financial projection and operational budgeting tools covering Idaho Medicaid human services lines — TSC, Children's DDA, and CSE. These tools should mirror the philosophy and structure of existing Residential Habilitation (ResHab) projection models, with a strong emphasis on operational intelligence, scalability, and future Affectiv integration.

---

## Global Objectives

Build robust financial projection and operational budgeting tools for:

- Idaho Targeted Service Coordination (TSC)
- Idaho Children's Developmental Disability Agency (DDA)
- Idaho Community Supported Employment (CSE)

Mirror the structure and philosophy of existing ResHab models:

- Revenue tied directly to authorizations and realistic utilization
- Staffing tied to caseload and service intensity
- Operational scalability and margin visibility at every level

Emphasize:

- Operational intelligence over simple accounting
- Scenario testing across rates, staffing, and productivity
- Future web app / Affectiv module / multi-state scalability

---

## Shared Core Design Requirements

All three tools share a consistent structural pattern: **inputs → assumptions → rate tables → staffing/caseload matrices → P&L → dashboards → scenario toggles.** Maintaining this pattern across tools supports reuse and future integration.

### Inputs & Assumptions

- Editable input sheets with explicit, traceable assumptions
- Service rate tables by code, service, or line
- Staffing matrices covering roles, compensation, and benefits
- Caseload matrices covering participants, service intensity, and ratios

### Revenue Logic

- Revenue calculated from authorized units vs. realistic/actual units
- Utilization scenarios: ideal, realistic, and conservative
- Distinct tracking of authorized revenue, earned revenue, successfully billed revenue, and collected revenue

### Expense Logic

- Labor costs by role (salary and hourly modes)
- Benefits, PTO, and payroll tax load percentages
- Administrative and overhead allocations (compliance, IT, rent, software, insurance, training)

### Dashboards & Outputs

- **Revenue dashboards:** by service, role, participant, and office
- **Operational dashboards:** caseloads, productivity, utilization, documentation completion, authorization usage
- **Financial dashboards:** EBITDA, net margin, labor %, admin %, revenue per FTE, contribution margin, cost per billable hour

### Scenario Modeling

Toggle for:

- Rate increases/reductions
- Caseload changes
- Staffing mix changes
- Productivity shifts
- Seasonal impacts where applicable

---

## Tool 1: Idaho Targeted Service Coordination (TSC)

### Purpose

Build a financial projection and operational budgeting tool for Idaho Medicaid Targeted Service Coordination services, structurally aligned with existing ResHab models but adapted to TSC operations.

### Primary Goals

- Forecast revenue based on caseloads, service mix, productivity, and Medicaid billing limitations
- Forecast labor and operational expenditures by role
- Model scaling scenarios as caseloads grow or contract
- Show profitability at the office, region, director, and company levels
- Enable scenario testing for reimbursement changes, staffing changes, and productivity assumptions
- Surface operational leverage points and break-even thresholds

### Design Philosophy

- Revenue tied directly to service authorizations and realistic utilization
- Caseloads are the core operational driver
- Staffing scales automatically according to caseload thresholds
- Labor and overhead ratios remain visible at all times
- Productivity assumptions are editable with three scenarios: ideal, realistic, and conservative

### Revenue Drivers

Revenue scales based on:

- Number of participants
- Service eligibility
- Average billable units
- Case manager productivity
- Documentation completion rates
- Missed billing assumptions

### Expense Drivers

Expenses scale based on:

- Staffing structure and supervisory layers
- Administrative and compliance burden
- Regional office overhead

### Services to Include

**1. Targeted Service Coordination**

- Primary code: `G9002` (15-min unit)
- Editable fields: monthly unit caps, annual authorization assumptions, average completed contacts, average travel burden, rural vs. urban productivity

**2. Plan Development**

- Primary code: `G9007` (15-min unit; 48-unit annual ceiling — configurable)
- Include initial plan development and annual renewals
- Configurable: average hours required, completion ratios

**3. Quarterly Monitoring / Contact Requirements**

- Operational assumptions for face-to-face monitoring, phone monitoring, annual reassessments, and documentation requirements
- Configurable: average completion rates, non-billable coordination time, travel time burden

### Idaho TSC Considerations

| Caseload Ratio   | Strategy Label   |
|------------------|------------------|
| 25 participants  | High-touch       |
| 35 participants  | Standard         |
| 45 participants  | Lean efficiency  |
| 60 participants  | Stretch target   |

**Productivity assumptions to model:**

- Billable hours per day
- Documentation completion lag
- No-show percentages
- Travel time loss
- Rework from QA corrections

### Staffing Structure

**Direct Service Roles**

- TSC / Service Coordinator
- Lead TSC
- Clinical Supervisor
- QA Reviewer

**Administrative Roles**

- Scheduler
- Intake Coordinator
- Billing Specialist
- Payroll / HR allocation
- Director
- Executive oversight

**Shared Services**

- Intrinsic compliance support
- Affectiv software allocation
- Accounting / bookkeeping, IT, office rent, insurance, training

**Compensation Modes**

- Salary and hourly modes
- Benefits load %, PTO burden %, payroll tax burden %

### TSC Outputs

| Category    | Metrics                                                                                                   |
|-------------|-----------------------------------------------------------------------------------------------------------|
| Revenue     | Monthly recurring revenue; by service type, coordinator, participant, and office                          |
| Operations  | Caseload per coordinator; productivity ratios; documentation completion %; utilization %; authorization usage % |
| Financial   | EBITDA; net margin; labor %; administrative %; revenue per FTE; contribution margin per coordinator       |

---

## Tool 2: Idaho Children's Developmental Disability Agency (DDA)

### Purpose

Build a comprehensive financial and operational budgeting tool for Idaho Children's DDA services, aligned with ResHab and TSC philosophies.

### Core Philosophy

- Revenue tied to authorizations and realistic utilization
- Staffing tied to caseload and service intensity
- Operational scalability explicitly visible at each stage
- Financial forecasting by role and service line
- High visibility into labor burden and compliance overhead

### Leadership Questions the Tool Must Answer

- Which staffing structures are financially sustainable?
- Which services are profitable vs. loss leaders?
- How does scaling affect margin?
- What is the impact of Medicaid rate changes?
- What are the thresholds for clinical productivity?

### Core Services & Structures

**Behavioral Intervention (BI)**

- Individual BI, group BI, BI supervision, and BI consultation
- Configurable: 15-minute billing units, session utilization, cancellation assumptions, parent training ratios, school-based and community-based sessions

**Developmental Therapy (DT)**

- Individual DT, group DT, and supervision structures
- Configurable: productivity assumptions, therapist caseloads, session cancellation rates

**Family Education / Training**

- Parent training units, group training
- Configurable: travel assumptions, non-billable prep time

**Interdisciplinary Supervision**

- Clinical supervision time, BCBA/QIDP oversight, documentation review, program oversight

### Time & Effort Accounting

Model and distinguish:

- Direct billable time
- Drive time
- Documentation time
- Parent coordination time
- School coordination time
- Team meetings
- Non-billable utilization loss

### Staffing Structure

**Clinical Roles:** Behavioral Intervention Professional, DT Provider, Clinical Supervisor, BCBA, QIDP, Program Manager

**Administrative Roles:** Intake Coordinator, Scheduler, Billing Specialist, QA Reviewer, Director, HR/Payroll allocation

**Shared Infrastructure:** Intrinsic compliance support, Affectiv allocation, insurance, office rent, training costs, mileage reimbursement

### Productivity Modeling

Editable assumptions for:

- Billable hours/day and billable % of payroll hours
- Cancellation/no-show rates
- Documentation completion lag
- School calendar fluctuations and summer utilization changes

Scenario comparisons: ideal productivity, realistic productivity, burnout-risk productivity.

### Financial Outputs

- Revenue per clinician and per participant
- Margin per service line
- Labor ratios and clinical supervision burden
- Cost per billable hour
- EBITDA and break-even caseloads

### Children's DDA Nuances

The tool must reflect that:

- Services are heavily labor dependent
- High drive time directly compresses margin
- Supervision requirements add significant indirect labor burden
- School calendars materially impact annual revenue
- Parent cancellations structurally reduce utilization

Include seasonality modeling for summer spikes, school-year reductions, and holiday utilization changes.

### Long-Term DDA Goals

- Multi-agency rollup reporting
- Affectiv integration
- Real-time productivity analytics
- AI-assisted staffing optimization

---

## Tool 3: Idaho Community Supported Employment (CSE)

### Purpose

Build an operational and financial projection tool for Idaho Community Supported Employment services, aligned with ResHab model sophistication.

### Core Philosophy

- Revenue driven by participant utilization
- Staffing driven by caseload and intensity
- Financial scaling visible at every stage
- Role-based budgeting with clear operational KPI visibility

### Strategic Questions to Model

- Sustainable employment service delivery structures
- Coach productivity thresholds
- Placement success and retention impacts
- Labor efficiency and scaling strategies

### Services & Rate Structures

**Job Coaching / Supported Employment**

- Primary code: `H2023` Supported Employment (or Idaho-specific equivalent)
- Model: individual support, group support, community support time, and employer coordination time

**Job Development**

- Include: intake/job discovery, employer outreach, resume and interview support, placement activities
- Configurable: non-billable prep time, travel, outreach conversion rates

**Stabilization / Retention Services**

- Follow-along supports, reduced support phases, long-term retention modeling

### Key Operational Variables

Editable assumptions for:

- Average participant hours/week and coaching intensity
- Rural travel burden and employer density
- Transportation challenges and seasonal employment variation

### Staffing Structure

**Direct Roles:** Employment Specialist, Job Coach, Senior Job Coach, Employment Supervisor

**Administrative Roles:** Intake Coordinator, Billing, QA, Director, Recruiting Coordinator

**Shared Services:** Intrinsic support allocation, Affectiv software allocation, insurance, mileage, office overhead, recruiting/training costs

### Productivity Modeling

Configurable assumptions for:

- Billable hours/day, drive time %, documentation time
- Employer outreach conversion rates, placement success rates, retention percentages
- Staff turnover impact

Scenario comparisons: rural office, urban office, high-intensity participant mix, independent participant mix.

### Financial Outputs

- Revenue per job coach and per participant
- Margin by office
- Labor ratios, placement conversion rates, retention outcomes
- EBITDA and cost per successful placement

### Scaling Logic

The model should automatically flag when new hires are required based on caseload thresholds, geographic spread, participant intensity, and documentation burden — and when supervisors, QA staff, or dedicated intake staff become necessary.

### Long-Term CSE Vision

Design as the foundation for:

- A web-based operational intelligence platform
- A module inside Affectiv
- A multi-state scalable forecasting engine

---

## Implementation Notes

All three tools share a consistent structural pattern — inputs → assumptions → rate tables → staffing/caseload matrices → P&L → dashboards → scenario toggles — to support reuse and future integration.

Prioritize full transparency of assumptions and drivers so operators can trace how changes in caseloads, rates, and staffing propagate to EBITDA and margins.

Build with an eye toward later conversion to production web modules (Affectiv), including multi-entity and multi-state support.
