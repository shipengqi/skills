# Claude Code Skills

Engineering best-practice skills for Claude Code — Go and TypeScript.

Derived from [miniblog](https://github.com/marmotedu/miniblog) (Clean Architecture + Gin + Wire + Zap), the Google TypeScript Style Guide, and Total TypeScript.

## Skills

### Go

| Skill | Description |
|-------|-------------|
| `golang-language` | Naming, interfaces, package layout, anti-patterns |
| `golang-error-handling` | ErrorX sentinel pattern, errno directory, error propagation by layer |
| `golang-logging` | Zap Sugar API, `log.W(ctx)` context propagation, per-layer logging rules |
| `golang-architecture` | Clean Architecture layers (handler→biz→store→model) and Google Wire DI |
| `golang-testing` | Table-driven tests, mockgen, testify assertions, benchmarks |
| `golang-api-server` | Framework-agnostic Server interface, graceful shutdown, unified response |
| `golang-gin` | Gin engine setup, middleware chain, route groups, HandleJSONRequest pattern |
| `golang-echo` | Echo framework patterns — binding, middleware, error handler |
| `golang-fiber` | Fiber/fasthttp patterns — UserContext, BodyParser, concurrency gotchas |
| `golang-nethttp` | net/http + chi router patterns — standard library HTTP server |

### TypeScript

| Skill | Description |
|-------|-------------|
| `typescript-language` | Strict config, type patterns, no-any/enum/!, brand types |
| `typescript-best-practices` | Async/await, Promise.all, error handling at boundaries, Vitest testing |

## Install

### Shell script (no dependencies)

```bash
git clone https://github.com/shipengqi/skills
cd skills

# Install all
bash install.sh

# Install specific skills
bash install.sh golang-gin golang-architecture

# List status
bash install.sh list
```

### npx

```bash
# Install all
npx @shipengqi/claude-skills add --all

# Install specific
npx @shipengqi/claude-skills add golang-gin

# List
npx @shipengqi/claude-skills list

# Remove
npx @shipengqi/claude-skills remove golang-gin
```

### Claude Plugin Marketplace

```bash
claude plugin add https://github.com/shipengqi/skills
```

## How It Works

Each skill is a directory with a `SKILL.md` file that Claude Code loads automatically based on trigger conditions (e.g., presence of `go.mod`). Skills symlink from the repo into `~/.claude/skills/`.

After installing, restart Claude Code to load the new skills.
