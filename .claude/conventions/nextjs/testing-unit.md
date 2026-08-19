---
id: testing-unit
display_name: Testing unitario (Vitest + Testing Library)
language: nextjs
description: Unit testing for Client Components, hooks, Server Actions, and utilities with Vitest and Testing Library
applies_to: [frontend]
required_by: []
package: vitest
---

# Unit Testing (Next.js, Vitest)

Unit and component testing with [Vitest](https://vitest.dev) and [Testing Library](https://testing-library.com/docs/react-testing-library/intro/). Covers Client Components, custom hooks, Server Actions (as plain async functions), and pure utilities.

**Important limitation (official Next.js docs):**
> *"Since async Server Components are new to the React ecosystem, some tools do not fully support them. We recommend using End-to-End Testing over Unit Testing for async components."*

Async Server Components are tested via E2E (`testing-e2e`), not here.

## When to use

- Client Components with user interaction logic (forms, toggles, conditional rendering).
- Custom hooks (`src/hooks/`).
- Server Actions — imported and called as plain async functions.
- Pure utilities (`src/lib/`).
- Not for async Server Components — use `testing-e2e` for those.

## Package

```
vitest@^2.x                       # test runner
@vitejs/plugin-react@^4.x         # JSX transform
@testing-library/react@^16.x      # component rendering
@testing-library/user-event@^14.x # realistic user interactions
@testing-library/jest-dom@^6.x    # DOM matchers
vite-tsconfig-paths@^5.x          # path alias resolution (@/*)
jsdom@^25.x                       # DOM environment
```

## Configuration

```ts
// vitest.config.mts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

```ts
// vitest.setup.ts
import '@testing-library/jest-dom';
```

```json
// package.json (scripts)
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

## How to use

### Client Component

```tsx
// src/components/counter.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Counter } from './counter';

describe('Counter', () => {
  it('increments on click', async () => {
    const user = userEvent.setup();
    render(<Counter initialValue={0} />);

    await user.click(screen.getByRole('button', { name: /increment/i }));

    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
```

### Custom hook

```ts
// src/hooks/use-debounce.test.ts
import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useDebounce } from './use-debounce';

describe('useDebounce', () => {
  it('returns the debounced value after the delay', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'ab' });
    expect(result.current).toBe('a'); // not yet updated

    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe('ab');

    vi.useRealTimers();
  });
});
```

### Server Action (as a plain async function)

Server Actions are async functions — import and call them directly. Mock Next.js internals.

```ts
// src/actions/user-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/navigation and next/headers before importing the action
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/dal', () => ({
  verifySession: vi.fn().mockResolvedValue({ user: { id: 'user-1', role: 'admin' } }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      create: vi.fn().mockResolvedValue({ id: 'new-user', email: 'a@b.com' }),
    },
  },
}));

import { redirect } from 'next/navigation';
import { createUser } from './user-actions';

describe('createUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects to the new user page on success', async () => {
    const formData = new FormData();
    formData.append('email', 'a@b.com');
    formData.append('name', 'Test User');

    await createUser({}, formData);

    expect(redirect).toHaveBeenCalledWith('/users/new-user');
  });

  it('returns validation errors for invalid email', async () => {
    const formData = new FormData();
    formData.append('email', 'not-an-email');
    formData.append('name', 'Test');

    const result = await createUser({}, formData);

    expect(result?.errors?.email).toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});
```

### Pure utility

```ts
// src/lib/format-currency.test.ts
import { formatCurrency } from './format-currency';

describe('formatCurrency', () => {
  it('formats a number as USD', () => {
    expect(formatCurrency(1234.5, 'USD')).toBe('$1,234.50');
  });
});
```

## Mocking Next.js internals

```ts
// next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/current-path',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// next/headers (async in Next.js 15)
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'test-token' }),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// next/cache
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
}));
```

## Rules

- Do not test async Server Components with Vitest — use `testing-e2e` instead. The official docs confirm this is not supported.
- Test files are co-located with the source file, suffixed `.test.ts` or `.test.tsx`.
- Use `userEvent` (from `@testing-library/user-event`) for interactions, not `fireEvent`. `userEvent` simulates real browser behavior.
- Mock `next/navigation`, `next/headers`, and `next/cache` at the top of every test file that imports actions or components using them.
- `describe` names the unit under test. `it` names the behavior. Use plain language.
- Clear mocks between tests: `vi.clearAllMocks()` in `beforeEach`.
- Do not test implementation details — test observable behavior (what the user sees, what functions return).

## Integration with other conventions

- **testing-e2e**: async Server Components and full user flows are tested there.
- **mutations**: Server Actions are unit-tested as plain async functions by mocking `next/navigation`, `next/headers`, and DB clients.
- **auth**: `verifySession()` from the DAL is mocked in action tests — never hit real auth in unit tests.
