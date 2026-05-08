# Fiber Patterns Reference

## fasthttp Gotchas

Fiber uses fasthttp internally. Key differences from net/http:

```go
// ✗ These net/http types are NOT available in Fiber handlers
r *http.Request       // does not exist
w http.ResponseWriter // does not exist

// ✓ Use Fiber's API
c.Body()              // request body bytes
c.BodyParser(&req)    // decode JSON body
c.Get("Header")       // read header
c.Set("Header", val)  // write header
```

## Body Reuse

Fiber reuses `*fiber.Ctx` across requests for performance. **Never store `c` beyond the handler scope**:

```go
// ✗ storing c in a goroutine — undefined behavior after handler returns
go func() { process(c) }()

// ✓ copy needed data before spawning goroutine
body := make([]byte, len(c.Body()))
copy(body, c.Body())
go func() { process(body) }()
```

## Streaming Response

```go
func (h *Handler) StreamData(c *fiber.Ctx) error {
    c.Set(fiber.HeaderContentType, fiber.MIMETextPlain)
    c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
        for i := 0; i < 10; i++ {
            fmt.Fprintf(w, "chunk %d\n", i)
            w.Flush()
        }
    })
    return nil
}
```

## Reading Headers

```go
authHeader := c.Get(fiber.HeaderAuthorization)  // "Bearer <token>"
contentType := c.Get(fiber.HeaderContentType)
requestID   := c.Get(fiber.HeaderXRequestID)
```

## Setting Go Context in Middleware Chain

```go
// Middleware 1 — set initial ctx
func requestContextMiddleware() fiber.Handler {
    return func(c *fiber.Ctx) error {
        reqID := c.Get(fiber.HeaderXRequestID)
        ctx := contextx.WithRequestID(context.Background(), reqID)
        c.SetUserContext(ctx)
        return c.Next()
    }
}

// Middleware 2 — extend ctx from Middleware 1
func AuthnMiddleware(retriever UserRetriever) fiber.Handler {
    return func(c *fiber.Ctx) error {
        // c.UserContext() has reqID from Middleware 1
        ctx := contextx.WithUserID(c.UserContext(), userID)
        c.SetUserContext(ctx)
        return c.Next()
    }
}
```

Each middleware extends the context — don't overwrite with a fresh `context.Background()`.

## Testing Fiber Handlers

```go
func TestHandler_GetUser(t *testing.T) {
    app := fiber.New()
    h := &Handler{biz: mockBiz, val: mockVal}
    app.Get("/v1/users/:userID", func(c *fiber.Ctx) error {
        ctx := contextx.WithUserID(context.Background(), "user-001")
        c.SetUserContext(ctx)
        return h.GetUser(c)
    })

    req := httptest.NewRequest(http.MethodGet, "/v1/users/user-001", nil)
    resp, err := app.Test(req, -1)  // -1 = no timeout

    require.NoError(t, err)
    assert.Equal(t, http.StatusOK, resp.StatusCode)
}
```

## Error Response Struct

```go
type ErrorResponse struct {
    Reason   string            `json:"reason,omitempty"`
    Message  string            `json:"message,omitempty"`
    Metadata map[string]string `json:"metadata,omitempty"`
}
```

Same structure as Gin/Echo — consistent across frameworks.
