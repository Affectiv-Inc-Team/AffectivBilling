# Phase 4 — E2E Tests

**Status: ✅ Complete** (2026-06-05, branch `feat/test-phase-4`)
**Prerequisite:** Phase 3 complete

> Implementation notes & deviations from this plan (login has no URL change, super-admin test
> user, `--mode e2e` env isolation, Flow 3 retargeted, and the app-crashing `rates` bug the
> suite caught) are recorded in [TEST_STATUS.md](TEST_STATUS.md#phase-4-findings--what-the-e2e-suite-surfaced).

---

## Goal

Verify the three critical user flows end-to-end in a real browser: login, modeling a TSC
caseload, and save/reload persistence. If any of these three flows break, the product is
broken. Everything else is secondary.

E2E tests are slow and occasionally flaky — they should not block every PR. The strategy
is to run them on merges to `main` only, as a final gate before production deploys.

---

## Dependencies to install

```bash
npm install --save-dev @playwright/test   # already installed in Phase 1
npx playwright install chromium           # download browser binaries
```

---

## Files to create

```
tests/
  e2e/
    playwright.config.js        ← Playwright configuration
    fixtures/
      auth.js                   ← shared login helper
    auth.spec.js                ← login / logout flows
    financial-tool.spec.js      ← core product flows
```

---

## Configuration — `tests/e2e/playwright.config.js`

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',     // record trace on failure for debugging
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,  // reuse the dev server locally
    timeout: 30000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
});
```

---

## Shared login helper — `tests/e2e/fixtures/auth.js`

```js
export async function loginAs(page, email, password) {
  await page.goto('/');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/', { waitUntil: 'networkidle' });
}
```

---

## Test specs

### `auth.spec.js` — 4 tests

| Test | Steps | Assert |
|------|-------|--------|
| Login page shown to unauthenticated users | Navigate to `/` without a session | Email input visible, financial tool not visible |
| Invalid credentials shows error | Fill bad email/password, click Sign in | Error message appears, user stays on login page |
| Valid credentials redirect to the tool | Fill correct credentials, click Sign in | Financial tool UI visible (company name, Save button, service line picker) |
| Sign out returns to login | Log in, click Sign out | Login page shown again |

### `financial-tool.spec.js` — 3 critical flows

#### Flow 1 — Add a TSC service line and model a caseload

This is the core product loop. If this breaks, nothing works.

```
1. Log in
2. Click "Add service line" (or equivalent picker)
3. Select "Targeted Service Coordination" (TSC) from the picker
4. Confirm the TSC service line appears in the sidebar
5. Navigate to the TSC tab
6. Click "Add coordinator"
7. Confirm a coordinator card appears
8. Click "Add participant" inside the coordinator card
9. Set participant units (G9002) to 16
10. Assert the displayed monthly revenue shows approximately $336
    (16 × $20.97 = $335.52 → rounds to $336 in the UI)
```

| Assert | Expected |
|--------|----------|
| TSC tab appears after adding | TSC item visible in service line navigation |
| Coordinator card renders | Coordinator name input visible |
| Participant row renders | Participant fields visible |
| Monthly revenue | Shows `$335`, `$336`, or `$335.52` |

#### Flow 2 — Save and reload persists data

Verifies that `saveConfig` → `loadConfig` round-trip works end-to-end.

```
1. Log in
2. Add a TSC coordinator with a specific name (e.g., "Jordan Smith")
3. Click Save
4. Wait for save confirmation ("Saved" status or equivalent)
5. Hard reload the page (Ctrl+R / page.reload())
6. Navigate back to the TSC tab
7. Assert "Jordan Smith" is still visible
```

| Assert | Expected |
|--------|----------|
| Save feedback | "Saved" indicator appears after clicking Save |
| After reload | Coordinator name "Jordan Smith" still present in the roster |

#### Flow 3 — Company-level wage propagates to service line financials

Verifies the shared config mutation path — that a change to a company-level field
updates downstream calculations.

```
1. Log in
2. Navigate to the Company tab (Whole Company view)
3. Change the direct-care wage field to $25
4. Navigate to a service line with labor cost output (TSC P&L or Res Hab labor tab)
5. Assert the labor cost displayed reflects the $25 wage
```

| Assert | Expected |
|--------|----------|
| After wage change | Service line labor cost is higher than with the default $16 wage |

---

## Running E2E tests

```bash
# Terminal 1: Start local Supabase
supabase start

# Terminal 2: Run E2E (Playwright starts the dev server automatically)
npm run test:e2e

# Open the interactive UI mode
npm run test:e2e:ui

# View the HTML report after a run
npx playwright show-report
```

---

## CI configuration

Add to `.github/workflows/test.yml` as a separate job that runs **only on pushes to `main`**:

```yaml
  e2e:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    needs: [unit, integration]    # run after both earlier jobs pass
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase start
      - run: npm ci --legacy-peer-deps
      - run: npx playwright install chromium --with-deps
      - run: npm run test:e2e
        env:
          VITE_SUPABASE_URL: http://localhost:54321
          VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_LOCAL_ANON_KEY }}
          CI: true
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

Uploading the Playwright HTML report on failure means a developer can download it from
GitHub Actions and see exactly what the browser was rendering when the test broke.

---

## Flakiness management

E2E tests are inherently more fragile than unit tests. These strategies keep them stable:

**Use role-based selectors, not CSS** — `getByRole('button', { name: /save/i })` is more
resilient to UI changes than `page.locator('.save-btn')`. RTL and Playwright both encourage
this pattern.

**Wait for network idle, not time** — `page.waitForURL`, `page.waitForSelector`, and
`response.waitForLoadState('networkidle')` are more reliable than `page.waitForTimeout`.
Never use `sleep` in E2E tests.

**Seed data consistency** — E2E tests run against a local Supabase instance. The seed user
(`internship@intrinsic.agency`) must exist in the local database. If tests fail with auth
errors, run `supabase db reset` to re-apply migrations and seed.

**Parallelism** — by default Playwright runs test files in parallel. The 3 flows in
`financial-tool.spec.js` each run in a fresh browser context, so they're independent.

---

## Acceptance criteria

- [x] `playwright.config.js` written and `npx playwright install chromium` run
- [x] `auth.spec.js` — all 4 auth flow tests passing
- [x] `financial-tool.spec.js` — all 3 critical flow tests passing
- [x] Tests pass with a clean `supabase db reset` (no dependency on stale local state)
- [x] CI E2E job added to `.github/workflows/test.yml`, runs on `main` pushes only
- [x] Playwright HTML report uploaded as CI artifact on failure
- [x] `npm run test:e2e` documented in README
