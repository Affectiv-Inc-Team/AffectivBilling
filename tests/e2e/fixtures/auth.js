import { expect } from '@playwright/test';

// Logs in through the real form and waits for the tool to render.
//
// NOTE: the app does not navigate on login — App.jsx swaps LoginPage for the
// tool via onAuthStateChange, so the URL stays the same. We therefore wait on
// a tool-only element (the Sign Out button) rather than a URL change.
export async function loginAs(page, email, password) {
  await page.goto('/');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible({ timeout: 15000 });
}

// Adds a service line via the header picker, given its full label
// (e.g. /targeted service coordination/i), then opens its tab.
export async function addServiceLine(page, labelRegex) {
  await page.getByRole('button', { name: /\+ add service line/i }).click();
  await page.getByRole('button', { name: labelRegex }).click();
}
