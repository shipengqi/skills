---
name: react-patterns
description: React component architecture — feature-based folder structure, custom hooks extraction, compound components, and composition patterns. Use when structuring a React project, extracting logic, or deciding between component patterns. Apply whenever user asks about folder structure for large React apps, compound component APIs with too many props, or whether to use render props or custom hooks for logic sharing.
metadata:
  triggers:
    files:
      - 'src/features/'
      - 'src/components/'
    keywords:
      - react
      - component pattern
      - custom hook
      - compound component
      - feature structure
      - bulletproof-react
---

# React Patterns

## Feature-Based Folder Structure

Organise by feature, not by type. Each feature is a self-contained module with its own public API.

```
src/
├── components/          # Shared, reusable UI primitives (Button, Modal, etc.)
├── features/
│   ├── auth/
│   │   ├── components/  # Feature-local components
│   │   ├── hooks/       # Feature-local hooks
│   │   ├── api/         # API calls (or React Query hooks)
│   │   ├── types/       # Feature-local types
│   │   └── index.ts     # Explicit public API — only export what others need
│   └── users/
├── hooks/               # App-wide custom hooks
├── lib/                 # Third-party wrappers (axios instance, query client)
└── types/               # Global shared types
```

Cross-feature imports must go through `index.ts`. Never import from deep paths like `features/auth/components/LoginForm`.

## Custom Hooks — Extract Logic from Components

```tsx
// ✗ logic embedded in component
function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    fetchUsers().then(u => { setUsers(u); setLoading(false); });
  }, []);
  return loading ? <Spinner /> : <List items={users} />;
}

// ✓ logic in a custom hook — component is pure UI
function useUsers() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });
  return { users, isLoading };
}

function UserList() {
  const { users, isLoading } = useUsers();
  return isLoading ? <Spinner /> : <List items={users} />;
}
```

## Compound Components

Use when a parent and its children share implicit state without prop-drilling.

```tsx
// ✗ prop drilling into every child
<Select value={val} onChange={setVal} items={items} renderItem={...} />

// ✓ compound component — children access shared context internally
<Select value={val} onChange={setVal}>
  <Select.Trigger />
  <Select.Options>
    {items.map(i => <Select.Option key={i.value} value={i.value}>{i.label}</Select.Option>)}
  </Select.Options>
</Select>

// Implementation
const SelectContext = React.createContext<SelectContextValue>(null!);

export function Select({ value, onChange, children }: SelectProps) {
  return (
    <SelectContext.Provider value={{ value, onChange }}>
      {children}
    </SelectContext.Provider>
  );
}
Select.Option = function SelectOption({ value, children }: OptionProps) {
  const ctx = useContext(SelectContext);
  return <div onClick={() => ctx.onChange(value)}>{children}</div>;
};
```

## Render Props (sparingly)

Only use render props when you need to inject rendering into a hook's lifecycle.

```tsx
// ✓ render prop for flexible rendering (e.g. virtualized list)
<VirtualList
  items={users}
  renderItem={(user) => <UserCard key={user.id} user={user} />}
/>

// ✗ render props for pure logic sharing — use a custom hook instead
```

## Component Composition over Prop Explosion

```tsx
// ✗ prop explosion — one component doing too much
<DataTable
  data={users}
  sortable
  filterable
  paginated
  onSort={...}
  onFilter={...}
  renderHeader={...}
  renderFooter={...}
/>

// ✓ compose small pieces
<DataTable data={users}>
  <DataTable.Header>
    <SortControls />
    <FilterBar />
  </DataTable.Header>
  <DataTable.Body />
  <DataTable.Footer>
    <Pagination />
  </DataTable.Footer>
</DataTable>
```

## Co-locate State

Move state as close as possible to where it's used. Lift only when two components genuinely need to share it.

```tsx
// ✗ global store for local UI state (modal open/close)
const useModalStore = create(set => ({ isOpen: false, toggle: () => set(s => ({ isOpen: !s.isOpen })) }));

// ✓ local useState — the modal only cares about itself
function UserPage() {
  const [modalOpen, setModalOpen] = useState(false);
  return <>
    <button onClick={() => setModalOpen(true)}>Edit</button>
    {modalOpen && <EditModal onClose={() => setModalOpen(false)} />}
  </>;
}
```

## Anti-Patterns

- ❌ Importing from feature internals — use `index.ts` barrel exports
- ❌ Business logic in components — extract to custom hooks
- ❌ Prop drilling >2 levels — co-locate state or use context
- ❌ Using render props for logic sharing — use custom hooks instead
- ❌ One component doing data-fetching + state + rendering + layout — split responsibilities

## References

- [Bulletproof Structure](references/bulletproof-structure.md) — full feature module layout with examples
