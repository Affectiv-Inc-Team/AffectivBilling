# Intrinsic — Test Suite Status

> Last updated: 2026-05-08 · Branch: `add-test-suite`

---

## Current Status: Phase 1 Complete ✅

| | |
|---|---|
| **Framework** | Vitest 2.1 + @testing-library/react + Playwright (installed, not yet configured) |
| **Test files** | 4 |
| **Total tests** | 204 passing, 0 failing |
| **Run time** | ~1.3s |
| **CI** | Not yet configured (Phase 2) |

### Run the tests

```bash
npm test                # run all unit tests once
npm run test:watch      # interactive watch mode
npm run test:coverage   # run with coverage report
npm run test:ui         # open the Vitest browser UI
```

---

## Coverage (Phase 1 scope)

> Phase 1 only measures the pure-function core — `src/lib/`, `src/serviceLines/types.js`,
> `src/data/`. React components and Supabase I/O are deferred to later phases.

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| `src/lib/companyShape.js` | 93.7% | 78.7% | 100% | 93.7% |
| `src/data/idahoRates.js` | 100% | 97.0% | 100% | 100% |
| `src/serviceLines/types.js` | 100% | 96.2% | 100% | 100% |
| `src/serviceLines/tsc.jsx` *(calc exports only)* | — | — | — | — |
| **All files (in scope)** | **98.4%** | **86.6%** | **100%** | **98.4%** |

Configured thresholds: **80% statements / 75% branches** — both passing with margin.

`tsc.jsx` is excluded from Phase 1 coverage. The exported calculator functions
(`calcTSCParticipant`, `calcTSCCoordinator`, `calcTSCService`) are fully exercised by the
32 TSC tests; the JSX UI components (lines 172–590) are scoped to Phase 2.

### Known gaps in Phase 1

| File | Lines | Gap |
|------|-------|-----|
| `companyShape.js` | 306–308, 310–313 | v1-with-companies migration branches for `homes` array and `hourlyParticipants` field |
| `idahoRates.js` | 485 | `unitsFromHours` default branch — V8 partial hit, not a real gap |
| `types.js` | 373 | `getTypesByArchetype` no-match branch — not a real gap |

---

## Phase Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| [Phase 1 — Unit Tests](TEST_PHASE_1.md) | Pure function core | ✅ Complete |
| [Phase 2 — Component Tests + CI](TEST_PHASE_2.md) | React components, GitHub Actions | 🔲 Not started |
| [Phase 3 — Integration Tests](TEST_PHASE_3.md) | Supabase I/O, RLS policies | 🔲 Not started |
| [Phase 4 — E2E Tests](TEST_PHASE_4.md) | Full user flows (Playwright) | 🔲 Not started |

---

## File Map

```
src/
  lib/__tests__/
    companyShape.test.js       74 tests — migration, factories, selectors, validation
  serviceLines/__tests__/
    tsc.test.js                32 tests — calcTSCParticipant/Coordinator/Service
    types.test.js              35 tests — type registry, active/pickable, picker groups
  data/__tests__/
    idahoRates.test.js         63 tests — ratesForLine, findRate, resolveRate, hospice matrix
tests/
  integration/                 (Phase 3 — not yet written)
  e2e/                         (Phase 4 — not yet written)
```
