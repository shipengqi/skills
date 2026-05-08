# Middleware Patterns Reference

## NoCache

```go
func NoCache(c *gin.Context) {
    c.Header("Cache-Control", "no-cache, no-store, max-age=0, must-revalidate")
    c.Header("Expires", "Thu, 01 Jan 1970 00:00:00 GMT")
    c.Header("Last-Modified", time.Now().UTC().Format(http.TimeFormat))
    c.Next()
}
```

## Cors

```go
func Cors(c *gin.Context) {
    if c.Request.Method == http.MethodOptions {
        c.Header("Access-Control-Allow-Origin", "*")
        c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        c.Header("Access-Control-Allow-Headers", "authorization, origin, content-type, accept")
        c.Header("Allow", "HEAD, GET, POST, PUT, PATCH, DELETE, OPTIONS")
        c.Header("Content-Type", "application/json")
        c.AbortWithStatus(http.StatusOK)
        return
    }
    c.Next()
}
```

## Secure

```go
func Secure(c *gin.Context) {
    c.Header("Access-Control-Allow-Origin", "*")
    c.Header("X-Frame-Options", "DENY")
    c.Header("X-Content-Type-Options", "nosniff")
    c.Header("X-XSS-Protection", "1; mode=block")
    if c.Request.TLS != nil {
        c.Header("Strict-Transport-Security", "max-age=31536000")
    }
    c.Next()
}
```

## AuthnMiddleware

```go
// Requires a UserRetriever interface — keeps middleware decoupled from store
type UserRetriever interface {
    GetUser(ctx context.Context, userID string) (*model.UserM, error)
}

func AuthnMiddleware(retriever UserRetriever) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID, err := token.ParseRequest(c)  // parses Authorization: Bearer <token>
        if err != nil {
            core.WriteResponse(c, nil, errno.ErrTokenInvalid.WithMessage(err.Error()))
            c.Abort()
            return
        }

        user, err := retriever.GetUser(c, userID)
        if err != nil {
            core.WriteResponse(c, nil, errno.ErrUnauthenticated.WithMessage(err.Error()))
            c.Abort()
            return
        }

        // Inject into request context — available to all downstream handlers and biz
        ctx := contextx.WithUserID(c.Request.Context(), user.UserID)
        ctx  = contextx.WithUsername(ctx, user.Username)
        c.Request = c.Request.WithContext(ctx)
        c.Next()
    }
}
```

## AuthzMiddleware

```go
func AuthzMiddleware(authz *authz.Authz) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := contextx.UserID(c.Request.Context())
        resource := c.Request.URL.Path
        action := c.Request.Method

        allowed, err := authz.Enforce(userID, resource, action)
        if err != nil || !allowed {
            core.WriteResponse(c, nil, errno.ErrPermissionDenied)
            c.Abort()
            return
        }
        c.Next()
    }
}
```

## Bypass Middleware

For routes that need to skip certain middleware (e.g., webhook callbacks):

```go
// internal/pkg/middleware/gin/bypass.go
func Bypass(c *gin.Context) {
    // Example: skip authz for specific paths
    if strings.HasPrefix(c.Request.URL.Path, "/webhook/") {
        c.Next()
        return
    }
    // normal processing...
    c.Next()
}
```

## Writing Custom Middleware

Template for any middleware that modifies context:

```go
func MyMiddleware(dep SomeDependency) gin.HandlerFunc {
    return func(c *gin.Context) {
        // 1. Extract from request
        value := c.Request.Header.Get("X-My-Header")

        // 2. Validate / enrich
        if value == "" {
            core.WriteResponse(c, nil, errno.ErrBind.WithMessage("missing X-My-Header"))
            c.Abort()
            return
        }

        // 3. Inject into context
        ctx := contextx.WithMyValue(c.Request.Context(), value)
        c.Request = c.Request.WithContext(ctx)

        c.Next()
    }
}
```

Key rules:
- Always `c.Abort()` after `WriteResponse` on error — never just `return`
- Always `c.Next()` on the success path
- Use `c.Request.WithContext(ctx)` to propagate enriched context
- Accept dependencies as constructor params — not as closures over global state
