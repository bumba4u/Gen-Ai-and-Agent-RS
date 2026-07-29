import { defineConfig, devices } from '@playwright/test';

// No baseURL is set here: every spec file under tests/ hardcodes its own
// BASE_URL constant pointing at the deployed instance
// (https://eventhub.rahulshettyacademy.com), not localhost — see CLAUDE.md.
// This config exists specifically to fix a real risk: without it, Playwright
// defaults to parallel execution across spec files, but every spec logs into
// the SAME shared demo account on a live backend. Two files' bookings/clear-all
// helpers running concurrently can race and wipe out each other's test data.
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: 'html',
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
