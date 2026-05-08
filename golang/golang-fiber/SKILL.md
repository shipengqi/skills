---
name: golang-fiber
description: Fiber framework patterns — app setup, middleware, route groups, request binding, and response writing. Use when building Fiber HTTP servers in Go. Complements golang-language, golang-architecture, golang-api-server skills.
metadata:
  triggers:
    files:
      - 'go.mod'
    keywords:
      - fiber
      - gofiber
      - fiber.New
      - fiber.Ctx
---

# Fiber Framework

> Fiber is built on fasthttp (not net/http). Its `*fiber.Ctx` is NOT a `context.Context` — always use `c.UserContext()` to get the Go context and pass it to biz/store layers.

## App Setup

```go
import "github.com/gofiber/fiber/v2"
import "github.com/gofiber/fiber/v2/middleware/recover"
import "github.com/gofiber/fiber/v2/middleware/requestid"
import "github.com/gofiber/fiber/v2/middleware/cors"

app := fiber.New(fiber.Config{
    ErrorHandler: customErrorHandler,
})

// Global middleware
app.Use(
    recover.New(),
    requestid.New(),
    cors.New(cors.Config{
        AllowOrigins: "*",
        AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
        AllowHeaders: "Authorization,Content-Type",
    }),
    userContextMiddleware(),  // bridge requestID into Go context
)
```

## Route Groups

```go
func installRoutes(app *fiber.App, h *Handler, authn, authz fiber.Handler) {
    app.Get("/healthz", h.Healthz)
    app.Post("/login", h.Login)

    v1 := app.Group("/v1")

    users := v1.Group("/users")
    users.Post("", h.CreateUser)                 // public
    users.Use(authn, authz)
    users.Put("/:userID", h.UpdateUser)
    users.Delete("/:userID", h.DeleteUser)
    users.Get("/:userID", h.GetUser)
    users.Get("", h.ListUser)

    posts := v1.Group("/posts", authn, authz)
    posts.Post("", h.CreatePost)
    posts.Get("/:postID", h.GetPost)
    posts.Get("", h.ListPost)
}
```

## Request Binding

```go
// JSON body
func (h *Handler) CreateUser(c *fiber.Ctx) error {
    var req apiv1.CreateUserRequest
    if err := c.BodyParser(&req); err != nil {
        return writeError(c, errno.ErrBind.WithMessage(err.Error()))
    }
    if err := h.val.ValidateCreateUserRequest(c.UserContext(), &req); err != nil {
        return writeError(c, err)
    }
    resp, err := h.biz.UserV1().Create(c.UserContext(), &req)
    return writeResponse(c, resp, err)
}

// URI params: c.Params("userID")
func (h *Handler) GetUser(c *fiber.Ctx) error {
    req := apiv1.GetUserRequest{UserID: c.Params("userID")}
    resp, err := h.biz.UserV1().Get(c.UserContext(), &req)
    return writeResponse(c, resp, err)
}

// Query string: c.QueryParser or c.Query("key")
func (h *Handler) ListUser(c *fiber.Ctx) error {
    var req apiv1.ListUserRequest
    if err := c.QueryParser(&req); err != nil {
        return writeError(c, errno.ErrBind.WithMessage(err.Error()))
    }
    resp, err := h.biz.UserV1().List(c.UserContext(), &req)
    return writeResponse(c, resp, err)
}
```

**Always use `c.UserContext()`** to pass Go context to biz layer — `c` itself is not a context.

## Unified Response Helpers

```go
// handler/http/response.go
func writeResponse(c *fiber.Ctx, data any, err error) error {
    if err != nil {
        errx := errorsx.FromError(err)
        c.Status(errx.Code)
        return c.JSON(ErrorResponse{Reason: errx.Reason, Message: errx.Message})
    }
    return c.JSON(data)
}

func writeError(c *fiber.Ctx, err error) error {
    return writeResponse(c, nil, err)
}
```

## Custom Error Handler

```go
func customErrorHandler(c *fiber.Ctx, err error) error {
    errx := errorsx.FromError(err)
    c.Status(errx.Code)
    return c.JSON(ErrorResponse{Reason: errx.Reason, Message: errx.Message})
}
```

## AuthnMiddleware

```go
func AuthnMiddleware(retriever UserRetriever) fiber.Handler {
    return func(c *fiber.Ctx) error {
        userID, err := token.ParseFiberRequest(c)
        if err != nil {
            return writeError(c, errno.ErrTokenInvalid.WithMessage(err.Error()))
        }
        user, err := retriever.GetUser(c.UserContext(), userID)
        if err != nil {
            return writeError(c, errno.ErrUnauthenticated.WithMessage(err.Error()))
        }
        ctx := contextx.WithUserID(c.UserContext(), user.UserID)
        c.SetUserContext(ctx)   // ← update Go context for downstream
        return c.Next()
    }
}
```

## Inject Go Context (Bridge Middleware)

Fiber doesn't automatically bridge request-scoped values into Go context. Do it explicitly:

```go
func userContextMiddleware() fiber.Handler {
    return func(c *fiber.Ctx) error {
        reqID := c.Get(fiber.HeaderXRequestID)
        ctx := contextx.WithRequestID(context.Background(), reqID)
        c.SetUserContext(ctx)
        return c.Next()
    }
}
```

## Graceful Shutdown

```go
func (s *FiberServer) RunOrDie() {
    log.Infow("Start listening", "addr", s.addr)
    if err := s.app.Listen(s.addr); err != nil {
        log.Fatalw("Failed to start Fiber server", "err", err)
    }
}

func (s *FiberServer) GracefulStop(ctx context.Context) {
    log.Infow("Gracefully stop Fiber server")
    if err := s.app.ShutdownWithContext(ctx); err != nil {
        log.Errorw("Fiber server forced to shutdown", "err", err)
    }
}
```

## Key Differences from Gin

| | Gin | Fiber |
|--|-----|-------|
| Engine | `gin.New()` | `fiber.New(config)` |
| Context | `*gin.Context` | `*fiber.Ctx` (fasthttp) |
| Go context | `c.Request.Context()` | `c.UserContext()` |
| Set ctx | `c.Request = r.WithContext(ctx)` | `c.SetUserContext(ctx)` |
| Bind JSON | `c.ShouldBindJSON(&r)` | `c.BodyParser(&r)` |
| Query bind | `c.ShouldBindQuery(&r)` | `c.QueryParser(&r)` |
| URI param | `c.Param("id")` | `c.Params("id")` |
| Next | `c.Next()` | `return c.Next()` |
| Middleware | `gin.HandlerFunc` | `fiber.Handler` |

## Anti-Patterns

- ❌ Passing `c` (fiber.Ctx) to biz/store — pass `c.UserContext()` instead
- ❌ Using `context.Background()` in handlers — populate and use `c.UserContext()`
- ❌ `c.Next()` without `return` — Fiber middleware must `return c.Next()`
- ❌ Direct `net/http` types — Fiber uses fasthttp; `http.Request` is not available

## References

- [Fiber Patterns](references/fiber-patterns.md) — fasthttp gotchas, body reuse, streaming response
