---
name: golang-logging
description: Go structured logging using Zap Sugar API with context propagation. Use when initializing loggers, writing log statements, extracting request context into logs, or configuring log output in Go projects.
metadata:
  triggers:
    files:
      - 'go.mod'
    keywords:
      - zap
      - log.W
      - log.Infow
      - log.Errorw
      - structured logging
---

# Go Logging

## API — Zap Sugar (key-value pairs)

```go
// Package-level functions — use when no request context is available
log.Debugw("Starting server", "addr", cfg.Addr, "mode", cfg.ServerMode)
log.Infow("Server started", "addr", ":8080")
log.Warnw("Config missing", "key", "timeout", "default", 30)
log.Errorw("Failed to connect", "err", err, "host", host)

// With request context — use inside handlers, biz, store
log.W(ctx).Infow("Healthz handler called", "method", "Healthz", "status", "healthy")
log.W(ctx).Errorw("Failed to compare password", "err", err)
log.W(ctx).Debugw("Got users from storage", "count", len(users))
```

`log.W(ctx)` automatically extracts `X-Request-ID` and `X-User-ID` from context and adds them to every log line — do not add these fields manually.

## Key-Value Conventions

```go
// ✓ error field: string key "err"
log.W(ctx).Errorw("Failed to sign token", "err", err)

// ✓ domain fields: lowercase snake_case keys
log.W(ctx).Errorw("Failed to add role", "user", userID, "role", roleName)

// ✗ don't use zap typed fields (zap.String, zap.Error) — breaks Sugar API
log.W(ctx).Errorw("msg", zap.Error(err))       // ✗
log.W(ctx).Errorw("msg", zap.String("k", v))   // ✗

// ✗ don't format into the message string
log.W(ctx).Errorw(fmt.Sprintf("Failed for user %s", uid))  // ✗ use KV instead
log.W(ctx).Errorw("Failed for user", "user", uid)           // ✓
```

## When to Log

| Layer | Log? | What |
|-------|------|------|
| handler | No | `core.HandleJSONRequest` handles it |
| biz | Yes — on internal failures | raw technical error + context fields |
| biz | No — on user errors | just `return errno.ErrXxx` |
| store | No | just return `errno.ErrDBRead.WithMessage(err.Error())` |
| server init | Yes | startup/shutdown events, config values |

```go
// biz: log raw err, return sanitized errno
if err := authn.Compare(hash, password); err != nil {
    log.W(ctx).Errorw("Failed to compare password", "err", err)
    return nil, errno.ErrPasswordInvalid
}

// server init: no ctx, use package-level
log.Infow("Initializing DB", "type", "mysql", "addr", cfg.MySQLOptions.Addr)
```

## Initialization

Call `log.Init()` once in `cmd/<app>/app/server.go`, before any other code:

```go
func run(opts *options.ServerOptions) error {
    log.Init(logOptions())
    defer log.Sync()  // flush on exit
    // ...
}

func logOptions() *log.Options {
    opts := log.NewOptions()
    if viper.IsSet("log.level") {
        opts.Level = viper.GetString("log.level")
    }
    if viper.IsSet("log.format") {
        opts.Format = viper.GetString("log.format")
    }
    if viper.IsSet("log.output-paths") {
        opts.OutputPaths = viper.GetStringSlice("log.output-paths")
    }
    return opts
}
```

## YAML Configuration

```yaml
log:
  disable-caller: false
  disable-stacktrace: false
  level: info            # debug | info | warn | error
  format: json           # json | console
  output-paths:
    - stdout
```

## Options Struct

```go
&log.Options{
    Level:             "info",     // default
    Format:            "console",  // default
    DisableCaller:     false,      // show file:line in every log entry
    DisableStacktrace: false,      // print stack on panic+
    OutputPaths:       []string{"stdout"},
}
```

## Anti-Patterns

- ❌ `fmt.Sprintf` in message: use key-value pairs instead
- ❌ `zap.String()/zap.Error()` typed fields with Sugar API
- ❌ Logging in store layer — just return errno
- ❌ Logging in handler layer — `core.HandleJSONRequest` handles it
- ❌ Log + `return err` (raw error) — log raw, return errno sentinel
- ❌ `log.Init()` inside a package `init()` — call only from `cmd/` startup

## References

- [Zap Sugar Patterns](references/zap-sugar-patterns.md) — Logger interface, W(ctx) internals, TestMain setup
