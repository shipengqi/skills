# Next.js Data Fetching — Advanced Patterns

## Streaming with Suspense

```tsx
// app/posts/page.tsx — stream multiple data sources independently
export default async function PostsPage() {
  return (
    <div>
      <h1>Posts</h1>
      <Suspense fallback={<FeaturedPostSkeleton />}>
        <FeaturedPost />       {/* resolves independently */}
      </Suspense>
      <Suspense fallback={<PostListSkeleton />}>
        <PostList />           {/* resolves independently */}
      </Suspense>
    </div>
  );
}

// Each async component fetches its own data
async function FeaturedPost() {
  const post = await getFeaturedPost();  // may be slow
  return <PostCard post={post} />;
}
```

## Parallel Data Fetching in Server Components

```tsx
// ✗ sequential — total time = a + b
const user = await getUser(id);
const posts = await getUserPosts(id);

// ✓ parallel — total time = max(a, b)
const [user, posts] = await Promise.all([
  getUser(id),
  getUserPosts(id),
]);
```

## Server Action with Zod + Return State

```ts
'use server';

export type ActionState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function createPost(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = createPostSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await db.post.create({ data: { ...parsed.data, authorId: await getSessionUserId() } });
    revalidatePath('/posts');
    return { success: true };
  } catch {
    return { error: 'Failed to create post. Try again.' };
  }
}
```

## SWR vs TanStack Query Decision

| Criterion | SWR | TanStack Query |
|---|---|---|
| Bundle size | Smaller (~4KB) | Larger (~12KB) |
| Mutations | Manual | Built-in `useMutation` |
| Devtools | No | Yes |
| Infinite queries | Basic | Rich API |
| Recommendation | Simple projects | Feature-rich apps |

## Request Memoization

Next.js automatically deduplicates `fetch()` calls with the same URL within a single render. For ORM calls (Prisma), use React's `cache()`:

```ts
import { cache } from 'react';

export const getUser = cache(async (id: string): Promise<User | null> => {
  return db.user.findUnique({ where: { id } });
});

// Now getUser('1') called in layout.tsx and page.tsx only hits the DB once per request
```
