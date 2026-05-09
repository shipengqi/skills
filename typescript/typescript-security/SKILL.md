---
name: typescript-security
description: Code-layer security for TypeScript — input validation, XSS/injection prevention, authentication principles, CORS, and secrets hygiene. Use when validating user input, handling auth tokens, sanitizing HTML, managing secrets, or defending against injection attacks. Apply whenever user writes localStorage.setItem, execSync, execFileSync, Zod safeParse, or asks about JWT storage, password hashing (Argon2id vs bcrypt), command injection, or SSRF prevention in TypeScript.
metadata:
  triggers:
    files:
      - '**/*.ts'
      - '**/*.tsx'
    keywords:
      - validate
      - sanitize
      - xss
      - injection
      - auth
      - password
      - secret
      - token
      - cors
---

# TypeScript Security

## Input Validation at Boundaries (Zod)

```ts
const Schema = z.object({ email: z.string().email(), name: z.string().min(1).max(100).trim() });

const result = Schema.safeParse(req.body);
if (!result.success) return res.status(400).json({ errors: result.error.flatten().fieldErrors });
// result.data is fully typed from here
```

Use `.safeParse()` at API boundaries — `.parse()` throws uncaught exceptions in handlers.

## Prevent XSS (Browser)

```ts
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userHtml);  // ✓
element.innerHTML = userHtml;                        // ✗ XSS
element.textContent = userText;                      // ✓ prefer textContent
```

In React: avoid `dangerouslySetInnerHTML`; if required, wrap with `DOMPurify.sanitize` first.

## Prevent Injection

```ts
// SQL — parameterized queries
await pool.query('SELECT * FROM users WHERE id = $1', [userId]);           // ✓
await prisma.$queryRaw(Prisma.sql`SELECT * FROM users WHERE id = ${id}`);  // ✓
await pool.query(`SELECT * FROM users WHERE id = '${userId}'`);            // ✗

// Command — separate args array, never shell interpolation
execFileSync('git', ['clone', repoUrl]);  // ✓
execSync(`git clone ${repoUrl}`);         // ✗
```

## Prevent SSRF

```ts
const ALLOWED = new Set(['https://api.trusted.com']);
const { origin } = new URL(externalUrl);
if (!ALLOWED.has(origin)) throw new Error('Disallowed origin');
await fetch(externalUrl);
```

Validate URL origin against an allowlist before any outbound `fetch()` or `axios`.

## Authentication Principles

```ts
res.cookie('access_token', token, { httpOnly: true, secure: true, sameSite: 'strict', maxAge: 900_000 });
```

- **RS256** JWTs + **refresh token rotation** (invalidate old token on each use)
- **Argon2id** for password hashing — not bcrypt, not MD5/SHA1
- Never store tokens in `localStorage` — accessible to XSS; use HttpOnly cookie

## CORS and Security Headers

```ts
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [], credentials: true }));
```
Never use `origin: '*'` with `credentials: true`. Validate `JWT_SECRET` at startup; throw if missing.

## Anti-Patterns

- ❌ `eval()`, `new Function(str)` — execute runtime code, bypass type system
- ❌ `` execSync(`cmd ${input}`) `` — command injection via shell metacharacters
- ❌ JWT in `localStorage` — use HttpOnly cookie
- ❌ `origin: '*'` in CORS — use explicit origin allowlist
- ❌ MD5/SHA1 for passwords — use Argon2id
- ❌ `process.env.SECRET!` non-null assertion — validate and throw at startup

## References

- [Security Patterns](references/security-patterns.md) — Zod schemas, helmet config, Argon2id, RBAC
