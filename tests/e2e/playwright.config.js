import { defineConfig } from '@playwright/test';

// E2E config — drives the real app in Chromium against LOCAL Supabase.
//
// SAFETY: the app's .env.local points at the remote/prod Supabase project. E2E
// tests create users and write company data, so they MUST hit local Supabase
// only. We achieve that with `vite --mode e2e`, which loads `.env.e2e`
// (127.0.0.1:54321) at higher priority than `.env.local`. global-setup.js
// additionally refuses to run unless the resolved URL is localhost.
export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.js',
  globalTeardown: './global-teardown.js',
  // E2E flows mutate shared seed data (the single "My Company"), so run serially.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --mode e2e',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
});
