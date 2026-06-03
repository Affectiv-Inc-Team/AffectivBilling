# Intrinsic — Test Suite Status

> Last updated: 2026-06-03 · Branch: `feat/test-phase-2`

---

## Current Status: Phase 2 Complete ✅

| | |
|---|---|
| **Framework** | Vitest 2.1 + @testing-library/react + Playwright (installed, not yet configured) |
| **Test files** | 9 |
| **Total tests** | 277 passing, 0 failing |
| **Run time** | ~2.3s |
| **CI** | ✅ GitHub Actions (`.github/workflows/test.yml`) |

### Run the tests

```bash
npm test                # run all unit tests once
npm run test:watch      # interactive watch mode
npm run test:coverage   # run with coverage report
npm run test:ui         # open the Vitest browser UI
```

---

## Coverage (Phase 2 scope)

> Phase 1 covers the pure-function core. Phase 2 adds `access.js` (critical business logic missed
> in Phase 1), advanced TSC calcs, and React component smoke/mutation tests.
> Large JSX service-line files (`tsc.jsx`, `childrens_dda.jsx`, `cse.jsx`) remain excluded from
> the coverage threshold until their tab components have dedicated tests.

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| `src/lib/access.js` | 100% | 100% | 100% | 100% |
| `src/lib/companyShape.js` | 92.3% | 75.9% | 100% | 92.3% |
| `src/data/idahoRates.js` | 100% | 97.0% | 100% | 100% |
| `src/serviceLines/types.js` | 100% | 96.4% | 100% | 100% |
| **All files (in scope)** | **98.0%** | **87.4%** | **100%** | **98.0%** |

Configured thresholds: **80% statements / 75% branches** — both passing with margin.

### Known gaps in Phase 2

| File | Gap |
|------|-----|
| `companyShape.js` lines 345–352 | v1-with-companies migration branches for `homes`/`hourlyParticipants` fields |
| `idahoRates.js` line 485 | `unitsFromHours` default branch — V8 partial hit, not a real gap |
| `types.js` line 388 | `getTypesByArchetype` no-match branch — not a real gap |
| `tsc.jsx`, `childrens_dda.jsx`, `cse.jsx` | Tab components excluded — covered in future phases |

---

## Phase Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| [Phase 1 — Unit Tests](TEST_PHASE_1.md) | Pure function core | ✅ Complete |
| [Phase 2 — Component Tests + CI](TEST_PHASE_2.md) | React components, GitHub Actions | ✅ Complete |
| [Phase 3 — Integration Tests](TEST_PHASE_3.md) | Supabase I/O, RLS policies | 🔲 Not started |
| [Phase 4 — E2E Tests](TEST_PHASE_4.md) | Full user flows (Playwright) | 🔲 Not started |

---

## File Map

```
src/
  lib/__tests__/
    access.test.js         27 tests — all 9 access-control functions (canSeeCompanyDollars, wageDisplayMode, budgetRowVisibility, canSeeControl, editMode, …)
    companyShape.test.js   74 tests — migration, factories, selectors, validation
  serviceLines/__tests__/
    tsc.test.js            59 tests — all 8 calc exports (incl. AdminStaff, RevenueWaterfall, ProductivityFactors, BreakEven, Scenario)
    types.test.js          37 tests — type registry, active/pickable, picker groups
    TSCRosterTab.test.jsx   6 tests — empty state, add coordinator/participant, name edit, caseload count, edit-permission guard
  data/__tests__/
    idahoRates.test.js     63 tests — ratesForLine, findRate, resolveRate, hospice matrix
  __tests__/
    App.test.jsx            4 tests — loading/null/session routing, subscription cleanup
  pages/__tests__/
    ToolPage.test.jsx       3 tests — loading/resolved/null config states
    FinancialTool.test.jsx  4 tests — smoke render, save button present/absent, onSave called
tests/
  integration/             (Phase 3 — not yet written)
  e2e/                     (Phase 4 — not yet written)
```
