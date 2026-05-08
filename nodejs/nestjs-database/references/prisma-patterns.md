# NestJS Prisma Patterns

## Soft Delete

```prisma
// schema.prisma
model User {
  id        String    @id @default(uuid())
  email     String    @unique
  deletedAt DateTime?
}
```

```ts
// Service — filter soft-deleted by default
findAll(): Promise<User[]> {
  return this.prisma.user.findMany({ where: { deletedAt: null } });
}

async softDelete(id: string): Promise<void> {
  await this.prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
```

## Audit Log

```ts
async update(id: string, dto: UpdateUserDto, actorId: string): Promise<User> {
  return this.prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id }, data: dto });
    await tx.auditLog.create({
      data: { entityId: id, entityType: 'User', action: 'UPDATE', actorId, after: dto },
    });
    return user;
  });
}
```

## Upsert

```ts
// Create or update based on unique constraint
const user = await this.prisma.user.upsert({
  where: { email: dto.email },
  update: { name: dto.name, updatedAt: new Date() },
  create: { email: dto.email, name: dto.name, password: await hash(dto.password) },
});
```

## Full-Text Search (PostgreSQL)

```ts
const posts = await this.prisma.post.findMany({
  where: {
    OR: [
      { title:   { contains: query, mode: 'insensitive' } },
      { content: { contains: query, mode: 'insensitive' } },
    ],
  },
});
```

## Bulk Operations

```ts
// Create many
await this.prisma.tag.createMany({
  data: tags.map(name => ({ name, slug: slugify(name) })),
  skipDuplicates: true,
});

// Update many
await this.prisma.post.updateMany({
  where: { authorId: userId, publishedAt: null },
  data: { publishedAt: new Date() },
});

// Delete by filter
await this.prisma.session.deleteMany({
  where: { expiresAt: { lt: new Date() } },
});
```

## Connection Pooling (PgBouncer / Prisma Accelerate)

```ts
// In PrismaService — for serverless environments
@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    super({
      datasources: {
        db: { url: process.env.DATABASE_URL + '?pgbouncer=true&connection_limit=1' },
      },
    });
  }
}
```
