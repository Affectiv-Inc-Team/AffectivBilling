import { test, expect } from '@playwright/test';
import { loginAs, addServiceLine } from './fixtures/auth.js';
import { E2E_EMAIL, E2E_PASSWORD } from './fixtures/credentials.js';

// Tab/sub-tab "buttons" are <div onPointerDown> wrapping a pointerEvents:none
// <button>, so a normal click fails Playwright's actionability check. Match the
// button role (avoids same-text stat labels) and force-click — the pointer
// event still routes to the parent div. An active tab's name includes a "✕"
// remove icon, so anchor with ^ rather than requiring an exact match.
async function clickTab(page, labelRegex) {
  await page.getByRole('button', { name: labelRegex }).first().click({ force: true });
}

test.describe('Financial tool — critical flows', () => {
  // ── Flow 1: add a TSC service line and model a caseload ──────────────────
  // The core product loop. If this breaks, nothing works.
  test('add TSC service line and model a participant caseload', async ({ page }) => {
    await loginAs(page, E2E_EMAIL, E2E_PASSWORD);

    // Adding a service line auto-selects it and opens its Coordinators sub-tab.
    await addServiceLine(page, /targeted service coordination/i);
    await expect(page.getByText(/no coordinators yet/i)).toBeVisible();

    // Add a coordinator → its card renders (name input is the first textbox).
    await page.getByRole('button', { name: /\+ add coordinator/i }).click();
    await expect(page.getByRole('textbox').first()).toHaveValue('Coordinator 1');

    // Add a participant to that coordinator.
    await page.getByRole('button', { name: /\+ add participant/i }).click();

    // Set G9002 units to 16 (the G9002 input is the only number input with max=200).
    const g9002 = page.locator('input[type="number"][max="200"]');
    await g9002.fill('16');

    // 16 units × $20.97 = $335.52 → $k rounds to $336 in the participant row.
    await expect(page.getByText('$336/mo')).toBeVisible();
  });

  // ── Flow 2: save and reload persists data ────────────────────────────────
  test('saving and reloading persists a coordinator name', async ({ page }) => {
    await loginAs(page, E2E_EMAIL, E2E_PASSWORD);

    // Auto-selects the new line on its Coordinators sub-tab.
    await addServiceLine(page, /targeted service coordination/i);

    await page.getByRole('button', { name: /\+ add coordinator/i }).click();
    await page.getByRole('textbox').first().fill('Jordan Smith');

    // Save → header button transitions to "✓ Saved".
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('button', { name: /saved/i })).toBeVisible({ timeout: 15000 });

    // Hard reload and confirm the name round-tripped through Supabase.
    await page.reload();
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible({ timeout: 15000 });
    // After reload the tool resets to Whole Company; re-open the TSC tab.
    await clickTab(page, /^TSC/);
    await expect(page.getByRole('textbox').first()).toHaveValue('Jordan Smith');
  });

  // ── Flow 3: a company-level wage change propagates to service-line output ──
  // Exercises the shared-config mutation path (updateShared) and confirms a
  // different component (Labor Efficiency) reflects the change.
  test('company wage change propagates to Res Hab labor display', async ({ page }) => {
    await loginAs(page, E2E_EMAIL, E2E_PASSWORD);

    await addServiceLine(page, /residential habilitation — daily/i);
    await clickTab(page, /Res Hab Daily/i);

    // Add a home so labor totals (and the Wage Rate stat) render.
    await page.getByRole('button', { name: '+ Add', exact: true }).first().click();

    // Staff Wage slider (range input, min=12 max=32). Set to 25 using the native
    // value setter so React's controlled onChange fires.
    const wageSlider = page.locator('input[type="range"][min="12"][max="32"]');
    await wageSlider.evaluate((el, val) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, '25');

    // The slider's own label echoes the new value immediately.
    await expect(page.getByText('$25.00/hr').first()).toBeVisible();

    // Propagation: the Labor Efficiency tab reads shared.wage independently.
    await clickTab(page, /Labor Efficiency/i);
    await expect(page.getByText('$25.00/hr').first()).toBeVisible();
  });

  // ── Flow 4: the 🔬 Scenario sub-tab renders ──────────────────────────────
  // Regression guard for a ReferenceError that blanked the whole app when an
  // editor opened the TSC Scenario tab (undeclared base/scenario/delta/rates/
  // bev/… — same class PR #24 fixed for the other TSC tabs). The Phase 4 suite
  // never opened this sub-tab, which is how the crash shipped.
  test('TSC Scenario sub-tab renders without crashing', async ({ page }) => {
    await loginAs(page, E2E_EMAIL, E2E_PASSWORD);
    await addServiceLine(page, /targeted service coordination/i);

    // A coordinator + participant make the scenario calc and rate panel exercise
    // the previously-undeclared paths rather than the empty-state shortcut.
    await page.getByRole('button', { name: /\+ add coordinator/i }).click();
    await page.getByRole('button', { name: /\+ add participant/i }).click();

    // Opening this sub-tab used to throw before the component declared its vars.
    await clickTab(page, /Scenario/i);
    await expect(page.getByText(/scenario modeling/i)).toBeVisible();
    await expect(page.getByText(/break-even analysis/i)).toBeVisible();
  });
});
