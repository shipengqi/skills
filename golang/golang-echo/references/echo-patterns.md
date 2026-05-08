# Echo Patterns Reference

## Validator Integration

Echo has a built-in `Validator` interface. Wire in a custom validator at startup:

```go
type requestValidator struct{}

func (v *requestValidator) Validate(i any) error {
    // integrate with go-playground/validator if needed
    return nil
}

e := echo.New()
e.Validator = &requestValidator{}
// Then c.Bind(&req) calls Validate automatically
```

For the miniblog-style pattern (explicit validator functions), skip this and call validators manually as shown in the main SKILL.md.

## Context Bridge Middleware

Bridge chi/echo RequestID into Go context for `log.W(ctx)`:

```go
func requestContextMiddleware() echo.MiddlewareFunc {
    return func(next echo.HandlerFunc) echo.HandlerFunc {
        return func(c echo.Context) error {
            reqID := c.Response().Header().Get(echo.HeaderXRequestID)
            ctx := contextx.WithRequestID(c.Request().Context(), reqID)
            c.SetRequest(c.Request().WithContext(ctx))
            return next(c)
        }
    }
}
```

## Static File Serving

```go
e.Static("/static", "public")           // serve public/ directory at /static
e.File("/favicon.ico", "public/favicon.ico")
```

## Group with Common Prefix and Middleware

```go
api := e.Group("/api")
api.Use(middleware.Logger())

v1 := api.Group("/v1")
v1.Use(rateLimitMiddleware())

// Routes: /api/v1/users
v1.GET("/users", h.ListUser)
```

## Error Response Struct

```go
type ErrorResponse struct {
    Reason   string            `json:"reason,omitempty"`
    Message  string            `json:"message,omitempty"`
    Metadata map[string]string `json:"metadata,omitempty"`
}
```

Matches the same structure as Gin's `core.ErrorResponse` — consistent across frameworks.

## TLS Setup

```go
e := echo.New()
// Auto TLS via Let's Encrypt
e.AutoTLSManager.Cache = autocert.DirCache("/var/www/.cache")

// Manual TLS
e.StartTLS(":443", "cert.pem", "key.pem")

// Graceful shutdown still uses e.Shutdown(ctx)
```

## Testing Echo Handlers

```go
func TestHandler_GetUser(t *testing.T) {
    e := echo.New()
    req := httptest.NewRequest(http.MethodGet, "/v1/users/user-001", nil)
    rec := httptest.NewRecorder()
    c := e.NewContext(req, rec)
    c.SetParamNames("userID")
    c.SetParamValues("user-001")

    // inject context
    ctx := contextx.WithUserID(req.Context(), "user-001")
    c.SetRequest(req.WithContext(ctx))

    h := &Handler{biz: mockBiz, val: mockVal}
    err := h.GetUser(c)

    assert.NoError(t, err)
    assert.Equal(t, http.StatusOK, rec.Code)
}
```
