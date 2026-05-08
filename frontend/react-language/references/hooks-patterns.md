# React Hooks Patterns

## useReducer — Complex State Transitions

```tsx
type Action =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'reset'; payload: number };

function reducer(state: number, action: Action): number {
  switch (action.type) {
    case 'increment': return state + 1;
    case 'decrement': return state - 1;
    case 'reset':     return action.payload;
  }
}

function Counter() {
  const [count, dispatch] = useReducer(reducer, 0);
  return (
    <>
      <span>{count}</span>
      <button onClick={() => dispatch({ type: 'increment' })}>+</button>
      <button onClick={() => dispatch({ type: 'reset', payload: 0 })}>Reset</button>
    </>
  );
}
```

Use `useReducer` when: multiple sub-values in state, next state depends on previous, state transitions are complex.

## Context — Shared State Without Prop Drilling

```tsx
interface ThemeContextValue {
  theme: 'light' | 'dark';
  toggle: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue>(null!);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const toggle = useCallback(() => setTheme(t => t === 'light' ? 'dark' : 'light'), []);
  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
```

Always export a custom hook that wraps `useContext` — it throws a clear error when used outside the provider.

## Custom Hook Composition

```tsx
// Compose small hooks into larger ones
function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const handler = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return size;
}

function useBreakpoint(): 'mobile' | 'tablet' | 'desktop' {
  const { width } = useWindowSize();
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}
```

## useImperativeHandle — Expose Methods to Parent

```tsx
interface InputHandle {
  focus: () => void;
  clear: () => void;
}

const FancyInput = forwardRef<InputHandle, InputProps>((props, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => { if (inputRef.current) inputRef.current.value = ''; },
  }));

  return <input ref={inputRef} {...props} />;
});

// Parent usage
const inputRef = useRef<InputHandle>(null);
<FancyInput ref={inputRef} />
<button onClick={() => inputRef.current?.clear()}>Clear</button>
```
