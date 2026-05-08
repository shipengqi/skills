---
name: react-state
description: React state management — Zustand for client state, TanStack Query for server state. Use when deciding where state lives, setting up a store, fetching data, or handling mutations with cache invalidation.
metadata:
  triggers:
    files:
      - '*.ts'
      - '*.tsx'
    keywords:
      - zustand
      - tanstack query
      - react query
      - useQuery
      - useMutation
      - useState
      - global state
      - server state
---

# React State

## When to Use Which

| State type | Tool |
|---|---|
| Server data (API responses) | TanStack Query |
| Global client state (current user, theme) | Zustand |
| Local UI state (modal open, tab selected) | `useState` |
| Form state | react-hook-form |

Never put server data in Zustand — TanStack Query handles caching, deduplication, and revalidation automatically.

## Zustand — Client State

```ts
import { create } from 'zustand';

interface AuthStore {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
}));
```

Keep actions inside the store definition — not in components. Use selectors to avoid unnecessary re-renders:

```tsx
// ✓ select only what the component needs
const user = useAuthStore(state => state.user);

// ✗ subscribes to the entire store — re-renders on any change
const store = useAuthStore();
```

## Zustand with devtools (development)

```ts
import { devtools } from 'zustand/middleware';

export const useAuthStore = create<AuthStore>()(
  devtools(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }, false, 'setUser'),
      logout: () => set({ user: null }, false, 'logout'),
    }),
    { name: 'AuthStore' }
  )
);
```

## TanStack Query — Server State

```tsx
// Setup: wrap app with QueryClientProvider
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000 } },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  );
}
```

```tsx
// Query
const { data: users = [], isLoading, error } = useQuery({
  queryKey: ['users'],
  queryFn: () => api.get<User[]>('/users'),
  staleTime: 60_000,
});

// Mutation with cache invalidation
const createUser = useMutation({
  mutationFn: (dto: CreateUserDto) => api.post<User>('/users', dto),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
  },
});

createUser.mutate({ name: 'Alice', email: 'alice@example.com' });
```

## Query Keys — Consistent Convention

```ts
// Group by resource, then filter params
['users']                        // all users
['users', userId]                // single user
['users', { role: 'admin' }]     // filtered list
['posts', postId, 'comments']    // nested resource
```

Extract to a factory object:

```ts
export const userKeys = {
  all:    () => ['users']                    as const,
  detail: (id: string) => ['users', id]      as const,
  list:   (f: UserFilter) => ['users', f]    as const,
};
```

## Optimistic Updates

```tsx
const updateUser = useMutation({
  mutationFn: (user: User) => api.put(`/users/${user.id}`, user),
  onMutate: async (updated) => {
    await queryClient.cancelQueries({ queryKey: userKeys.detail(updated.id) });
    const previous = queryClient.getQueryData(userKeys.detail(updated.id));
    queryClient.setQueryData(userKeys.detail(updated.id), updated);
    return { previous };
  },
  onError: (_err, updated, context) => {
    queryClient.setQueryData(userKeys.detail(updated.id), context?.previous);
  },
  onSettled: (_, __, updated) => {
    queryClient.invalidateQueries({ queryKey: userKeys.detail(updated.id) });
  },
});
```

## Anti-Patterns

- ❌ `useState` for data fetched from an API — use TanStack Query
- ❌ Storing server data in Zustand — duplicates cache, causes stale state
- ❌ Using entire Zustand store in a component — use selectors
- ❌ Missing `queryKey` namespacing — collisions between resources
- ❌ Calling `invalidateQueries` without scoping — invalidates unrelated queries

## Verification

1. React Query Devtools — inspect cache, stale time, refetch triggers
2. Zustand devtools — trace state changes per action
3. `vitest run` — test store actions in isolation

## References

- [State Patterns](references/state-patterns.md) — persisted Zustand, prefetching, suspense mode
