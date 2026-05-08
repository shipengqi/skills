# Router Setup Reference

## Full Router with pprof + TLS

```go
func (c *ServerConfig) NewGinServer() server.Server {
    engine := gin.New()

    engine.Use(
        gin.Recovery(),
        mw.NoCache,
        mw.Cors,
        mw.Secure,
        mw.RequestIDMiddleware(),
    )

    // Register pprof routes at /debug/pprof/
    pprof.Register(engine)

    c.InstallRESTAPI(engine)

    httpsrv := server.NewHTTPServer(c.cfg.HTTPOptions, c.cfg.TLSOptions, engine)
    return &ginServer{srv: httpsrv}
}
```

## Route Group Patterns

### Public + Protected in Same Resource

```go
userv1 := v1.Group("/users")
{
    userv1.POST("", handler.CreateUser)       // ← public: no auth
    userv1.Use(authMiddlewares...)            // ← apply auth to everything below
    userv1.PUT(":userID/change-password", handler.ChangePassword)
    userv1.PUT(":userID", handler.UpdateUser)
    userv1.DELETE(":userID", handler.DeleteUser)
    userv1.GET(":userID", handler.GetUser)
    userv1.GET("", handler.ListUser)
}
```

`Use()` mid-group affects only routes registered after it.

### Fully Protected Resource

```go
// Pass middleware directly to Group — cleaner than calling Use() separately
postv1 := v1.Group("/posts", authMiddlewares...)
{
    postv1.POST("", handler.CreatePost)
    postv1.PUT(":postID", handler.UpdatePost)
    postv1.DELETE("", handler.DeletePost)
    postv1.GET(":postID", handler.GetPost)
    postv1.GET("", handler.ListPost)
}
```

## RequestID Middleware

```go
// internal/pkg/middleware/gin/requestid.go
func RequestIDMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        requestID := c.Request.Header.Get(known.XRequestID)
        if requestID == "" {
            requestID = rid.New()  // generate if not provided by upstream
        }
        ctx := contextx.WithRequestID(c.Request.Context(), requestID)
        c.Request = c.Request.WithContext(ctx)
        c.Header(known.XRequestID, requestID)  // echo back in response header
        c.Next()
    }
}
```

## Handler Struct

```go
// handler/http/handler.go
type Handler struct {
    biz biz.IBiz
    val *validation.Validator
}

func NewHandler(biz biz.IBiz, val *validation.Validator) *Handler {
    return &Handler{biz: biz, val: val}
}
```

Handler depends on `IBiz` interface (not concrete `*biz`) — enables mock testing.

## HTTPServer Construction

```go
// internal/pkg/server/http_server.go
func NewHTTPServer(
    httpOptions *genericoptions.HTTPOptions,
    tlsOptions *genericoptions.TLSOptions,
    handler http.Handler,
) *HTTPServer {
    var tlsConfig *tls.Config
    if tlsOptions != nil && tlsOptions.UseTLS {
        tlsConfig = tlsOptions.MustTLSConfig()
    }
    return &HTTPServer{
        srv: &http.Server{
            Addr:      httpOptions.Addr,    // e.g. ":8080"
            Handler:   handler,
            TLSConfig: tlsConfig,
        },
    }
}
```
