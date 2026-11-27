import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests of opus-web against the product of `make up` (`make test-e2e S=opus-web`). They run
 * in Playwright's image on the host network, so the browser uses the same URLs a person does.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  outputDir: '../../reports/playwright/opus-web',
  reporter: [['list'], ['junit']],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3001',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
