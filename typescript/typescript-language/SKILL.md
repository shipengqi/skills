---
name: typescript-language
description: TypeScript core idioms — strict config, type system patterns, naming conventions, and anti-patterns. Use when writing TypeScript, defining types/interfaces, narrowing unknown values, or reviewing type correctness. Apply whenever user writes enum, any, !, default export, or asks about discriminated unions, branded types, or TypeScript strict mode.
metadata:
  triggers:
    files:
      - 'tsconfig.json'
      - 'tsconfig*.json'
    keywords:
      - typescript
      - interface
      - type alias
      - discriminated union
      - unknown
      - readonly
      - as const
---

# TypeScript Language

## tsconfig.json — Required Settings

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

`strict: true` enables: `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictPropertyInitialization`, and more. Never disable it.

## Naming

```ts
// Types / Interfaces / Classes / Enums — PascalCase
interface UserProfile { ... }
type UserId = string;
class AuthService { ... }

// Variables / functions / methods — camelCase
const userId = 'u-123';
function parseResponse() { ... }

// Constants known at compile time — UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;

// Files — kebab-case
// user-profile.ts, auth-service.ts, incident.types.ts
```

## interface vs type

```ts
// interface — for object shapes (extensible, shows in error messages)
interface User {
  id: string;
  name: string;
}
interface AdminUser extends User {
  role: 'admin';
}

// type — for unions, intersections, mapped types, aliases
type Status = 'active' | 'inactive' | 'deleted';
type ApiResponse<T> = { data: T; error: null } | { data: null; error: string };
type Readonly<T> = { readonly [K in keyof T]: T[K] };
```

Use `interface` for objects others extend; `type` for everything else.

## No `any` — Use `unknown`

```ts
// ✗ any disables type checking
function parse(raw: any) { return raw.name; }

// ✓ unknown forces narrowing before use
function parse(raw: unknown): string {
  if (typeof raw !== 'object' || raw === null) throw new Error('not an object');
  if (!('name' in raw) || typeof (raw as { name: unknown }).name !== 'string') {
    throw new Error('missing name');
  }
  return (raw as { name: string }).name;
}

// ✓ for API responses — parse with a schema library (zod)
const User = z.object({ id: z.string(), name: z.string() });
const user = User.parse(json);  // throws on invalid input, returns typed value
```

## No `enum` — Use Union Types or `as const`

```ts
// ✗ enum — compiles to JS object, tree-shaking unfriendly
enum Direction { Up, Down, Left, Right }

// ✓ union type — zero runtime cost
type Direction = 'up' | 'down' | 'left' | 'right';

// ✓ as const — when you need the object form (e.g. for iteration)
const Direction = {
  Up: 'up',
  Down: 'down',
  Left: 'left',
  Right: 'right',
} as const;
type Direction = typeof Direction[keyof typeof Direction];
```

## No `!` Non-Null Assertion

```ts
// ✗ ! silences the compiler, hides bugs
const name = user!.profile!.name!;

// ✓ explicit null check
if (!user?.profile?.name) throw new Error('user profile name is required');
const name = user.profile.name;

// ✓ optional chaining + nullish coalescing
const name = user?.profile?.name ?? 'anonymous';
```

## Discriminated Unions

```ts
// Tag each variant with a literal type field
type Result<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string };

// Exhaustive switch — TypeScript catches missing cases
function handle<T>(result: Result<T>): T {
  switch (result.ok) {
    case true:  return result.data;
    case false: throw new Error(result.error);
  }
}

// API shape with discriminant
type ApiEvent =
  | { type: 'created'; payload: CreatePayload }
  | { type: 'updated'; payload: UpdatePayload }
  | { type: 'deleted'; id: string };
```

## `readonly` and Immutability

```ts
// Prevent mutation of function parameters and properties
interface Config {
  readonly apiUrl: string;
  readonly timeout: number;
}

// Readonly arrays — cannot push/pop/splice
function process(items: readonly string[]): void { ... }

// ReadonlyMap / ReadonlySet
function lookup(map: ReadonlyMap<string, number>): number | undefined {
  return map.get('key');
}
```

## Exports

```ts
// ✓ named exports — explicit, tree-shakeable, refactor-friendly
export interface User { ... }
export function createUser(...) { ... }
export class UserService { ... }

// ✗ default exports — lose name at import site, harder to refactor
export default class UserService { ... }

// ✓ import type — erased at compile time, no runtime cost
import type { User } from './types.js';
import { createUser } from './user-service.js';
```

## Utility Types

```ts
type PartialUser    = Partial<User>;        // all fields optional
type RequiredUser   = Required<User>;       // all fields required
type ReadonlyUser   = Readonly<User>;       // all fields readonly
type UserName       = Pick<User, 'id' | 'name'>;
type UserNoId       = Omit<User, 'id'>;
type UserRecord     = Record<string, User>; // index signature
type NonNullUser    = NonNullable<User | null | undefined>;
type ReturnType<F>  = F extends (...args: any[]) => infer R ? R : never;
```

## Anti-Patterns

- ❌ `any` — use `unknown` + narrowing or `zod` for external data
- ❌ `enum` — use union strings or `as const` object
- ❌ `!` non-null assertion — use explicit checks or `??`
- ❌ Default exports — use named exports
- ❌ `// @ts-ignore` — fix the type error instead
- ❌ `object` type — too broad; use `Record<string, unknown>` or a specific interface
- ❌ Type assertions `as Foo` without narrowing — prove the type first

## Verification

After writing or modifying TypeScript:

1. `tsc --noEmit` — catch type errors without emitting files
2. `eslint --max-warnings 0 .` — enforce style rules
3. Check for `any` leaks: `tsc --noEmit --strict`

## References

- [Type Patterns](references/type-patterns.md) — brand types, discriminated unions, conditional types, satisfies
