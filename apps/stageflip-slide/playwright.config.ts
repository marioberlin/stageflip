// apps/stageflip-slide/playwright.config.ts
// Walking-skeleton E2E config. Starts the Next.js app on port 3100 and
// runs the smoke spec against it. T-136 will expand this with real
// editor scenarios.

import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    // Use `next start` against a pre-built app so CI verifies the
    // production bundle — dev mode's leniency can hide errors.
    command: 'pnpm --filter @stageflip/app-slide start',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
