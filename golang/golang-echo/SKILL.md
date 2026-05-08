---
name: golang-echo
description: Echo framework patterns — engine setup, middleware, route groups, request binding, and error handling. Use when building Echo HTTP servers in Go. Complements golang-language, golang-architecture, golang-api-server skills.
metadata:
  triggers:
    files:
      - 'go.mod'
    keywords:
      - echo
      - labstack/echo
      - echo.New
      - echo.Context
---

# Echo Framework

## Engine Setup

```go
import "github.com/labstack/echo/v4"
import "github.com/labstack/echo/v4/middleware"

e := echo.New()
e.HideBanner = true   // suppress startup banner in production

// Global middleware
e.Use(
    middleware.Recover(),          // recover panics
    middleware.RequestID(),        // inject X-Request-ID
    middleware.CORSWithConfig(middleware.CORSConfig{
        AllowOrigins: []string{"*"},
        AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete},
        AllowHeaders: []string{echo.HeaderAuthorization, echo.HeaderContentType},
    }),
    requestContextMiddleware(),    // inject RequestID into Go context
)

// Custom HTTP error handler
e.HTTPErrorHandler = customHTTPErrorHandler
```

## Route Groups

```go
func installRoutes(e *echo.Echo, h *Handler, authn echo.MiddlewareFunc, authz echo.MiddlewareFunc) {
    e.GET("/healthz", h.Healthz)
    e.POST("/login", h.Login)

    v1 := e.Group("/v1")

    users := v1.Group("/users")
    users.POST("", h.CreateUser)                    // public
    users.Use(authn, authz)                         // apply auth to routes below
    users.PUT("/:userID", h.UpdateUser)
    users.DELETE("/:userID", h.DeleteUser)
    users.GET("/:userID", h.GetUser)
    users.GET("", h.ListUser)

    posts := v1.Group("/posts", authn, authz)       // all protected
    posts.POST("", h.CreatePost)
    posts.GET("/:postID", h.GetPost)
    posts.GET("", h.ListPost)
}
```

## Request Binding

```go
// JSON body
func (h *Handler) CreateUser(c echo.Context) error {
    var req apiv1.CreateUserRequest
    if err := c.Bind(&req); err != nil {
        return writeError(c, errno.ErrBind.WithMessage(err.Error()))
    }
    if err := h.val.ValidateCreateUserRequest(c.Request().Context(), &req); err != nil {
        return writeError(c, err)
    }
    resp, err := h.biz.UserV1().Create(c.Request().Context(), &req)
    return writeResponse(c, resp, err)
}

// URI params: c.Param("userID")
func (h *Handler) GetUser(c echo.Context) error {
    req := apiv1.GetUserRequest{UserID: c.Param("userID")}
    resp, err := h.biz.UserV1().Get(c.Request().Context(), &req)
    return writeResponse(c, resp, err)
}

// Query string: c.QueryParam("page")
func (h *Handler) ListUser(c echo.Context) error {
    var req apiv1.ListUserRequest
    if err := c.Bind(&req); err != nil {  // Bind handles query params too
        return writeError(c, errno.ErrBind.WithMessage(err.Error()))
    }
    resp, err := h.biz.UserV1().List(c.Request().Context(), &req)
    return writeResponse(c, resp, err)
}
```

**Always use `c.Request().Context()`** (method call) — not `c.Request.Context()`.

## Unified Response Helpers

```go
// handler/http/response.go
func writeResponse(c echo.Context, data any, err error) error {
    if err != nil {
        errx := errorsx.FromError(err)
        return c.JSON(errx.Code, ErrorResponse{
            Reason:  errx.Reason,
            Message: errx.Message,
        })
    }
    return c.JSON(http.StatusOK, data)
}

func writeError(c echo.Context, err error) error {
    return writeResponse(c, nil, err)
}
```

## Custom Error Handler

```go
func customHTTPErrorHandler(err error, c echo.Context) {
    if c.Response().Committed {
        return
    }
    errx := errorsx.FromError(err)
    _ = c.JSON(errx.Code, ErrorResponse{Reason: errx.Reason, Message: errx.Message})
}
```

## AuthnMiddleware

```go
func AuthnMiddleware(retriever UserRetriever) echo.MiddlewareFunc {
    return func(next echo.HandlerFunc) echo.HandlerFunc {
        return func(c echo.Context) error {
            userID, err := token.ParseRequest(c.Request())
            if err != nil {
                return writeError(c, errno.ErrTokenInvalid.WithMessage(err.Error()))
            }
            user, err := retriever.GetUser(c.Request().Context(), userID)
            if err != nil {
                return writeError(c, errno.ErrUnauthenticated.WithMessage(err.Error()))
            }
            ctx := contextx.WithUserID(c.Request().Context(), user.UserID)
            c.SetRequest(c.Request().WithContext(ctx))
            return next(c)
        }
    }
}
```

## Graceful Shutdown

```go
func (s *EchoServer) RunOrDie() {
    log.Infow("Start listening", "addr", s.addr)
    if err := s.e.Start(s.addr); err != nil && !errors.Is(err, http.ErrServerClosed) {
        log.Fatalw("Failed to start Echo server", "err", err)
    }
}

func (s *EchoServer) GracefulStop(ctx context.Context) {
    log.Infow("Gracefully stop Echo server")
    if err := s.e.Shutdown(ctx); err != nil {
        log.Errorw("Echo server forced to shutdown", "err", err)
    }
}
```

## Key Differences from Gin

| | Gin | Echo |
|--|-----|------|
| Engine | `gin.New()` | `echo.New()` |
| Context | `*gin.Context` | `echo.Context` (interface) |
| Request ctx | `c.Request.Context()` | `c.Request().Context()` |
| Bind JSON | `c.ShouldBindJSON(&r)` | `c.Bind(&r)` |
| URI param | `c.Param("id")` | `c.Param("id")` |
| Return | void | `return error` |
| Middleware | `gin.HandlerFunc` | `echo.MiddlewareFunc` |
| Set request | `c.Request = r.WithContext(ctx)` | `c.SetRequest(r.WithContext(ctx))` |

## Anti-Patterns

- ❌ `echo.New()` with default Logger middleware in prod — configure it explicitly
- ❌ `c.Request()` stored outside handler scope — don't cache it
- ❌ Returning `nil` on error path — always return the error or `writeError(c, err)`
- ❌ `c.Echo().Logger` for app logging — use the project's Zap logger

## References

- [Echo Patterns](references/echo-patterns.md) — middleware wiring, validator setup, group patterns
