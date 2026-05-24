import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — runs against a locally-served frontend pointing at
 * a running backend on :4000. To execute:
 *
 *   1. Start postgres + backend:    docker compose up postgres backend -d
 *   2. Start frontend dev:          pnpm --filter @uni-lms/frontend dev
 *   3. Run tests:                   pnpm --filter @uni-lms/frontend e2e
 *
 * Or rely on `webServer` below to auto-start the dev server.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // shared dev server + sequential auth-dependent flows
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['html'], ['github']] : 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.E2E_NO_WEBSERVER
    ? undefined
    : {
        command: 'pnpm dev',
        port: 3000,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
