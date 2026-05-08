# TypeScript Security Reference

## Zod Validation Schemas

```ts
import { z } from 'zod';

// User registration
const RegisterSchema = z.object({
  email:    z.string().email(),
  name:     z.string().min(1).max(100).trim(),
  password: z.string().min(12).max(128),
  role:     z.enum(['user', 'admin']).default('user'),
});
type RegisterInput = z.infer<typeof RegisterSchema>;

// Nested schema with transform
const PaginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Reuse schemas across routes
const UpdateUserSchema = RegisterSchema.partial().omit({ password: true });
```

## Helmet + CORS Setup

```ts
import helmet from 'helmet';
import cors from 'cors';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
```

## Argon2id Password Hashing

```ts
import argon2 from 'argon2';

// Hash on registration
const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 65536,   // 64 MiB
  timeCost: 3,
  parallelism: 1,
});

// Verify on login
const valid = await argon2.verify(storedHash, providedPassword);
if (!valid) throw new UnauthorizedError('Invalid credentials');
```

## Role-Based Access Control

```ts
type Permission = 'read' | 'write' | 'delete';
type Role = 'admin' | 'user' | 'guest';

const rolePermissions: Record<Role, Permission[]> = {
  admin: ['read', 'write', 'delete'],
  user:  ['read', 'write'],
  guest: ['read'],
};

function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.role as Role | undefined;
    if (!role || !rolePermissions[role].includes(permission)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```

## Environment Variable Validation (Startup)

```ts
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    JWT_SECRET:       z.string().min(32),
    DATABASE_URL:     z.string().url(),
    ALLOWED_ORIGINS:  z.string(),
    NODE_ENV:         z.enum(['development', 'test', 'production']),
  },
  runtimeEnv: process.env,
});
// Throws at startup if any required variable is missing or invalid
```
