---
name: nextjs-app-router
description: Next.js 13+ App Router — app/ directory structure, route groups, layouts, Server vs Client Components, and the "use client" boundary. Use when structuring a Next.js project, deciding component rendering strategy, or setting up loading/error states. Apply whenever user adds "use client" to page.tsx or layout.tsx, asks how to group routes with a shared layout without affecting the URL, or asks how to show loading states in Server Components without useState.
metadata:
  triggers:
    files:
      - 'app/'
      - 'next.config.ts'
      - 'next.config.js'
    keywords:
      - nextjs
      - next.js
      - app router
      - server component
      - client component
      - use client
      - layout
      - loading
---

# Next.js App Router

## Directory Structure

```
app/
├── layout.tsx            # Root layout — HTML shell, global providers
├── page.tsx              # Homepage (/)
├── loading.tsx           # Global Suspense fallback
├── error.tsx             # Global error boundary ("use client")
├── not-found.tsx         # 404 page
├── (marketing)/          # Route group — shared layout, NOT part of URL
│   ├── layout.tsx
│   ├── page.tsx          # /
│   └── about/page.tsx    # /about
├── (dashboard)/
│   ├── layout.tsx        # Auth check + sidebar
│   ├── posts/
│   │   ├── page.tsx      # /posts
│   │   ├── [id]/
│   │   │   └── page.tsx  # /posts/[id]
│   │   └── loading.tsx   # Suspense for /posts
│   └── settings/page.tsx
└── api/
    └── webhooks/
        └── route.ts
```

Route groups `(name)` share a layout without affecting the URL path.

## Server Components — Default

```tsx
// app/(dashboard)/posts/[id]/page.tsx
// No "use client" = Server Component
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;   // Next.js 15: params is now a Promise
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const post = await db.post.findUnique({ where: { id } });
  return { title: post?.title ?? 'Post not found' };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const post = await db.post.findUnique({ where: { id } });
  if (!post) notFound();

  return <PostDetail post={post} />;
}
```

Server Components can: `async/await`, read environment variables, access the database directly, read cookies/headers.
Server Components cannot: `useState`, `useEffect`, browser APIs, event handlers.

## Client Components — "use client"

```tsx
// components/post-actions.tsx
'use client';

import { useState } from 'react';

export function PostActions({ postId }: { postId: string }) {
  const [liked, setLiked] = useState(false);

  return (
    <button onClick={() => setLiked(l => !l)}>
      {liked ? '♥ Liked' : '♡ Like'}
    </button>
  );
}
```

Push the `"use client"` boundary as low as possible — keep layouts, pages, and data-fetching as Server Components. Only mark interactive leaf components as client.

## Root Layout

```tsx
// app/layout.tsx
import { Providers } from '@/components/providers';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

// components/providers.tsx  ← put all client providers here
'use client';
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

Wrap client providers in a dedicated `Providers` component to keep `layout.tsx` as a Server Component.

## Loading and Error States

```tsx
// app/(dashboard)/posts/loading.tsx — automatic Suspense boundary
export default function Loading() {
  return <PostListSkeleton />;
}

// app/(dashboard)/posts/error.tsx — error boundary
'use client';
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <p>Failed to load posts: {error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

## Passing Server Data to Client Components

```tsx
// ✓ fetch in Server Component, pass serializable props down
export default async function Page() {
  const user = await getUser();
  return <UserProfile user={user} />;   // UserProfile can be Server or Client
}

// ✗ don't pass non-serializable values (functions, class instances) as props
// to Client Components — they cross the server/client boundary as JSON
```

## Anti-Patterns

- ❌ Pages Router `getServerSideProps` / `getStaticProps` — use Server Components and `fetch` with cache options
- ❌ `"use client"` on layouts or pages — keeps entire subtree off the server
- ❌ Fetching in Client Components directly — do it in Server Components and pass down
- ❌ Wrapping entire app in `"use client"` providers in `layout.tsx` — extract to `Providers` component
- ❌ Missing `notFound()` guard — returns 200 with empty content on missing data

## Verification

1. `next build` — static analysis + route tree
2. `next dev` — check network tab, server-rendered pages have no JS hydration for static content
3. `notFound()` returns 404 status

## References

- [App Structure](references/app-structure.md) — parallel routes, intercepting routes, metadata API
