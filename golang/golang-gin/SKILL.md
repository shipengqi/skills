---
name: golang-gin
description: Gin framework patterns — engine setup, middleware chain, route grouping, request binding, and response writing. Use when building Gin HTTP servers, adding middleware, defining routes, or handling requests in Go projects using the Gin framework. Apply whenever user writes gin.New(), gin.Default(), gin.HandlerFunc, gin.Engine, or asks about middleware order, c.Abort(), or handler request binding in Gin.
metadata:
  triggers:
    files:
      - 'go.mod'
    keywords:
      - gin
      - gin.New
      - gin.Context
      - gin.Engine
      - HandleJSONRequest
      - ShouldBindJSON
---

# Gin Framework

## Engine Setup

```go
// ✓ gin.New() — no default middleware, full control
engine := gin.New()

// ✗ gin.Default() — adds Logger + Recovery you can't customize
engine := gin.Default()
```

## Middleware Chain

Register global middleware in this order:

```go
engine.Use(
    gin.Recovery(),             // 1. recover panics first
    mw.NoCache,                 // 2. HTTP cache headers
    mw.Cors,                    // 3. CORS (handles OPTIONS preflight)
    mw.Secure,                  // 4. security headers (X-Frame-Options etc.)
    mw.RequestIDMiddleware(),   // 5. inject X-Request-ID into context
)
// Auth middleware is NOT global — apply per route group
```

## Route Groups

```go
func (c *ServerConfig) InstallRESTAPI(engine *gin.Engine) {
    handler := handler.NewHandler(c.biz, c.val)

    // Public endpoints (no auth)
    engine.GET("/healthz", handler.Healthz)
    engine.POST("/login", handler.Login)
    engine.PUT("/refresh-token", mw.AuthnMiddleware(c.retriever), handler.RefreshToken)

    // Auth + authz middleware shared by protected routes
    authMiddlewares := []gin.HandlerFunc{
        mw.AuthnMiddleware(c.retriever),
        mw.AuthzMiddleware(c.authz),
    }

    v1 := engine.Group("/v1")
    {
        userv1 := v1.Group("/users")
        {
            userv1.POST("", handler.CreateUser)           // public: no auth
            userv1.Use(authMiddlewares...)                 // apply auth to all below
            userv1.PUT(":userID", handler.UpdateUser)
            userv1.DELETE(":userID", handler.DeleteUser)
            userv1.GET(":userID", handler.GetUser)
            userv1.GET("", handler.ListUser)
        }

        // All post routes require auth — apply at group level
        postv1 := v1.Group("/posts", authMiddlewares...)
        {
            postv1.POST("", handler.CreatePost)
            postv1.GET(":postID", handler.GetPost)
            postv1.GET("", handler.ListPost)
        }
    }

    // 404 handler
    engine.NoRoute(func(c *gin.Context) {
        core.WriteResponse(c, nil, errno.ErrPageNotFound)
    })
}
```

## Request Binding — core.HandleXxxRequest

Use the matching helper based on where parameters come from:

```go
// JSON body  →  POST / PUT / PATCH
func (h *Handler) CreateUser(c *gin.Context) {
    core.HandleJSONRequest(c, h.biz.UserV1().Create, h.val.ValidateCreateUserRequest)
}

// URI params  →  GET /users/:userID, DELETE /users/:userID
func (h *Handler) GetUser(c *gin.Context) {
    core.HandleUriRequest(c, h.biz.UserV1().Get, h.val.ValidateGetUserRequest)
}

// Query string  →  GET /users?page=1&limit=20
func (h *Handler) ListUser(c *gin.Context) {
    core.HandleQueryRequest(c, h.biz.UserV1().List, h.val.ValidateListUserRequest)
}
```

Validators are optional — omit when no extra validation needed:
```go
func (h *Handler) RefreshToken(c *gin.Context) {
    core.HandleJSONRequest(c, h.biz.UserV1().RefreshToken)  // no validator
}
```

## WriteResponse

```go
// success — data is the response body, 200 OK
core.WriteResponse(c, responseData, nil)

// error — HTTP status comes from errno.Code
core.WriteResponse(c, nil, errno.ErrUserNotFound)    // → 404
core.WriteResponse(c, nil, errno.ErrUnauthenticated) // → 401
```

`HandleXxxRequest` calls `WriteResponse` internally — never call `c.JSON` directly in handlers.

## Context Propagation

Pass `c.Request.Context()` to biz — never use `c` itself below handler layer:

```go
// Inside middleware — inject user info into ctx
ctx := contextx.WithUserID(c.Request.Context(), user.UserID)
ctx  = contextx.WithUsername(ctx, user.Username)
c.Request = c.Request.WithContext(ctx)
c.Next()

// HandleXxxRequest passes c.Request.Context() to biz automatically
```

## Middleware — Abort on Error

```go
func AuthnMiddleware(retriever UserRetriever) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID, err := token.ParseRequest(c)
        if err != nil {
            core.WriteResponse(c, nil, errno.ErrTokenInvalid.WithMessage(err.Error()))
            c.Abort()   // ← stop middleware chain
            return
        }
        // inject user into ctx, then c.Next()
        c.Next()
    }
}
```

Always call `c.Abort()` after `WriteResponse` in middleware error paths — never just `return`.

## Anti-Patterns

- ❌ `gin.Default()` — use `gin.New()` with explicit middleware
- ❌ `c.BindJSON` — panics on error; use `c.ShouldBindJSON` (via `HandleJSONRequest`)
- ❌ `c.JSON(...)` in handlers — use `core.WriteResponse` / `HandleXxxRequest`
- ❌ Passing `c *gin.Context` to biz/store — pass `c.Request.Context()` instead
- ❌ Auth middleware registered globally — apply per route group
- ❌ `return` without `c.Abort()` in middleware error path — chain continues

## References

- [Router Setup](references/router-setup.md) — full router example with pprof, TLS, multi-group patterns
- [Middleware Patterns](references/middleware-patterns.md) — NoCache, Cors, Secure, RequestID, Authn, Authz implementations
