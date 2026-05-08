# Graceful Shutdown Reference

## Full Shutdown Flow

```
SIGTERM/SIGINT received
    │
    ▼
signal.Notify fires → quit channel unblocked
    │
    ▼
log "Shutting down server ..."
    │
    ▼
context.WithTimeout(background, 10s)
    │
    ▼
srv.GracefulStop(ctx)
    ├── HTTP: http.Server.Shutdown(ctx)  — drains in-flight requests
    └── gRPC: grpcServer.GracefulStop() — waits for RPCs to finish
    │
    ▼
log "Server exited"
return nil
```

## Multi-Server Shutdown (gRPC + HTTP Proxy)

When running gRPC + gateway, stop HTTP proxy first, then gRPC:

```go
func (s *grpcGatewayServer) GracefulStop(ctx context.Context) {
    // 1. stop HTTP reverse proxy (stops accepting new requests)
    log.Infow("Gracefully stop HTTP reverse proxy server")
    if err := s.proxySrv.Shutdown(ctx); err != nil {
        log.Errorw("HTTP reverse proxy forced to shutdown", "err", err)
    }

    // 2. stop gRPC after proxy is drained
    log.Infow("Gracefully stop gRPC server")
    s.grpcSrv.GracefulStop()
}
```

Rule: stop dependents before dependencies.

## Kubernetes Pod Lifecycle

```yaml
# deployment.yaml
containers:
  - name: app
    lifecycle:
      preStop:
        exec:
          command: ["/bin/sh", "-c", "sleep 5"]  # let k8s route drain
    readinessProbe:
      httpGet:
        path: /readyz
        port: 8080
      initialDelaySeconds: 5
      periodSeconds: 10
    livenessProbe:
      httpGet:
        path: /healthz
        port: 8080
      initialDelaySeconds: 10
      periodSeconds: 30
```

The `preStop` sleep gives the load balancer time to remove the pod from rotation before `SIGTERM` fires.

## /healthz vs /readyz

```go
// /healthz — is the process alive? (liveness)
// Always returns 200 as long as the process is running
func (h *Handler) Healthz(c *gin.Context) {
    core.WriteResponse(c, nil, map[string]string{"status": "ok"})
}

// /readyz — can the process serve traffic? (readiness)
// Returns 503 if dependencies are not ready
func (h *Handler) Readyz(c *gin.Context) {
    if err := h.checkDB(); err != nil {
        core.WriteResponse(c, errno.ErrInternal.WithMessage("db not ready"), nil)
        return
    }
    core.WriteResponse(c, nil, map[string]string{"status": "ready"})
}
```

## Shutdown Timeout Sizing

| Scenario | Recommended timeout |
|----------|-------------------|
| REST API (short requests) | 5–10s |
| File upload / long polling | 30–60s |
| Batch jobs / streaming RPC | 120s+ |
| Default (unknown) | 10s |

Always match the timeout to the worst-case legitimate request duration, not an arbitrary large value.

## Signal Handling — Complete Example

```go
package apiserver

import (
    "context"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/myproject/internal/pkg/log"
)

type UnionServer struct {
    srv server.Server
}

func (s *UnionServer) Run() error {
    // Run in background goroutine — RunOrDie blocks
    go s.srv.RunOrDie()

    quit := make(chan os.Signal, 1)
    // SIGKILL cannot be caught — no need to register
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
