# Type Patterns Reference

## Brand Types (Opaque Types)

Prevent mixing structurally identical primitives:

```ts
// Without branding — UserId and PostId are interchangeable (bug!)
type UserId = string;
type PostId = string;

// With branding — compiler catches swapped IDs
type UserId = string & { readonly __brand: 'UserId' };
type PostId = string & { readonly __brand: 'PostId' };

// Constructor functions validate and brand
function UserId(raw: string): UserId {
  if (!raw.startsWith('u-')) throw new Error(`Invalid UserId: ${raw}`);
  return raw as UserId;
}

// Usage — compile error if you swap them
function getPost(userId: UserId, postId: PostId) { ... }
getPost(UserId('u-1'), PostId('p-1'));  // ✓
getPost(PostId('p-1'), UserId('u-1')); // ✗ compile error
```

## Discriminated Unions — Exhaustive Narrowing

```ts
type Shape =
  | { kind: 'circle';    radius: number }
  | { kind: 'rectangle'; width: number; height: number }
  | { kind: 'triangle';  base: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':    return Math.PI * shape.radius ** 2;
    case 'rectangle': return shape.width * shape.height;
    case 'triangle':  return 0.5 * shape.base * shape.height;
    default: {
      // exhaustiveness check — errors if a new variant is added without handling
      const _exhaustive: never = shape;
      throw new Error(`Unhandled shape: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
```

## `satisfies` Operator (TS 4.9+)

Validate a value matches a type without widening it:

```ts
type Palette = Record<string, [number, number, number] | string>;

// ✗ type annotation — loses literal types
const palette: Palette = {
  red: [255, 0, 0],
  green: '#00ff00',
};
palette.red;  // type: [number, number, number] | string  (widened)

// ✓ satisfies — validates shape AND keeps literal types
const palette = {
  red: [255, 0, 0],
  green: '#00ff00',
} satisfies Palette;
palette.red;    // type: [number, number, number]  (preserved)
palette.green;  // type: string                    (preserved)
```

## Conditional Types

```ts
// Extract the element type of an array
type ElementOf<T> = T extends readonly (infer E)[] ? E : never;
type Names = ElementOf<string[]>;  // string

// Unwrap a Promise
type Awaited<T> = T extends Promise<infer R> ? Awaited<R> : T;
type Value = Awaited<Promise<Promise<string>>>;  // string

// Exclude null/undefined from a union
type NonNullable<T> = T extends null | undefined ? never : T;
```

## Template Literal Types

```ts
type EventName = 'click' | 'focus' | 'blur';
type HandlerName = `on${Capitalize<EventName>}`;
// → 'onClick' | 'onFocus' | 'onBlur'

type ApiRoute = `/api/v1/${'users' | 'posts'}`;
// → '/api/v1/users' | '/api/v1/posts'

// Enforce string format at the type level
type ISODate = `${number}-${number}-${number}`;
```

## Mapped Types

```ts
// Make all properties optional and readonly
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

// Pick by value type
type OnlyStrings<T> = {
  [K in keyof T as T[K] extends string ? K : never]: T[K];
};

type User = { id: number; name: string; email: string; age: number };
type UserStrings = OnlyStrings<User>;
// → { name: string; email: string }
```

## Unknown Narrowing Patterns

```ts
// Type guard function
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as { id: unknown }).id === 'string'
  );
}

// Assertion function (throws instead of returning bool)
function assertIsString(value: unknown): asserts value is string {
  if (typeof value !== 'string') {
    throw new TypeError(`Expected string, got ${typeof value}`);
  }
}

// Use with zod for external data
import { z } from 'zod';
const UserSchema = z.object({ id: z.string(), name: z.string() });
type User = z.infer<typeof UserSchema>;  // derive type from schema
const user = UserSchema.parse(json);     // throws on invalid, returns User
```

## Result Type Pattern

```ts
type Ok<T>  = { readonly ok: true;  readonly value: T };
type Err<E> = { readonly ok: false; readonly error: E };
type Result<T, E = Error> = Ok<T> | Err<E>;

const ok  = <T>(value: T): Ok<T>   => ({ ok: true, value });
const err = <E>(error: E): Err<E>  => ({ ok: false, error });

// Usage
async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const data = await api.getUser(id);
    return ok(UserSchema.parse(data));
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

const result = await fetchUser('u-1');
if (!result.ok) {
  console.error(result.error.message);
} else {
  console.log(result.value.name);
}
```

No thrown errors at business logic boundaries — callers handle `Result` explicitly.
