---
name: golang-api-server
description: Framework-agnostic Go API server patterns — graceful shutdown, server interface, unified response, health endpoints. Use when building an HTTP or gRPC server, wiring startup/shutdown, or designing the server lifecycle in Go projects.
metadata:
  triggers:
    files:
      - 'go.mod'
    keywords:
      - graceful shutdown
      - SIGTERM
      - server interface
      - RunOrDie
      - GracefulStop
      - health endpoint
      - WriteResponse
---

# Go API Server

## Server Interface

Every server type (HTTP, gRPC, reverse proxy) implements one interface:

```go
// internal/pkg/server/server.go
type Server interface {
    RunOrDie()                    // start; Fatalw on unrecoverable error
    GracefulStop(ctx context.Context)  // drain connections, respect ctx deadline
}
```

Each concrete server wraps the stdlib `*http.Server` or gRPC server and delegates:

```go
type HTTPServer struct { srv *http.Server }

func (s *HTTPServer) RunOrDie() {
    log.Infow("Start listening", "protocol", "http", "addr", s.srv.Addr)
    if err := s.srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
        log.Fatalw("Failed to serve HTTP server", "err", err)
    }
}

func (s *HTTPServer) GracefulStop(ctx context.Context) {
    log.Infow("Gracefully stop HTTP server")
    if err := s.srv.Shutdown(ctx); err != nil {
        log.Errorw("HTTP server forced to shutdown", "err", err)
    }
}
```

## Graceful Shutdown

Signal handling lives in `Run()` on the top-level server struct, not in `main`:

```go
func (s *UnionServer) Run() error {
    go s.srv.RunOrDie()

    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    log.Infow("Shutting down server ...")

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    s.srv.GracefulStop(ctx)

    log.Infow("Server exited")
    return nil
}
```

- Capture `SIGINT` (Ctrl+C) and `SIGTERM` (kill / k8s pod stop)
- 10-second shutdown timeout — adjust based on max expected request duration
- Log at both ends of shutdown for ops visibility

## Unified Response

All endpoints write responses through a single helper — never `c.JSON` directly:

```go
// success
core.WriteResponse(c, nil, data)

// error
core.WriteResponse(c, errno.ErrUserNotFound, nil)

// 404 catch-all
engine.NoRoute(func(c *gin.Context) {
    core.WriteResponse(c, errno.ErrPageNotFound, nil)
})
```

`core.HandleJSONRequest` / `core.HandleUriRequest` / `core.HandleQueryRequest` call `WriteResponse` internally — use them in handlers so no manual response writing is needed.

## Health Endpoints

Every server exposes at minimum `/healthz`:

```go
engine.GET("/healthz", handler.Healthz)

// handler
func (h *Handler) Healthz(c *gin.Context) {
    log.W(c.Request.Context()).Infow("Healthz handler called", "method", "Healthz", "status", "healthy")
    core.WriteResponse(c, nil, map[string]string{"status": "ok"})
}
```

For Kubernetes: add `/readyz` that checks DB connectivity before returning 200.

## Config Struct Pattern

Put server config in `internal/<app>/` — not in handler or cmd:

```go
// internal/apiserver/server.go
type Config struct {
    ServerMode   string
    JWTKey       string
    Expiration   time.Duration
    HTTPOptions  *genericoptions.HTTPOptions
    MySQLOptions *genericoptions.MySQLOptions
    TLSOptions   *genericoptions.TLSOptions
}

// ServerConfig holds wired dependencies (from Wire)
type ServerConfig struct {
    cfg   *Config
    biz   biz.IBiz
    val   *validation.Validator
    authz *authz.Authz
}
```

`Config` = raw options (from viper/flags). `ServerConfig` = live dependencies (from Wire).

## Startup Sequence

```go
// cmd/<app>/app/server.go
func run(opts *options.ServerOptions) error {
    log.Init(logOptions())   // 1. logging first
    defer log.Sync()

    // 2. unmarshal config
    if err := viper.Unmarshal(opts); err != nil { ... }

    // 3. build Config
    cfg := buildConfig(opts)

    // 4. wire dependencies + start server
    srv, err := cfg.NewUnionServer()
    if err != nil { return err }

    return srv.Run()         // 5. blocks until signal
}
```

## Anti-Patterns

- ❌ Signal handling in `main()` — put it in `Run()` on the server struct
- ❌ `c.JSON(200, ...)` in handlers — use `core.WriteResponse`
- ❌ No shutdown timeout — always `context.WithTimeout` in `GracefulStop`
- ❌ Panic on startup errors (except `Fatalw`) — use proper error return up to `main`
- ❌ Health check always returns 200 — check real dependencies in `/readyz`

## References

- [Graceful Shutdown](references/graceful-shutdown.md) — SIGTERM flow, multi-server shutdown, k8s probe setup
