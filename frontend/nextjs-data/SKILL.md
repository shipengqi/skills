---
name: nextjs-data
description: Next.js data fetching — Server Actions, fetch caching strategies, revalidation, TanStack Query in Client Components, next/image and next/font. Use when fetching data, handling mutations, or optimising asset loading. Apply whenever user calls API routes from Client Components to mutate data instead of using Server Actions, omits 'use server' directive, uses router.refresh() instead of revalidatePath after mutations, uses a plain <img> tag instead of next/image, or asks how to cache fetch with time-based revalidation.
metadata:
  triggers:
    files:
      - 'app/'
      - '*.ts'
      - '*.tsx'
    keywords:
      - nextjs
      - server actions
      - use server
      - revalidatePath
      - revalidateTag
      - fetch cache
      - tanstack query
      - next/image
---

# Next.js Data

## fetch Caching Strategies

```tsx
// Static — cached at build time (default)
const data = await fetch('https://api.example.com/posts', {
  cache: 'force-cache',
});

// Dynamic — never cached, always fresh
const data = await fetch('https://api.example.com/user', {
  cache: 'no-store',
});

// ISR — revalidate every 60 seconds
const data = await fetch('https://api.example.com/products', {
  next: { revalidate: 60 },
});

// Tag-based revalidation
const data = await fetch('https://api.example.com/posts', {
  next: { tags: ['posts'] },
});
```

## Server Actions — Mutations

```ts
// app/posts/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const schema = z.object({ title: z.string().min(1), content: z.string() });

export async function createPost(formData: FormData) {
  const parsed = schema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
  });
  if (!parsed.success) return { error: parsed.error.flatten() };

  await db.post.create({ data: parsed.data });
  revalidatePath('/posts');
  redirect('/posts');
}
```

```tsx
// app/posts/new/page.tsx — native form action (no JS required)
import { createPost } from '../actions';

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <textarea name="content" />
      <button type="submit">Publish</button>
    </form>
  );
}
```

## Server Actions with useActionState (React 19 / Next.js 15)

```tsx
'use client';
import { useActionState } from 'react';
import { createPost } from './actions';

export function PostForm() {
  const [state, action, isPending] = useActionState(createPost, null);

  return (
    <form action={action}>
      <input name="title" />
      {state?.error && <p role="alert">{state.error.title?.[0]}</p>}
      <button disabled={isPending}>{isPending ? 'Saving…' : 'Publish'}</button>
    </form>
  );
}
```

## Revalidation After Mutations

```ts
'use server';
import { revalidatePath, revalidateTag } from 'next/cache';

// Revalidate a specific page
revalidatePath('/posts');

// Revalidate by tag (more targeted)
revalidateTag('posts');
revalidateTag(`post-${id}`);
```

Always call `revalidatePath` or `revalidateTag` after every mutation — otherwise the page shows stale data.

## TanStack Query — Client-Side Data

Use TanStack Query only in Client Components, for data that must be fresh on the client (e.g. live dashboards, user-specific dynamic data that can't be SSR'd).

```tsx
// app/layout.tsx → providers.tsx
'use client';
const queryClient = new QueryClient();
export function Providers({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Client Component
'use client';
export function LiveFeed() {
  const { data } = useQuery({
    queryKey: ['feed'],
    queryFn: () => fetch('/api/feed').then(r => r.json()),
    refetchInterval: 5000,
  });
  return <FeedList items={data ?? []} />;
}
```

## next/image

```tsx
import Image from 'next/image';

// ✓ always provide width + height (or fill + parent with position:relative)
<Image
  src="/avatar.png"
  alt="User avatar"
  width={48}
  height={48}
  priority   // above-the-fold images — skips lazy loading
/>

// ✗ plain <img> — no optimisation, layout shift
<img src="/avatar.png" alt="User avatar" />
```

## next/font

```ts
// app/layout.tsx
import { Inter, Roboto_Mono } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html className={inter.variable}>{children}</html>;
}
```

`next/font` self-hosts fonts at build time — no runtime requests to Google Fonts.

## Anti-Patterns

- ❌ `useEffect` + `fetch` in Client Components for initial data — use Server Components
- ❌ Mutating data without `revalidatePath` — stale UI after form submit
- ❌ Using TanStack Query where Server Components + Server Actions suffice
- ❌ `<img>` instead of `<Image>` — no optimisation, causes CLS
- ❌ Loading fonts via `<link>` in `_document` — use `next/font` for zero layout shift

## Verification

1. After mutation: check `revalidatePath` flushes the cache
2. `next build` — static pages are pre-rendered, dynamic pages marked correctly
3. Network tab: image responses are WebP/AVIF from `/_next/image`

## References

- [Data Fetching](references/data-fetching.md) — streaming with Suspense, prefetching, SWR comparison
