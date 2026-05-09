---
name: react-testing
description: React testing with Vitest + React Testing Library + MSW. Use when writing component tests, mocking API calls, or deciding what to test in a React application. Apply whenever user uses fireEvent instead of userEvent.setup(), getByTestId as default query, jest.fn() to mock fetch calls, or arbitrary setTimeout in tests instead of findBy* queries.
metadata:
  triggers:
    files:
      - '*.test.tsx'
      - '*.spec.tsx'
      - 'vitest.config.ts'
    keywords:
      - vitest
      - react testing library
      - msw
      - screen
      - userEvent
      - render
      - testing
---

# React Testing

## Setup

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    globals: true,
  },
});

// src/tests/setup.ts
import '@testing-library/jest-dom';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Query by Accessibility Role — Not by Class

```tsx
// ✗ implementation detail — breaks on refactor
container.querySelector('.user-card__title')
screen.getByTestId('submit-button')

// ✓ what the user sees
screen.getByRole('button', { name: 'Sign in' })
screen.getByLabelText('Email')
screen.getByText('Welcome, Alice')
screen.getByRole('heading', { name: 'Dashboard' })
```

Priority: `getByRole` > `getByLabelText` > `getByText` > `getByTestId`.

## userEvent — Simulate Real Interactions

```tsx
import userEvent from '@testing-library/user-event';

test('submits login form', async () => {
  const user = userEvent.setup();
  render(<LoginForm onSuccess={vi.fn()} />);

  await user.type(screen.getByLabelText('Email'), 'alice@example.com');
  await user.type(screen.getByLabelText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  expect(await screen.findByText('Welcome, Alice')).toBeInTheDocument();
});
```

Use `userEvent.setup()` — not the deprecated `userEvent.type()` directly. Always `await` user interactions.

## MSW — Mock API Calls

```ts
// src/tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/users', () =>
    HttpResponse.json([{ id: '1', name: 'Alice' }])
  ),
  http.post('/api/auth/login', () =>
    HttpResponse.json({ token: 'fake-token' })
  ),
];

// src/tests/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';
export const server = setupServer(...handlers);
```

Override in individual tests:

```tsx
test('shows error on failed login', async () => {
  server.use(
    http.post('/api/auth/login', () =>
      HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 })
    )
  );
  // ...
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
});
```

## Async Queries

```tsx
// findBy* waits for element to appear (async)
const heading = await screen.findByRole('heading', { name: 'Users' });

// waitFor — for assertions that depend on async state
await waitFor(() => {
  expect(screen.queryByRole('status')).not.toBeInTheDocument(); // spinner gone
});

// ✗ avoid arbitrary sleeps
await new Promise(r => setTimeout(r, 100)); // flaky
```

## Custom Render with Providers

```tsx
// src/tests/utils.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';

function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

export function renderWithProviders(ui: React.ReactElement) {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}
```

## What to Test

| Test this | Not this |
|---|---|
| User interactions and resulting UI changes | Internal state values |
| Error states and loading states | Component implementation details |
| Accessibility (role, label) | CSS classes |
| API integration via MSW | Implementation of the mock |

## Anti-Patterns

- ❌ `getByTestId` as default — use semantic roles instead
- ❌ `fireEvent` — use `userEvent` for realistic interaction simulation
- ❌ Testing implementation details (state, private methods) — test behavior
- ❌ Snapshot tests for complex components — too brittle, low signal
- ❌ Missing `await` on `userEvent` calls — causes race conditions

## Verification

1. `vitest run` — all tests pass
2. `vitest --coverage` — coverage report
3. Unhandled request warnings from MSW indicate missing handler

## References

- [Testing Patterns](references/testing-patterns.md) — custom hooks tests, TanStack Query test setup, Zustand store tests
