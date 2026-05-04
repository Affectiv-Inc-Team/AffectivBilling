# Intrinsic — Project Directory Guide

This document describes the intended source tree, what belongs where, and how the
pieces connect. Use it as a reference when adding new files or onboarding.

---

## Full intended source tree

```
intrinsic/
│
├── CLAUDE.md                          ← Claude Code project context (this repo's AI instructions)
├── package.json
├── vite.config.js
├── index.html
│
├── supabase/                          ← Track B: SQL migrations and seed files
│   ├── migrations/
│   │   ├── 001_initial_schema.sql     ← existing auth/companies baseline
│   │   ├── 002_v2_config_blob.sql     ← Track B: companies table + JSONB config col
│   │   ├── 003_licensees.sql          ← Track B: rename/create licensees table
│   │   ├── 004_licensee_companies.sql ← Track B: M2M junction + role column
│   │   ├── 005_super_admins.sql       ← Track B: super_admins flag
│   │   └── 006_rls_policies.sql       ← Track B: row-level security
│   └── seed/
│       └── idaho_rate_catalog.sql     ← optional: rate data as DB rows (future)
│
└── src/
    ├── main.jsx                       ← Vite entry point
    ├── App.jsx                        ← top-level router, wraps pages
    ├── supabase.js                    ← Supabase client + data helpers
    │                                     current:  loadConfig(), saveConfig()
    │                                     Track B adds: loadAssignedCompanies(),
    │                                                   saveCompany(id, config),
    │                                                   superAdmin helpers
    │
    ├── pages/
    │   ├── LoginPage.jsx              ← auth UI (existing, unchanged)
    │   ├── ToolPage.jsx               ← shell that mounts FinancialTool (existing)
    │   ├── AdminPanel.jsx             ← Track B: extend with company create/assign/revoke
    │   └── FinancialTool.jsx          ← ★ main tool (3,197 lines)
    │                                     all UI components defined inline here
    │                                     App() is the default export
    │
    ├── lib/
    │   └── companyShape.js            ← v2 data model
    │                                     migrateConfig(), createCompany(),
    │                                     createServiceLine(), createSharedConfig(),
    │                                     getSelectedCompany(), validateConfig()
    │
    ├── serviceLines/
    │   ├── types.js                   ← service line registry
    │   │                                 SERVICE_LINE_TYPES (25 keys)
    │   │                                 ARCHETYPES (11 families)
    │   │                                 SERVICE_LINE_DEFS (status, defaultConfig, labels)
    │   │                                 getGroupedPickerOptions(), getActiveTypes()
    │   │
    │   ├── tsc.jsx                    ← ★ TSC module (active — the pattern for all future SLs)
    │   │                                 calcTSCService(config)
    │   │                                 TSCRosterTab, TSCProductivityTab, TSCPLTab
    │   │
    │   └── [future service line modules follow the tsc.jsx pattern]
    │       ├── adCaseMgmt.jsx         ← when AD_CASE_MGMT goes active
    │       ├── vocServices.jsx        ← when VOC_SERVICES goes active
    │       ├── bhOutpatient.jsx       ← when BH_OUTPATIENT goes active
    │       └── …                     ← one file per type, named in camelCase
    │
    └── data/
        └── idahoRates.js             ← flat rate catalog
                                         ~150 records, hospice county matrix
                                         all post-9/1/2025 (4% reduction baked in)
                                         BH rates: Magellan IBHP effective 4/13/2026
                                         access via ratesForLine(type)
```

---

## Where things live and why

### `src/pages/FinancialTool.jsx`
The entire tool — primitive UI components (`Slider`, `Stepper`, `Toggle`, `MarginRing`),
domain components (`HomeTypeCard`, `HomeMixEditor`, `HourlyTab`, `CompanyPL`, etc.),
routing (`SUB_TABS`), and `App()` — all live in this one file by design. This was an
intentional architectural choice during the Track A refactor: existing components were
preserved verbatim (not split out) to minimize diff surface and regression risk.

**Do not split this file.** If it grows significantly, discuss with the project owner first.
Navigate by search: `calcHome`, `SUB_TABS`, `export default function App`, component names.

### `src/lib/companyShape.js`
Owns the data model. The only file allowed to define the v2 config blob shape.
If the shape needs to evolve, bump `version` to 3 and add a `migrateV2toV3()` branch —
never mutate existing migration paths.

### `src/serviceLines/types.js`
The registry of all 25 service line types. Change a type's `status` from `'catalog'` to
`'active'` here when its module is ready. Do not add new types outside this file.

### `src/serviceLines/tsc.jsx`
The canonical pattern for all future service line modules. Every new active service line
gets one file here structured the same way:
- A pure `calc<TYPE>Service(config)` function at the top
- Tab components below it (`<TYPE>RosterTab`, `<TYPE>PLTab`, etc.)
- Named exports only — no default export

### `src/data/idahoRates.js`
Rate data only — no business logic. Rates are flat records filtered by `serviceLineType`.
When a new state is added (UT/NV/AZ), add a parallel file (`utahRates.js` etc.) and a
state-aware `ratesForLine(type, state)` wrapper — do not fork `idahoRates.js`.

### `supabase/migrations/`
SQL migration files, numbered sequentially. Migrations 002–006 are Track B work and do not
exist yet — the filenames above are the intended names. Never edit a migration that has
already been applied to production; always add a new numbered file.

---

## Import path rules

All imports in `FinancialTool.jsx` are relative to `src/pages/`:

```js
import { migrateConfig }        from "../lib/companyShape.js";
import { SERVICE_LINE_TYPES }   from "../serviceLines/types.js";
import { ratesForLine }         from "../data/idahoRates.js";
import { TSCRosterTab, … }      from "../serviceLines/tsc.jsx";
```

If `FinancialTool.jsx` ever moves out of `src/pages/`, every one of these paths breaks.
Update them all atomically — don't patch one at a time.

New service line modules import from sibling files:
```js
// inside src/serviceLines/bhOutpatient.jsx
import { ratesForLine } from "../data/idahoRates.js";  // ← goes up one, then into data/
```

---

## What goes in CLAUDE.md vs here

| Topic | File |
|---|---|
| Architectural decisions, locked choices | `CLAUDE.md` |
| Terminology, working style, gotchas | `CLAUDE.md` |
| Track B spec, what's not started | `CLAUDE.md` |
| File locations and what each exports | This file |
| Import path rules | This file |
| Where to put new files | This file |
| How migrations are numbered | This file |

Keep `CLAUDE.md` focused on *decisions* (the why). Keep this file focused on *structure*
(the where). Both should be updated whenever the project structure changes.

---

## Checklist: adding a new service line

- [ ] Create `src/serviceLines/<camelCaseName>.jsx`
- [ ] Export `calc<TYPE>Service(config)` and all tab components as named exports
- [ ] Follow the `tsc.jsx` structure exactly
- [ ] Add sub-tab entries to `SUB_TABS` in `FinancialTool.jsx`
- [ ] Add render cases in the App render switch (search `case 'tsc_roster'`)
- [ ] Change `status` from `'catalog'` to `'active'` in `src/serviceLines/types.js`
- [ ] Run esbuild on both the new module and `FinancialTool.jsx`
- [ ] Test end-to-end in dev: add the SL, enter data, verify numbers, save and reload

## Checklist: Track B kickoff

- [ ] Audit existing Supabase `companies` table schema before writing migrations
- [ ] Decide: rename existing table to `licensees`, or create a new `licensees` table
- [ ] Write migrations 002–006 in order — do not skip RLS (006)
- [ ] Update `src/supabase.js` with `loadAssignedCompanies()` and `saveCompany()`
- [ ] Extend `src/pages/AdminPanel.jsx` with SuperAdmin provisioning UI
- [ ] Update login flow in `App.jsx` to call `loadAssignedCompanies()` on sign-in
- [ ] Test: create a company as SuperAdmin, assign to a licensee, verify RLS blocks access
      to unassigned companies from the licensee account
