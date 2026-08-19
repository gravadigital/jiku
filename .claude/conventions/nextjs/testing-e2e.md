---
id: testing-e2e
display_name: Testing E2E (Playwright)
language: nextjs
description: End-to-end testing with Playwright — critical flows, auth setup, CI configuration
applies_to: [frontend]
required_by: []
package: "@playwright/test"
---

# Testing E2E (Next.js, Playwright)

End-to-end tests with [Playwright](https://playwright.dev). Tests run against the production build (`next build && next start`) to match real behavior. Covers critical user flows, async Server Components, and authenticated routes.

E2E is the recommended approach for async Server Components (official Next.js docs), which cannot be unit-tested with Vitest.

## When to use

- Critical user flows: login, signup, checkout, core business operations.
- Async Server Components and pages that fetch data.
- Authenticated routes and role-based access.
- Regressions on flows that cross multiple routes or components.

## Package

```
@playwright/test@^1.48.x    # test runner + browser automation
```

## Structure

```
tests/
├── e2e/
│   ├── auth.setup.ts           # authentication setup (runs once)
│   ├── login.spec.ts
│   ├── dashboard.spec.ts
│   └── {flow}.spec.ts
├── fixtures/
│   └── index.ts                # shared fixtures and helpers
└── playwright/.auth/
    └── user.json               # saved auth state (gitignored)

playwright.config.ts
```

## Configuration

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  // Test against the production build (recommended by Next.js docs)
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },

  projects: [
    // 1. Auth setup runs first
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
    },
    // 2. Authenticated tests reuse the saved session
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // 3. Unauthenticated tests (login page, public routes)
    {
      name: 'unauthenticated',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/public/**/*.spec.ts',
    },
  ],
});
```

Add to `.gitignore`:
```
tests/playwright/.auth/
playwright-report/
test-results/
```

## How to use

### Auth setup (runs once per test suite)

```ts
// tests/e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

const authFile = 'tests/playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=email]', process.env.TEST_USER_EMAIL!);
  await page.fill('[name=password]', process.env.TEST_USER_PASSWORD!);
  await page.click('[type=submit]');

  // Wait for redirect to confirm successful login
  await page.waitForURL('/dashboard');
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

  // Save session state for all subsequent tests
  await page.context().storageState({ path: authFile });
});
```

### Authenticated flow

```ts
// tests/e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

// This project uses storageState from playwright.config.ts — already authenticated
test('dashboard shows user name', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('can create a new item', async ({ page }) => {
  await page.goto('/items/new');
  await page.fill('[name=title]', 'My item');
  await page.click('[type=submit]');

  await page.waitForURL('/items/**');
  await expect(page.getByText('My item')).toBeVisible();
});
```

### Unauthenticated flow

```ts
// tests/e2e/public/login.spec.ts
import { test, expect } from '@playwright/test';

// This spec is in the 'unauthenticated' project — no storageState
test('shows validation error for invalid email', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=email]', 'not-an-email');
  await page.click('[type=submit]');

  await expect(page.getByText(/valid email/i)).toBeVisible();
});

test('redirects to dashboard after login', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=email]', process.env.TEST_USER_EMAIL!);
  await page.fill('[name=password]', process.env.TEST_USER_PASSWORD!);
  await page.click('[type=submit]');

  await expect(page).toHaveURL('/dashboard');
});
```

### Shared fixtures

```ts
// tests/fixtures/index.ts
import { test as base } from '@playwright/test';

type Fixtures = {
  seedUser: { id: string; email: string };
};

export const test = base.extend<Fixtures>({
  seedUser: async ({}, use) => {
    // Create test data
    const user = await createTestUser();
    await use(user);
    // Cleanup after test
    await deleteTestUser(user.id);
  },
});

export { expect } from '@playwright/test';
```

## CI configuration

```yaml
# .github/workflows/e2e.yml
- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium

- name: Run E2E tests
  run: npx playwright test
  env:
    TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
    TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}

- name: Upload test report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: playwright-report/
    retention-days: 7
```

## Rules

- Tests run against the **production build** (`next build && next start`). Never run E2E against `next dev` — behavior differs (no caching, different error handling).
- Auth setup runs once and saves `storageState`. Do not log in inside individual test files.
- `tests/playwright/.auth/` is gitignored — it contains session cookies and tokens.
- `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` come from environment variables / CI secrets. Never hardcode credentials.
- Each test is independent. Do not rely on state left by a previous test. Use fixtures for data setup and teardown.
- Test IDs use `data-testid` attributes when a semantic selector is not available. Prefer roles and labels first.
- E2E tests cover the critical path and regressions. Do not replicate unit test coverage here — tests should be at the right layer.
- Limit E2E to Chrome (or one browser) in CI to keep the suite fast. Add more browsers only when cross-browser behavior is the concern.

## Integration with other conventions

- **testing-unit**: unit tests cover Client Components, hooks, and Server Actions. E2E covers async Server Components and full user flows.
- **auth**: `auth.setup.ts` tests the real login flow. Authenticated tests reuse `storageState` without re-logging in.
- **mutations**: critical mutation flows (create, update, delete) are covered in E2E to verify the full Server Action → revalidation → UI update cycle.
