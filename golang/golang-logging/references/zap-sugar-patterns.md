# Zap Sugar Patterns Reference

## Logger Interface

```go
type Logger interface {
    Debugw(msg string, kvs ...any)
    Infow(msg string, kvs ...any)
    Warnw(msg string, kvs ...any)
    Errorw(msg string, kvs ...any)
    Panicw(msg string, kvs ...any)
    Fatalw(msg string, kvs ...any)
    Sync()
}
```

Constructors return `Logger` (interface), not `*zapLogger` (concrete type).

## W(ctx) Internals

```go
// log.W(ctx) clones the logger and attaches context fields
func (l *zapLogger) W(ctx context.Context) Logger {
    lc := l.clone()
    contextExtractors := map[string]func(context.Context) string{
        known.XRequestID: contextx.RequestID,  // "X-Request-ID"
        known.XUserID:    contextx.UserID,     // "X-User-ID"
    }
    for fieldName, extractor := range contextExtractors {
        if val := extractor(ctx); val != "" {
            lc.z = lc.z.With(zap.String(fieldName, val))
        }
    }
    return lc
}
```

Fields only appear in the log line when non-empty — no noise for unauthenticated requests.

## Full Initialization Example

```go
// cmd/mb-apiserver/app/server.go
package app

import (
    "github.com/spf13/viper"
    "github.com/myproject/internal/pkg/log"
)

func run(opts *options.ServerOptions) error {
    log.Init(logOptions())
    defer log.Sync()

    log.Infow("Starting server", "mode", opts.ServerMode)
    // ...
}

func logOptions() *log.Options {
    opts := log.NewOptions()
    for _, key := range []string{"level", "format", "disable-caller", "disable-stacktrace"} {
        if !viper.IsSet("log." + key) {
            continue
        }
        switch key {
        case "level":
            opts.Level = viper.GetString("log.level")
        case "format":
            opts.Format = viper.GetString("log.format")
        case "disable-caller":
            opts.DisableCaller = viper.GetBool("log.disable-caller")
        case "disable-stacktrace":
            opts.DisableStacktrace = viper.GetBool("log.disable-stacktrace")
        }
    }
    if viper.IsSet("log.output-paths") {
        opts.OutputPaths = viper.GetStringSlice("log.output-paths")
    }
    return opts
}
```

## Test Setup with TestMain

```go
// TestMain initializes the logger for all tests in the package
func TestMain(m *testing.M) {
    log.Init(&log.Options{
        Level:             "debug",
        Format:            "console",
        DisableCaller:     true,
        DisableStacktrace: true,
        OutputPaths:       []string{"stdout"},
    })
    os.Exit(m.Run())
}
```

## Biz Layer Logging Pattern

```go
// Internal technical failure — log raw error, return sanitized errno
tokenStr, _, err := token.Sign(userM.UserID)
if err != nil {
    log.W(ctx).Errorw("Failed to sign token", "err", err, "userID", userM.UserID)
    return nil, errno.ErrSignToken
}

// Multiple context fields
if _, err := authz.AddGroupingPolicy(userM.UserID, known.RoleUser); err != nil {
    log.W(ctx).Errorw("Failed to add grouping policy for user",
        "user", userM.UserID,
        "role", known.RoleUser,
    )
    return nil, errno.ErrAddRole.WithMessage(err.Error())
}

// Debug log (no error — informational)
log.W(ctx).Debugw("Got users from storage", "count", len(users))
```

## Server Lifecycle Logging

```go
// server.go — package-level log (no ctx at init time)
log.Infow("Initializing federation server",
    "server-mode", cfg.ServerMode,
    "enable-memory-store", cfg.EnableMemoryStore,
)

// graceful shutdown
log.Infow("Shutting down server ...")
// ... cleanup ...
log.Infow("Server exited")
```

## EncoderConfig Defaults (miniblog style)

```go
encoderConfig.MessageKey = "message"   // not "msg"
encoderConfig.TimeKey    = "timestamp" // not "ts"
encoderConfig.EncodeTime = func(t time.Time, enc zapcore.PrimitiveArrayEncoder) {
    enc.AppendString(t.Format("2006-01-02 15:04:05.000"))
}
```

JSON output example:
```json
{"level":"info","timestamp":"2024-01-15 10:30:45.123","caller":"server.go:42","message":"Server started","addr":":8080","X-Request-ID":"req-abc123","X-User-ID":"user-456"}
```
