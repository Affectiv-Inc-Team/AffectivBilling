# Intrinsic — Test Suite Status

> Last updated: 2026-06-03 · Branch: `feat/test-phase-3`

---

## Current Status: Phase 3 Complete ✅

| | |
|---|---|
| **Framework** | Vitest 2.1 + @testing-library/react + Playwright (installed; E2E not yet configured) |
| **Unit/component tests** | 9 files, 277 passing |
| **Integration tests** | 2 files, 21 passing (local Supabase) |
| **Run time** | ~2.7s unit · ~4.5s integration |
| **CI** | ✅ GitHub Actions: `unit` (every push/PR) + `integration` (push to main) |

### Run the tests

```bash
npm test                # all unit/component tests once
npm run test:watch      # interactive watch mode
npm run test:coverage   # with coverage report
npm run test:ui         # open the Vitest browser UI

# Integration (requires Docker + local Supabase):
supabase start
supabase db reset
npm run test:integration
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
| [Phase 3 — Integration Tests](TEST_PHASE_3.md) | Supabase I/O, RLS policies | ✅ Complete |
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
  integration/
    setup.js               admin client, localhost guardrail, provisioning + teardown helpers
    supabase.test.js       10 tests — loadConfig/saveConfig round-trips against local Supabase
    rls.test.js            11 tests — companies/profiles/licensees RLS isolation (HIPAA-critical)
  e2e/                     (Phase 4 — not yet written)
```

---

## Phase 3 findings — RLS gaps surfaced by the tests

Per the agreed approach, the integration tests assert the schema's **actual** behavior and flag
where it diverges from the spec. Two findings (also recorded in [TEST_PHASE_3.md](TEST_PHASE_3.md)):

- **Regular licensees can read/write *nothing*.** The `companies` SELECT/UPDATE policies use
  `EXISTS` subqueries over `licensee_companies` and `licensees`, but those tables are
  super-admin-only under RLS — so a regular user's policy check sees no assignment rows.
  Net effect: `loadConfig()` returns `null` even for a correctly-assigned licensee, editor/
  read_only `UPDATE`s affect 0 rows, and `saveConfig()` (an upsert with no INSERT policy for
  regular users) is denied. **Only super-admins can currently read or write companies.**
  Tests pin this so the fix (likely a `security definer` membership helper or a `licensee_id`
  FK on `profiles`) registers as the intended change in Track B.
- **The good news — isolation holds.** No user ever sees another licensee's data; the bug is
  the inverse (assigned data is invisible too). That is a functionality gap, not a PHI leak.

The doc's earlier worry about a missing `profiles` UPDATE grant turned out **not** to be real —
own-row profile updates succeed; the test asserts that.
