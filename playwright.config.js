'use strict';
// Playwright E2E config. Opt-in — not part of `npm test`.
// Setup:  npm install && npx playwright install chromium
// Run:    npm run test:e2e                 (targets production by default)
//         BASE_URL=http://localhost:3000 npm run test:e2e
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.BASE_URL || 'https://totallydifferent.vercel.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile',   use: { ...devices['Pixel 5'] } },
  ],
});
