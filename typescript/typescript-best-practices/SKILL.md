---
name: typescript-best-practices
description: TypeScript async patterns, module conventions, error handling, and testing with Vitest. Use when writing async code, structuring modules, handling errors at boundaries, or writing unit tests in TypeScript projects.
metadata:
  triggers:
    files:
      - 'tsconfig.json'
      - 'vitest.config.ts'
      - 'vitest.config.js'
    keywords:
      - async
      - Promise
      - vitest
      - describe
      - it
      - vi.mock
      - import type
      - error handling
---

# TypeScript Best Practices

## Async / Await

```ts
// ✓ async/await over raw Promise chains
async function fetchUser(id: string): Promise<User> {
  const response = await api.get(`/users/${id}`);
  return UserSchema.parse(response.data);
}

// ✗ .then() chains — harder to read, error handling is error-prone
api.get(`/users/${id}`)
  .then(r => UserSchema.parse(r.data))
  .catch(e => { throw e });
```

## Parallel Execution

```ts
// ✓ Promise.all — run independent operations concurrently
const [user, posts, permissions] = await Promise.all([
  userService.get(userId),
  postService.listByUser(userId),
  authService.getPermissions(userId),
]);

// ✗ sequential awaits when operations are independent (3x slower)
const user        = await userService.get(userId);
const posts       = await postService.listByUser(userId);
const permissions = await authService.getPermissions(userId);

// Promise.allSettled — when partial failure is acceptable
const results = await Promise.allSettled([fetchA(), fetchB(), fetchC()]);
const values  = results
  .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
  .map(r => r.value);
```

## Error Handling at Boundaries

Errors throw across async code silently if not handled. Catch at the entry point (handler/controller), not in every helper:

```ts
// service — let errors propagate naturally
async function createUser(data: CreateUserInput): Promise<User> {
  const existing = await db.users.findByEmail(data.email);
  if (existing) throw new ConflictError(`Email ${data.email} already in use`);
  return db.users.create(data);
}

// handler — single catch point, convert to response
async function handleCreateUser(req: Request): Promise<Response> {
  try {
    const user = await createUser(req.body);
    return Response.json(user, { status: 201 });
  } catch (e) {
    if (e instanceof ConflictError) return Response.json({ error: e.message }, { status: 409 });
    if (e instanceof ValidationError) return Response.json({ error: e.message }, { status: 400 });
    throw e;  // unknown errors bubble up to global handler
  }
}
```

## Custom Error Classes

```ts
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = this.constructor.name;
    // Fix prototype chain in transpiled code
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

class NotFoundError    extends AppError { constructor(msg: string) { super(msg, 'NOT_FOUND', 404); } }
class ConflictError    extends AppError { constructor(msg: string) { super(msg, 'CONFLICT', 409); } }
class ValidationError  extends AppError { constructor(msg: string) { super(msg, 'VALIDATION', 400); } }
class UnauthorizedError extends AppError { constructor(msg: string) { super(msg, 'UNAUTHORIZED', 401); } }
```

## Module Conventions

```ts
// ✓ Named exports only — explicit, tree-shakeable
export interface UserService { ... }
export class UserServiceImpl implements UserService { ... }
export function createUserService(deps: Deps): UserService { ... }

// ✓ import type for type-only imports — zero runtime cost
import type { User, CreateUserInput } from './user.types.js';
import { createUserService } from './user-service.js';

// ✓ Group imports: external → internal → types
import { z } from 'zod';
import { db } from '../db/client.js';
import type { User } from './types.js';

// ✗ Barrel re-exports that import everything eagerly
// export * from './user-service.js';  // breaks tree-shaking
```

## Vitest — Unit Tests

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUserService } from './user-service.js';
import type { UserRepository } from './user-repository.js';

describe('UserService', () => {
  let mockRepo: UserRepository;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
    };
  });

  it('returns user when found', async () => {
    const user = { id: 'u-1', name: 'Alice', email: 'alice@example.com' };
    vi.mocked(mockRepo.findById).mockResolvedValue(user);

    const service = createUserService({ repo: mockRepo });
    const result = await service.get('u-1');

    expect(result).toEqual(user);
    expect(mockRepo.findById).toHaveBeenCalledWith('u-1');
    expect(mockRepo.findById).toHaveBeenCalledOnce();
  });

  it('throws NotFoundError when user missing', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    const service = createUserService({ repo: mockRepo });
    await expect(service.get('u-999')).rejects.toThrow(NotFoundError);
  });
});
```

## Vitest — Mocking Modules

```ts
// Mock entire module
vi.mock('./email-service.js', () => ({
  sendEmail: vi.fn().mockResolvedValue({ messageId: 'msg-1' }),
}));

// Mock with factory (when you need the real module partially)
vi.mock('./config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./config.js')>();
  return { ...actual, API_URL: 'http://localhost:3000' };
});

// Spy on a method without full mock
const spy = vi.spyOn(service, 'sendEmail').mockResolvedValue({ messageId: 'msg-1' });
expect(spy).toHaveBeenCalledWith(expect.objectContaining({ to: 'user@example.com' }));
```

## Dependency Injection — Constructor Pattern

```ts
// Define interfaces for dependencies — enables mocking
interface EmailSender {
  send(to: string, subject: string, body: string): Promise<void>;
}

interface UserRepository {
  findById(id: string): Promise<User | null>;
  create(data: CreateUserInput): Promise<User>;
}

// Accept deps via constructor — no global state
class UserService {
  constructor(
    private readonly repo: UserRepository,
    private readonly email: EmailSender,
  ) {}

  async create(data: CreateUserInput): Promise<User> {
    const user = await this.repo.create(data);
    await this.email.send(user.email, 'Welcome!', `Hi ${user.name}`);
    return user;
  }
}
```

## Anti-Patterns

- ❌ `async` function that never `await`s — remove `async` or it returns `Promise<T>` unexpectedly
- ❌ `await` inside a loop — use `Promise.all` for independent items
- ❌ Unhandled promise rejections — always `await` or `.catch()` floating promises
- ❌ `try/catch` wrapping every function — catch only at boundaries
- ❌ `export default` — use named exports
- ❌ `catch (e: any)` — use `catch (e: unknown)` and narrow

## References

- [Async Patterns](references/async-patterns.md) — concurrency limits, timeout, retry, AbortController
