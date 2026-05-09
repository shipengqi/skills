---
name: nestjs-database
description: NestJS + Prisma — PrismaService setup, repository pattern, transactions, relations, pagination, and migrations. Use when integrating Prisma, designing the data layer, or writing database queries. Apply whenever user queries Prisma without explicit select causing sensitive fields to leak, queries related data in loops causing N+1 problems, uses prisma migrate dev in production CI/CD instead of migrate deploy, or asks how to make multiple Prisma writes atomic with automatic rollback.
metadata:
  triggers:
    files:
      - 'prisma/schema.prisma'
      - '*.service.ts'
      - 'prisma/'
    keywords:
      - nestjs
      - prisma
      - database
      - prisma service
      - transaction
      - migration
      - repository
      - findMany
---

# NestJS Database (Prisma)

## PrismaService

```ts
// prisma/prisma.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
}

// prisma/prisma.module.ts
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

## CRUD Queries

```ts
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ✓ select only needed fields — never select password by default
  findAll(filter?: { role?: Role }): Promise<SafeUser[]> {
    return this.prisma.user.findMany({
      where: filter?.role ? { role: filter.role } : undefined,
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(dto: CreateUserDto): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: { ...dto, password: hashed },
      select: { id: true, email: true, name: true, role: true },
    });
  }

  async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    await this.findOne(id);  // throws 404 if not found
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: { id: true, email: true, name: true, role: true },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
  }
}
```

## Relations

```ts
// Include related data
const post = await this.prisma.post.findUnique({
  where: { id },
  include: {
    author: { select: { id: true, name: true } },
    tags: true,
    _count: { select: { comments: true } },
  },
});

// ✗ avoid N+1 — don't query inside a loop
for (const post of posts) {
  post.author = await this.prisma.user.findUnique({ where: { id: post.authorId } });
}

// ✓ use include or join at query time
const posts = await this.prisma.post.findMany({ include: { author: true } });
```

## Transactions

```ts
// Sequential transaction (atomic, auto-rollback on error)
const [debit, credit] = await this.prisma.$transaction([
  this.prisma.account.update({ where: { id: fromId }, data: { balance: { decrement: amount } } }),
  this.prisma.account.update({ where: { id: toId },   data: { balance: { increment: amount } } }),
]);

// Interactive transaction (for conditional logic)
await this.prisma.$transaction(async (tx) => {
  const account = await tx.account.findUnique({ where: { id: fromId } });
  if (!account || account.balance < amount) throw new BadRequestException('Insufficient balance');
  await tx.account.update({ where: { id: fromId }, data: { balance: { decrement: amount } } });
  await tx.account.update({ where: { id: toId },   data: { balance: { increment: amount } } });
});
```

## Pagination

```ts
// Offset pagination
async paginate(page: number, limit = 20): Promise<PageResult<SafeUser>> {
  const [data, total] = await this.prisma.$transaction([
    this.prisma.user.findMany({ skip: (page - 1) * limit, take: limit }),
    this.prisma.user.count(),
  ]);
  return { data, total, page, pageCount: Math.ceil(total / limit) };
}

// Cursor pagination (better for large datasets)
async listAfter(cursor?: string, limit = 20): Promise<SafeUser[]> {
  return this.prisma.user.findMany({
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { id: 'asc' },
  });
}
```

## Migrations

```bash
npx prisma migrate dev --name add_user_role    # create + apply in dev
npx prisma migrate deploy                       # apply in production (CI/CD)
npx prisma migrate reset                        # reset dev database
npx prisma db seed                              # run seed script
npx prisma generate                             # regenerate client after schema change
```

Always commit `prisma/migrations/` to git. Never edit migration files after they are applied.

## Anti-Patterns

- ❌ Selecting `password` in default queries — always use explicit `select`
- ❌ Direct Prisma calls in controllers — always go through services
- ❌ N+1 queries in loops — use `include` or batch with `findMany` + `where: { id: { in: ids } }`
- ❌ Not using transactions for multi-step writes — partial failures leave inconsistent state
- ❌ `prisma migrate reset` in production — destructive, use `migrate deploy`

## Verification

1. `npx prisma migrate dev` — schema changes applied cleanly
2. `npx prisma studio` — inspect data visually
3. Unit tests with mocked PrismaService confirm service logic

## References

- [Prisma Patterns](references/prisma-patterns.md) — soft delete, audit log, full-text search, upsert patterns
