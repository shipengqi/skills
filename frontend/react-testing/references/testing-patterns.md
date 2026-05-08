# React Testing Patterns

## Custom Hooks Testing

```ts
import { renderHook, act } from '@testing-library/react';
import { useCounter } from './use-counter';

test('increments count', () => {
  const { result } = renderHook(() => useCounter(0));

  act(() => result.current.increment());
  expect(result.current.count).toBe(1);
});

// Hook that uses TanStack Query — wrap in provider
test('useUsers returns users', async () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {children}
    </QueryClientProvider>
  );

  const { result } = renderHook(() => useUsers(), { wrapper });
  await waitFor(() => expect(result.current.users).toHaveLength(1));
});
```

## Zustand Store Testing

```ts
import { act } from '@testing-library/react';
import { useAuthStore } from './auth-store';

beforeEach(() => {
  useAuthStore.setState({ user: null });  // reset between tests
});

test('setUser updates store', () => {
  act(() => useAuthStore.getState().setUser(mockUser));
  expect(useAuthStore.getState().user).toEqual(mockUser);
});

test('logout clears user', () => {
  useAuthStore.setState({ user: mockUser });
  act(() => useAuthStore.getState().logout());
  expect(useAuthStore.getState().user).toBeNull();
});
```

## MSW Browser Setup (for Storybook)

```ts
// src/mocks/browser.ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
export const worker = setupWorker(...handlers);

// In Storybook preview.ts
if (process.env.NODE_ENV === 'development') {
  const { worker } = await import('../src/mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}
```

## Testing Error States

```tsx
test('shows error message when API fails', async () => {
  server.use(
    http.get('/api/users', () =>
      HttpResponse.json({ error: 'Server Error' }, { status: 500 })
    )
  );

  render(<UserList />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load users');
});
```

## Accessibility Testing

```tsx
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

test('form has no accessibility violations', async () => {
  const { container } = render(<LoginForm onSubmit={vi.fn()} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```
