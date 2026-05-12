// apps/audience-join/playwright.config.ts
// Voter-flow smoke harness (T-456). Starts the audience-join Next.js
// app on port 3500 and runs the smoke spec against it. The spec stubs
// the apps/api `/v1/audience/sessions/:id/join` response via
// `page.route` to avoid running the real backend.

import { defineConfig, devices } from '@playwright/test';

const PORT = 3500;
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
    command: 'pnpm --filter @stageflip/app-audience-join start',
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
