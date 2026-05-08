---
name: react-language
description: React 18 core patterns — JSX, hooks rules, component composition, Suspense, Error Boundaries. Use when writing React components, defining custom hooks, or reviewing hook usage correctness.
metadata:
  triggers:
    files:
      - '*.tsx'
      - '*.jsx'
    keywords:
      - react
      - jsx
      - hooks
      - useState
      - useEffect
      - useCallback
      - suspense
---

# React Language

## Component Structure

```tsx
// Named export, typed props — always
interface UserCardProps {
  user: User;
  onSelect: (id: string) => void;
}

export function UserCard({ user, onSelect }: UserCardProps) {
  return <div onClick={() => onSelect(user.id)}>{user.name}</div>;
}
```

Never use default exports for components — they lose the name at the import site.

## Rules of Hooks

- Call hooks only at the top level — never inside conditions, loops, or nested functions
- Call hooks only in function components or custom hooks
- Custom hook names must start with `use`

```tsx
// ✗ conditional hook — invalid
if (isLoggedIn) {
  const [count, setCount] = useState(0);
}

// ✓ condition inside the component body
const [count, setCount] = useState(0);
if (!isLoggedIn) return null;
```

## Derived State — Compute, Don't Sync

```tsx
// ✗ useEffect to sync derived state — creates stale state bugs
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);

// ✓ compute directly — no effect needed
const fullName = `${firstName} ${lastName}`;
```

## useEffect — Dependency Array

```tsx
// ✓ cancel async on cleanup
useEffect(() => {
  let cancelled = false;
  fetchUser(id).then(u => { if (!cancelled) setUser(u); });
  return () => { cancelled = true; };
}, [id]);

// ✗ stale closure — value is captured once and never updated
useEffect(() => {
  doSomethingWith(value);
}, []); // missing dependency
```

Run `eslint-plugin-react-hooks` — catches missing dependencies automatically.

## useCallback and useMemo

```tsx
// ✓ memoize callback passed to a React.memo child
const handleClick = useCallback(() => onSelect(item.id), [item.id, onSelect]);

// ✓ memoize expensive sort
const sorted = useMemo(
  () => items.slice().sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);

// ✗ memoizing cheap operations — overhead exceeds savings
const label = useMemo(() => `Hello ${name}`, [name]);
```

## useRef

```tsx
// DOM access
const inputRef = useRef<HTMLInputElement>(null);
inputRef.current?.focus();

// Mutable value without re-render (e.g. interval ID)
const timerId = useRef<ReturnType<typeof setInterval> | null>(null);
timerId.current = setInterval(tick, 1000);
```

Never read or write refs during render — side-effects only.

## Suspense + lazy

```tsx
const HeavyChart = lazy(() => import('./HeavyChart'));

function Dashboard() {
  return (
    <Suspense fallback={<Spinner />}>
      <HeavyChart />
    </Suspense>
  );
}
```

## Error Boundary

```tsx
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// Wrap async subtrees
<ErrorBoundary fallback={<ErrorPage />}>
  <Suspense fallback={<Loading />}>
    <DataDrivenPage />
  </Suspense>
</ErrorBoundary>
```

## List Rendering

```tsx
// ✓ stable unique key from data
{users.map(user => <UserCard key={user.id} user={user} />)}

// ✗ index as key — breaks reconciliation on reorder
{users.map((user, i) => <UserCard key={i} user={user} />)}
```

## Anti-Patterns

- ❌ `useEffect` for derived state — compute directly
- ❌ Missing `useEffect` dependencies — use `eslint-plugin-react-hooks`
- ❌ Default exports for components — use named exports
- ❌ Index as list key — use stable IDs from data
- ❌ Over-memoizing cheap values — profile before adding `useMemo`/`useCallback`
- ❌ Writing to refs during render — side-effects in effects or handlers only

## Verification

1. `tsc --noEmit` — type errors
2. `eslint --max-warnings 0` — hooks rule violations
3. `vitest run` — component tests

## References

- [Hooks Patterns](references/hooks-patterns.md) — useReducer, context, custom hook composition
