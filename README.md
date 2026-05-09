# Claude Code Skills

Engineering best-practice skills for Claude Code — Go, TypeScript, Python, React, Angular, Next.js, NestJS, and Database (Redis, PostgreSQL).

## Skills

### Go

| Skill | Description |
|-------|-------------|
| `golang-language` | Naming, interfaces, package layout, anti-patterns |
| `golang-error-handling` | ErrorX sentinel pattern, errno directory, error propagation by layer |
| `golang-logging` | Zap Sugar API, `log.W(ctx)` context propagation, per-layer logging rules |
| `golang-architecture` | Clean Architecture layers (handler→biz→store→model) and Google Wire DI |
| `golang-testing` | Ginkgo BDD suites, Gomega matchers, uber-go/mock, DescribeTable, benchmarks |
| `golang-api-server` | Framework-agnostic Server interface, graceful shutdown, unified response |
| `golang-gin` | Gin engine setup, middleware chain, route groups, HandleJSONRequest pattern |
| `golang-echo` | Echo framework patterns — binding, middleware, error handler |
| `golang-fiber` | Fiber/fasthttp patterns — UserContext, BodyParser, concurrency gotchas |
| `golang-nethttp` | net/http + chi router patterns — standard library HTTP server |
| `golang-makefile` | Layered include structure, version injection from git, tools auto-install, `##@` help |
| `golang-app` | cobra command setup, pflag options, viper config loading, Options→Config pipeline |
| `golang-database` | GORM setup, connection pool, IStore interface, context-based TX propagation, concrete store |

### TypeScript

| Skill | Description |
|-------|-------------|
| `typescript-language` | Strict config, type patterns, no-any/enum/!, brand types |
| `typescript-best-practices` | Async/await, Promise.all, error handling at boundaries, DI patterns |
| `typescript-tooling` | ESLint flat config, Prettier, tsup bundling, tsc in CI, pre-commit hooks |
| `typescript-security` | Input validation (Zod), XSS/injection prevention, auth principles, CORS |

### Python

| Skill | Description |
|-------|-------------|
| `python-language` | uv + ruff + pyright toolchain, naming, type hints, StrEnum, anti-patterns |
| `python-architecture` | Layered architecture, SQLAlchemy 2.x async, FastAPI Depends() DI, Alembic |
| `python-error-handling` | AppError hierarchy, global exception handlers, propagation by layer |
| `python-logging` | loguru setup, context binding with contextualize(), per-layer logging rules |
| `python-testing` | pytest, parametrize, fixtures, AsyncMock, respx, asyncio_mode=auto |
| `python-async` | async/sync choice, asyncio.gather vs TaskGroup, blocking traps, to_thread |
| `python-fastapi` | lifespan, routers, Pydantic schemas, Depends() chains, middleware |
| `python-data` | Pandas ETL patterns, iterrows anti-pattern, chunked processing, Polars |
| `python-cli` | Typer app, Argument vs Option, subcommands, StrEnum choices, progress bar |

### React (frontend)

| Skill | Description |
|-------|-------------|
| `react-language` | JSX, hooks rules, derived state, useCallback/useMemo, Suspense, Error Boundary |
| `react-patterns` | Feature-based structure (bulletproof-react), custom hooks, compound components |
| `react-forms` | react-hook-form + Zod validation, Controller, server errors, FormArray |
| `react-state` | Zustand for client state, TanStack Query for server state, query keys |
| `react-testing` | Vitest + React Testing Library + MSW, userEvent, async queries |
| `cypress-e2e` | E2E testing — data-cy selectors, Custom Commands, cy.intercept, fixtures |

### Angular (frontend)

| Skill | Description |
|-------|-------------|
| `angular-language` | Standalone components, Signals, @if/@for control flow, inject() function |
| `angular-services` | DI, HttpClient, functional interceptors, functional route guards |
| `angular-forms` | Typed Reactive Forms, nonNullable group, FormArray, Signal integration |
| `angular-testing` | Jest + TestBed, ComponentFixture, setInput(), HttpTestingController |

### Next.js (frontend)

| Skill | Description |
|-------|-------------|
| `nextjs-app-router` | app/ structure, route groups, layouts, Server vs Client Components |
| `nextjs-data` | Server Actions, fetch caching, revalidatePath, TanStack Query, next/image |
| `nextjs-api` | Route Handlers, middleware, Auth.js, environment variable conventions |

### NestJS (nodejs)

| Skill | Description |
|-------|-------------|
| `nestjs-architecture` | Module system, controllers, providers, DI, project structure |
| `nestjs-guards` | Guards, Interceptors, ValidationPipe (class-validator), Exception Filters |
| `nestjs-testing` | Test.createTestingModule(), mock providers, supertest E2E |
| `nestjs-database` | Prisma integration, repository pattern, transactions, migrations |

### Database

| Skill | Description |
|-------|-------------|
| `database-redis` | Redis key design, caching patterns, data structures, distributed lock, rate limiter |
| `database-postgres` | Schema design, indexing, transactions, zero-downtime migrations (Expand-Contract) |

## Install

### Shell script (no dependencies)

```bash
git clone https://github.com/shipengqi/skills
cd skills

# Install all
bash install.sh

# Install specific skills
bash install.sh react-language react-state nestjs-architecture

# List status
bash install.sh list
```

### npx

```bash
# Install all
npx @shipengqi/claude-skills add --all

# Install specific
npx @shipengqi/claude-skills add react-language

# List
npx @shipengqi/claude-skills list

# Remove
npx @shipengqi/claude-skills remove react-language
```

### Claude Plugin Marketplace

```bash
claude plugin add https://github.com/shipengqi/skills
```

## Benchmark

```bash
npm run benchmark
```

Generates `benchmarks/benchmark-report.md` with token counts, cost estimates per model, and quality scores for all skills.

## How It Works

Each skill is a directory with a `SKILL.md` file that Claude Code loads automatically based on trigger conditions (e.g., presence of `go.mod`, `*.tsx` files). Skills symlink from the repo into `~/.claude/skills/`.

After installing, restart Claude Code to load the new skills.
