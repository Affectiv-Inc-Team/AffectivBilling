# Phase 2 — Component Tests + CI

**Status: 🔲 Not started**
**Prerequisite:** Phase 1 complete ✅

---

## Goal

Test React component behavior using React Testing Library — confirming that state mutations
are wired correctly, UI renders the right output for given props, and auth-state branching
works. Also set up GitHub Actions so every push runs the test suite automatically.

This phase deliberately avoids exhaustive coverage of `FinancialTool.jsx` (3,199 lines).
The strategy is targeted: test the mutation wiring in `TSCRosterTab`, the auth branch in
`App.jsx`, and the loading states in `ToolPage.jsx`. Full flow coverage belongs to Phase 4.

---

## Dependencies to install

No new packages needed — all RTL dependencies were installed in Phase 1:
- `@testing-library/react ^16.0.0`
- `@testing-library/user-event ^14.5.2`
- `@testing-library/jest-dom ^6.6.0`
- `jsdom ^25.0.0`

---

## Files to create

```
src/
  __tests__/
    App.test.jsx                  ← auth state branching
  pages/__tests__/
    ToolPage.test.jsx             ← config loading states
    FinancialTool.test.jsx        ← smoke test only
  serviceLines/__tests__/
    TSCRosterTab.test.jsx         ← mutation wiring
.github/
  workflows/
    test.yml                      ← CI pipeline
```

---

## Test specs

### `App.test.jsx` — auth state branching

`App.jsx` renders `null`, `<LoginPage>`, or `<ToolPage>` based on Supabase session state.
Mock `src/supabase.js` with `vi.mock` — never hit the real Supabase client in unit tests.

```js
vi.mock('../supabase.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));
```

| Test | What to assert |
|------|---------------|
| Loading state (`session === undefined`) | Renders nothing — `document.body` has no meaningful content |
| No session (`session === null`) | Renders `<LoginPage>` — finds an email input or "Sign in" text |
| Session exists | Renders `<ToolPage>` — does not render the login form |
| Cleanup | `onAuthStateChange` subscription is unsubscribed on unmount |

### `ToolPage.test.jsx` — config loading states

`ToolPage.jsx` calls `loadConfig()` on mount and passes the result to `FinancialTool` as
`initialConfig`. Mock `loadConfig` from `src/supabase.js`.

| Test | What to assert |
|------|---------------|
| While loading | Renders null / loading state (no financial tool content) |
| `loadConfig` resolves with a v2 config | `FinancialTool` receives `initialConfig` matching the resolved value |
| `loadConfig` resolves with null | App handles gracefully (no crash, fallback rendered) |

### `TSCRosterTab.test.jsx` — mutation wiring

`TSCRosterTab` is the highest-value component test because it has the most complex state
interactions: nested coordinator → participant structure with live calc output.

Import directly from `src/serviceLines/tsc.jsx`. Pass a minimal `config` prop and an
`onUpdate` spy.

```js
import { TSCRosterTab } from '../../serviceLines/tsc.jsx';
```

| Test | What to assert |
|------|---------------|
| Empty state | "No coordinators" empty-state message rendered when `config.coordinators === []` |
| Add coordinator | Clicking the "Add coordinator" button calls `onUpdate` with a config that has 1 coordinator |
| Coordinator name edit | Changing the name input fires `onUpdate` with the updated coordinator name |
| Add participant | Clicking "Add participant" inside a coordinator card calls `onUpdate` with the participant added |
| Caseload summary | After adding a participant, the displayed caseload count matches `participants.length` |
| Revenue display | With `unitsCoord: 16`, the rendered monthly revenue shows `$335` or `$336` (16 × $20.97) |

### `FinancialTool.test.jsx` — smoke test only

`FinancialTool.jsx` is 3,199 lines. In Phase 2, test only that it renders without throwing
and that the save affordance behaves correctly. Deep tab navigation is Phase 4 (E2E).

```js
import App from '../../pages/FinancialTool.jsx';
```

| Test | What to assert |
|------|---------------|
| Renders with valid v2 config | No thrown errors, top-level DOM structure present |
| Save button present | When `onSave` prop is provided, a "Save" button exists in the document |
| Save button absent | When `onSave` prop is omitted, no "Save" button |
| `onSave` called on click | Clicking Save invokes `onSave` with the current config |

---

## CI pipeline — `.github/workflows/test.yml`

```yaml
name: Test

on:
  push:
    branches: [main, add-test-suite]
  pull_request:
    branches: [main]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci --legacy-peer-deps
      - run: npm test
      - run: npm run build
```

Two checks per PR:
1. `npm test` — all unit + component tests must pass
2. `npm run build` — catches import/parse errors that tests might miss (mirrors the
   esbuild verification standard from `CLAUDE.md`)

Coverage upload (optional, add after initial CI is stable):
```yaml
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
```

---

## Coverage target

After Phase 2, expected coverage on the full `src/` tree (excluding integration/E2E):

| Module | Target |
|--------|--------|
| `src/lib/**` | ≥ 95% |
| `src/data/**` | ≥ 100% |
| `src/serviceLines/**` | ≥ 80% (tsc.jsx calc + UI) |
| `src/pages/**` | ≥ 40% (smoke tests only) |

---

## Acceptance criteria

- [ ] All 4 component test files written and passing
- [ ] No existing Phase 1 tests broken
- [ ] GitHub Actions workflow created and green on first push
- [ ] `npm run build` passes in CI
- [ ] Coverage thresholds still met (or thresholds updated to reflect new scope)
