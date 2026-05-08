# React State Patterns

## Zustand — Persisted Store

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SettingsStore {
  theme: 'light' | 'dark';
  language: string;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      theme: 'light',
      language: 'en',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme, language: state.language }),
    }
  )
);
```

## TanStack Query — Prefetching

```tsx
// Prefetch on hover for instant navigation
function PostLink({ id }: { id: string }) {
  const queryClient = useQueryClient();

  return (
    <Link
      href={`/posts/${id}`}
      onMouseEnter={() =>
        queryClient.prefetchQuery({
          queryKey: ['posts', id],
          queryFn: () => fetchPost(id),
          staleTime: 60_000,
        })
      }
    >
      View post
    </Link>
  );
}
```

## TanStack Query — Infinite Scroll

```tsx
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: ['posts'],
  queryFn: ({ pageParam = 1 }) => fetchPosts({ page: pageParam }),
  getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
  initialPageParam: 1,
});

const allPosts = data?.pages.flatMap(p => p.items) ?? [];
```

## TanStack Query — Suspense Mode

```tsx
// Enable suspense mode for cleaner data access
const { data } = useSuspenseQuery({
  queryKey: ['user', id],
  queryFn: () => fetchUser(id),
});
// data is always defined here — no isLoading check needed

// Wrap in Suspense + ErrorBoundary
<ErrorBoundary fallback={<ErrorPage />}>
  <Suspense fallback={<UserSkeleton />}>
    <UserProfile id={id} />
  </Suspense>
</ErrorBoundary>
```

## Zustand — Slice Pattern (large stores)

```ts
// Separate slices for large apps
const createAuthSlice: StateCreator<AuthSlice & CartSlice, [], [], AuthSlice> = (set) => ({
  user: null,
  setUser: (user) => set({ user }),
});

const createCartSlice: StateCreator<AuthSlice & CartSlice, [], [], CartSlice> = (set) => ({
  items: [],
  addItem: (item) => set(s => ({ items: [...s.items, item] })),
});

export const useStore = create<AuthSlice & CartSlice>()((...a) => ({
  ...createAuthSlice(...a),
  ...createCartSlice(...a),
}));
```
