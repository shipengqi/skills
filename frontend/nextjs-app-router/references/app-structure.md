# Next.js App Structure — Advanced Patterns

## Parallel Routes

```
app/(dashboard)/
├── layout.tsx
├── page.tsx
├── @analytics/          # Parallel route slot
│   └── page.tsx
└── @notifications/      # Parallel route slot
    └── page.tsx
```

```tsx
// layout.tsx receives slot props
export default function DashboardLayout({
  children,
  analytics,
  notifications,
}: {
  children: React.ReactNode;
  analytics: React.ReactNode;
  notifications: React.ReactNode;
}) {
  return (
    <div>
      <main>{children}</main>
      <aside>{analytics}</aside>
      <aside>{notifications}</aside>
    </div>
  );
}
```

## Intercepting Routes (Modal Pattern)

```
app/(dashboard)/
├── posts/
│   └── [id]/
│       └── page.tsx         # Full post page at /posts/123
└── @modal/
    └── (..)posts/
        └── [id]/
            └── page.tsx     # Modal intercept from same-app navigation
```

Clicking a post link shows it in a modal; navigating directly or refreshing shows the full page.

## Metadata API

```tsx
// Static metadata
export const metadata: Metadata = {
  title: { template: '%s | MyApp', default: 'MyApp' },
  description: 'Engineering best practices',
  openGraph: { images: ['/og.png'] },
};

// Dynamic metadata from params
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await fetchPost(params.id);
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { images: [post.coverImage] },
  };
}
```

## Typed Route Parameters

```tsx
// Next.js 15 — params is a Promise
interface Props {
  params: Promise<{ id: string; slug: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const { page = '1', q } = await searchParams;
  // ...
}
```

## Static Generation with generateStaticParams

```tsx
// Pre-render all post pages at build time
export async function generateStaticParams() {
  const posts = await db.post.findMany({ select: { id: true } });
  return posts.map(p => ({ id: p.id }));
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const post = await db.post.findUnique({ where: { id } });
  if (!post) notFound();
  return <PostDetail post={post} />;
}
```
