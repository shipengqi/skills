---
name: nextjs-api
description: Next.js Route Handlers, middleware, Auth.js integration, and environment variable conventions. Use when building API endpoints, adding authentication, or configuring request middleware.
metadata:
  triggers:
    files:
      - 'app/api/'
      - 'middleware.ts'
      - '.env.local'
    keywords:
      - nextjs
      - route handler
      - middleware
      - auth.js
      - next-auth
      - NextRequest
      - NextResponse
      - environment variables
---

# Next.js API

## Route Handlers

```ts
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') ?? 1);

  const users = await db.user.findMany({
    skip: (page - 1) * 20,
    take: 20,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(users);
}

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(parsed.error.flatten(), { status: 422 });
  }

  const user = await db.user.create({ data: parsed.data });
  return NextResponse.json(user, { status: 201 });
}
```

## Dynamic Route Handlers

```ts
// app/api/users/[id]/route.ts
interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Context) {
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(user);
}

export async function DELETE(req: NextRequest, { params }: Context) {
  const { id } = await params;
  await db.user.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
```

## Middleware

```ts
// middleware.ts (project root — not inside app/)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/((?!auth).)*',   // all /api/* except /api/auth
  ],
};
```

Middleware runs at the Edge — keep it lightweight. No database calls, no heavy computation.

## Auth.js (next-auth v5) Integration

```ts
// auth.ts
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GitHub],
  callbacks: {
    session: ({ session, token }) => ({
      ...session,
      user: { ...session.user, id: token.sub! },
    }),
  },
});

// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
```

```tsx
// Server Component — read session
import { auth } from '@/auth';

export default async function Page() {
  const session = await auth();
  if (!session) redirect('/login');
  return <Dashboard user={session.user} />;
}
```

## Environment Variables

```bash
# .env.local
DATABASE_URL="postgresql://..."      # server-only (never exposed to browser)
NEXTAUTH_SECRET="..."                # server-only
NEXT_PUBLIC_API_URL="https://..."   # exposed to browser — prefix with NEXT_PUBLIC_
```

```ts
// ✓ typed env with zod (e.g. @t3-oss/env-nextjs)
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NEXTAUTH_SECRET: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  runtimeEnv: process.env,
});
```

## Error Response Helpers

```ts
// lib/api.ts — consistent error shape
export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function withAuth(
  handler: (req: NextRequest, session: Session, ctx: unknown) => Promise<NextResponse>
) {
  return async (req: NextRequest, ctx: unknown) => {
    const session = await auth();
    if (!session) return apiError('Unauthorized', 401);
    return handler(req, session, ctx);
  };
}

// Usage
export const GET = withAuth(async (req, session) => {
  return NextResponse.json({ userId: session.user.id });
});
```

## Anti-Patterns

- ❌ Accessing `process.env.SECRET` in Client Components — server-only vars are undefined client-side
- ❌ Database calls inside middleware — middleware runs at Edge, use lightweight checks only
- ❌ Missing Zod validation in Route Handlers — always parse request body before use
- ❌ Returning `Response` instead of `NextResponse` — loses Next.js-specific features
- ❌ Hardcoding secrets in source — use `.env.local`, never commit to git

## Verification

1. `NEXT_PUBLIC_` vars available in browser console; non-prefixed vars are `undefined`
2. Unauthenticated request to protected route returns 401 or redirects
3. `next build` — type errors in route handlers surface at build time

## References

- [Route Handlers](references/route-handlers.md) — streaming responses, CORS, rate limiting, webhook verification
