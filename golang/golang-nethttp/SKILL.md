---
name: golang-nethttp
description: Go standard library net/http patterns with chi router — mux setup, middleware, route groups, request binding, and response writing. Use when building HTTP servers without a third-party framework in Go. Apply whenever user writes http.HandlerFunc, chi.NewRouter(), r.Route(), chi.URLParam(), or asks about net/http middleware — never use http.DefaultServeMux.
metadata:
  triggers:
    files:
      - 'go.mod'
    keywords:
      - net/http
      - http.ServeMux
      - chi
      - http.Handler
      - http.HandlerFunc
      - json.NewDecoder
---

# Go net/http (with chi)

> Standard library net/http + [chi](https://github.com/go-chi/chi) router. Chi is lightweight, idiomatic, and compatible with any `net/http` middleware.

## Server Setup

```go
import (
    "net/http"
    "github.com/go-chi/chi/v5"
    "github.com/go-chi/chi/v5/middleware"
)

r := chi.NewRouter()

// Global middleware
r.Use(
    middleware.Recoverer,
    middleware.RequestID,
    middleware.RealIP,
    corsMiddleware(),
    secureHeadersMiddleware(),
    requestContextMiddleware(),  // bridge chi RequestID into Go context
)

srv := &http.Server{
    Addr:    cfg.Addr,
    Handler: r,
}
```

## Route Groups

```go
func installRoutes(r chi.Router, h *Handler, authn, authz func(http.Handler) http.Handler) {
    r.Get("/healthz", h.Healthz)
    r.Post("/login", h.Login)

    r.Route("/v1", func(r chi.Router) {
        r.Route("/users", func(r chi.Router) {
            r.Post("/", h.CreateUser)          // public

            r.Group(func(r chi.Router) {       // protected sub-group
                r.Use(authn, authz)
                r.Put("/{userID}", h.UpdateUser)
                r.Delete("/{userID}", h.DeleteUser)
                r.Get("/{userID}", h.GetUser)
                r.Get("/", h.ListUser)
            })
        })

        r.Route("/posts", func(r chi.Router) {
            r.Use(authn, authz)
            r.Post("/", h.CreatePost)
            r.Get("/{postID}", h.GetPost)
            r.Get("/", h.ListPost)
        })
    })
}
```

## Request Binding

```go
// JSON body
func (h *Handler) CreateUser(w http.ResponseWriter, r *http.Request) {
    var req apiv1.CreateUserRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, errno.ErrBind.WithMessage(err.Error()))
        return
    }
    if err := h.val.ValidateCreateUserRequest(r.Context(), &req); err != nil {
        writeError(w, err)
        return
    }
    resp, err := h.biz.UserV1().Create(r.Context(), &req)
    writeResponse(w, resp, err)
}

// URI params — chi path params via chi.URLParam
func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
    req := apiv1.GetUserRequest{UserID: chi.URLParam(r, "userID")}
    resp, err := h.biz.UserV1().Get(r.Context(), &req)
    writeResponse(w, resp, err)
}

// Query string
func (h *Handler) ListUser(w http.ResponseWriter, r *http.Request) {
    req := apiv1.ListUserRequest{
        Page:  parseInt(r.URL.Query().Get("page"), 1),
        Limit: parseInt(r.URL.Query().Get("limit"), 20),
    }
    resp, err := h.biz.UserV1().List(r.Context(), &req)
    writeResponse(w, resp, err)
}
```

## Unified Response Helpers

```go
// handler/http/response.go
func writeResponse(w http.ResponseWriter, data any, err error) {
    w.Header().Set("Content-Type", "application/json")
    if err != nil {
        errx := errorsx.FromError(err)
        w.WriteHeader(errx.Code)
        _ = json.NewEncoder(w).Encode(ErrorResponse{
            Reason:  errx.Reason,
            Message: errx.Message,
        })
        return
    }
    w.WriteHeader(http.StatusOK)
    _ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, err error) {
    writeResponse(w, nil, err)
}
```

## Middleware Pattern

```go
// Standard net/http middleware signature
func AuthnMiddleware(retriever UserRetriever) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            userID, err := token.ParseHTTPRequest(r)
            if err != nil {
                writeError(w, errno.ErrTokenInvalid.WithMessage(err.Error()))
                return   // ← just return, no Abort needed
            }
            user, err := retriever.GetUser(r.Context(), userID)
            if err != nil {
                writeError(w, errno.ErrUnauthenticated.WithMessage(err.Error()))
                return
            }
            ctx := contextx.WithUserID(r.Context(), user.UserID)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}
```

## Graceful Shutdown

```go
func (s *HTTPServer) RunOrDie() {
    log.Infow("Start listening", "addr", s.srv.Addr)
    if err := s.srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
        log.Fatalw("Failed to start HTTP server", "err", err)
    }
}

func (s *HTTPServer) GracefulStop(ctx context.Context) {
    log.Infow("Gracefully stop HTTP server")
    if err := s.srv.Shutdown(ctx); err != nil {
        log.Errorw("HTTP server forced to shutdown", "err", err)
    }
}
```

## Key Differences from Gin

| | Gin | net/http + chi |
|--|-----|----------------|
| Engine | `gin.New()` | `chi.NewRouter()` |
| Handler sig | `func(*gin.Context)` | `func(http.ResponseWriter, *http.Request)` |
| Go context | `c.Request.Context()` | `r.Context()` |
| Set ctx | `c.Request = r.WithContext(ctx)` | `r.WithContext(ctx)` → pass to `next` |
| Bind JSON | `c.ShouldBindJSON(&r)` | `json.NewDecoder(r.Body).Decode(&r)` |
| URI param | `c.Param("id")` | `chi.URLParam(r, "id")` |
| Response | `core.WriteResponse(c, ...)` | `writeResponse(w, ...)` (custom) |
| Middleware | `gin.HandlerFunc` | `func(http.Handler) http.Handler` |
| Abort chain | `c.Abort()` | `return` (no next.ServeHTTP call) |

## Anti-Patterns

- ❌ `http.DefaultServeMux` — always create a named mux/router
- ❌ Writing to `w` after calling `next.ServeHTTP` — headers already sent
- ❌ Not setting `Content-Type` header before writing body
- ❌ `w.Write(...)` before `w.WriteHeader(...)` — implicit 200, status call is ignored
- ❌ Ignoring `json.NewEncoder` errors — log or handle encode failures

## References

- [net/http Patterns](references/nethttp-patterns.md) — CORS middleware, chi middleware chain, error response struct
