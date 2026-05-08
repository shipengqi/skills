# Async Patterns Reference

## Concurrency Limiting

When processing large arrays, avoid launching unlimited parallel requests:

```ts
// ✗ Promise.all on 10,000 items — floods the server
await Promise.all(items.map(item => fetchItem(item.id)));

// ✓ p-limit — cap at N concurrent operations
import pLimit from 'p-limit';

const limit = pLimit(10);  // max 10 concurrent
const results = await Promise.all(
  items.map(item => limit(() => fetchItem(item.id)))
);
```

## Timeout

```ts
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

// Usage
const user = await withTimeout(fetchUser(id), 5000);
```

## Retry with Exponential Backoff

```ts
async function withRetry<T>(
  fn: () => Promise<T>,
  { maxAttempts = 3, baseDelayMs = 100 }: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, baseDelayMs * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

// Usage
const data = await withRetry(() => fetch('/api/data').then(r => r.json()), { maxAttempts: 3 });
```

## AbortController — Cancellable Requests

```ts
// Cancel a fetch when the component unmounts / request superseded
async function fetchWithAbort(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// Caller controls lifetime
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);  // cancel after 5s

try {
  const data = await fetchWithAbort('/api/users', controller.signal);
} catch (e) {
  if (e instanceof Error && e.name === 'AbortError') {
    console.log('Request was cancelled');
  } else {
    throw e;
  }
}
```

## Async Iteration

```ts
// Process a paginated API without loading everything into memory
async function* fetchAllUsers(): AsyncGenerator<User> {
  let cursor: string | undefined;
  do {
    const page = await api.listUsers({ cursor, limit: 100 });
    yield* page.items;
    cursor = page.nextCursor;
  } while (cursor);
}

for await (const user of fetchAllUsers()) {
  await processUser(user);
}
```

## Structured Concurrency Pattern

Run independent async tasks, cancel all if any fail:

```ts
async function loadDashboard(userId: string) {
  const controller = new AbortController();
  const { signal } = controller;

  try {
    const [profile, feed, notifications] = await Promise.all([
      fetchProfile(userId, signal),
      fetchFeed(userId, signal),
      fetchNotifications(userId, signal),
    ]);
    return { profile, feed, notifications };
  } catch (e) {
    controller.abort();  // cancel remaining requests
    throw e;
  }
}
```

## Avoiding Floating Promises

```ts
// ✗ floating promise — rejection is swallowed silently
function handleEvent() {
  sendAnalytics(event);  // async, not awaited
}

// ✓ option 1 — await it
async function handleEvent() {
  await sendAnalytics(event);
}

// ✓ option 2 — explicit fire-and-forget with error logging
function handleEvent() {
  sendAnalytics(event).catch(err => logger.error('analytics failed', { err }));
}
```

ESLint rule `@typescript-eslint/no-floating-promises` catches these automatically.

## Async Error Boundary Pattern

```ts
// Wrap any async function to ensure errors are always handled
function safeAsync<T>(
  fn: () => Promise<T>,
  onError: (e: unknown) => void,
): () => Promise<T | undefined> {
  return async () => {
    try {
      return await fn();
    } catch (e) {
      onError(e);
      return undefined;
    }
  };
}
```
