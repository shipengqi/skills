# net/http Patterns Reference

## CORS Middleware

```go
func corsMiddleware() func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("Access-Control-Allow-Origin", "*")
            w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
            w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")

            if r.Method == http.MethodOptions {
                w.WriteHeader(http.StatusOK)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}
```

## Security Headers Middleware

```go
func secureHeadersMiddleware() func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("X-Frame-Options", "DENY")
            w.Header().Set("X-Content-Type-Options", "nosniff")
            w.Header().Set("X-XSS-Protection", "1; mode=block")
            if r.TLS != nil {
                w.Header().Set("Strict-Transport-Security", "max-age=31536000")
            }
            next.ServeHTTP(w, r)
        })
    }
}
```

## RequestID Context Bridge

```go
func requestContextMiddleware() func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // chi injects RequestID into context automatically
            // bridge it into our own contextx key
            reqID := middleware.GetReqID(r.Context())
            ctx := contextx.WithRequestID(r.Context(), reqID)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}
```

## Chi Middleware Chain

```go
r := chi.NewRouter()
r.Use(
    middleware.Recoverer,           // panic recovery
    middleware.RequestID,           // adds X-Request-Id header + context
    middleware.RealIP,              // use X-Forwarded-For as RemoteAddr
    middleware.Compress(5),         // gzip responses
    middleware.Timeout(60*time.Second), // request timeout
    corsMiddleware(),
    secureHeadersMiddleware(),
    requestContextMiddleware(),
)
```

## Health and Readiness

```go
r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
    writeResponse(w, map[string]string{"status": "ok"}, nil)
})

r.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {
    if err := checkDB(r.Context()); err != nil {
        writeError(w, errno.ErrInternal.WithMessage("db not ready"))
        return
    }
    writeResponse(w, map[string]string{"status": "ready"}, nil)
})
```

## No-Route (404) Handler

```go
// chi: use NotFound handler
r.NotFound(func(w http.ResponseWriter, r *http.Request) {
    writeError(w, errno.ErrPageNotFound)
})

r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
    writeError(w, errno.ErrOperationFailed.WithMessage("method not allowed"))
})
```

## Testing net/http Handlers

```go
func TestHandler_GetUser(t *testing.T) {
    ctrl := gomock.NewController(t)
    mockBiz := mock_biz.NewMockIBiz(ctrl)
    // ... set expectations ...

    h := &Handler{biz: mockBiz, val: mockVal}

    req := httptest.NewRequest(http.MethodGet, "/v1/users/user-001", nil)
    // inject chi URL params
    rctx := chi.NewRouteContext()
    rctx.URLParams.Add("userID", "user-001")
    req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

    w := httptest.NewRecorder()
    h.GetUser(w, req)

    assert.Equal(t, http.StatusOK, w.Code)
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

Same structure as Gin/Echo/Fiber — consistent across frameworks.
