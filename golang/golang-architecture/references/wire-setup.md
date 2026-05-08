# Wire Setup Reference

## File Roles

| File | Build tag | Purpose |
|------|-----------|---------|
| `wire.go` | `//go:build wireinject` | Hand-written injector definitions; excluded from normal build |
| `wire_gen.go` | `//go:build !wireinject` | Auto-generated wiring code; never edit manually |

Both files are in the same package (`package apiserver`). Go's build system includes exactly one of them at a time.

## wire.go Template

```go
//go:build wireinject
// +build wireinject

package apiserver

import (
    "github.com/google/wire"
    "github.com/myproject/internal/apiserver/biz"
    "github.com/myproject/internal/apiserver/pkg/validation"
    "github.com/myproject/internal/apiserver/store"
    "github.com/myproject/internal/pkg/server"
)

// InitializeWebServer is the top-level injector.
// Wire reads this function to generate wire_gen.go.
func InitializeWebServer(cfg *Config) (server.Server, error) {
    wire.Build(
        // Server constructor + extract fields from *Config
        wire.NewSet(NewWebServer, wire.FieldsOf(new(*Config), "ServerMode")),
        // Inject all fields of ServerConfig struct
        wire.Struct(new(ServerConfig), "*"),
        // Layer ProviderSets
        store.ProviderSet,
        biz.ProviderSet,
        validation.ProviderSet,
        // Custom provider for *gorm.DB
        ProvideDB,
    )
    return nil, nil  // Wire replaces this body in wire_gen.go
}
```

## ProviderSet Per Layer

### store/store.go

```go
var ProviderSet = wire.NewSet(
    NewStore,
    wire.Bind(new(IStore), new(*datastore)),
)

func NewStore(db *gorm.DB) *datastore { ... }
```

### biz/biz.go

```go
var ProviderSet = wire.NewSet(
    NewBiz,
    wire.Bind(new(IBiz), new(*biz)),
)

func NewBiz(store store.IStore, authz *authz.Authz) *biz { ... }
```

### validation/validation.go

```go
var ProviderSet = wire.NewSet(New)

func New(store store.IStore) *Validator { ... }
```

## wire.Bind — Interface → Concrete

`wire.Bind` tells Wire that when something requests an interface, inject the concrete type:

```go
wire.Bind(new(IBiz), new(*biz))
// "wherever IBiz is requested, provide *biz"
```

Without `wire.Bind`, Wire can only inject `*biz` directly; it won't satisfy `IBiz` parameters automatically.

## wire.Struct — Inject All Fields

```go
wire.Struct(new(ServerConfig), "*")
// equivalent to: wire.Struct(new(ServerConfig), "Cfg", "Biz", "Val", ...)
```

`"*"` means inject all exported fields. Wire matches by type.

## wire.FieldsOf — Extract Value from Struct

```go
wire.FieldsOf(new(*Config), "ServerMode")
// makes Config.ServerMode available as a standalone string dependency
```

## Custom Provider (ProvideDB)

Providers not covered by a ProviderSet go inline:

```go
// apiserver/server.go (or config.go)
func ProvideDB(cfg *Config) (*gorm.DB, error) {
    return gorm.Open(mysql.Open(cfg.MySQLOptions.DSN()), &gorm.Config{})
}
```

Wire sees `ProvideDB` returns `*gorm.DB, error` and calls it once, passing the result wherever `*gorm.DB` is needed.

## Regeneration Workflow

```bash
# 1. Install wire (once)
go install github.com/google/wire/cmd/wire@latest

# 2. Regenerate after any provider or injector change
go generate ./internal/apiserver/...

# wire reads the //go:generate directive in wire_gen.go:
# //go:generate go run -mod=mod github.com/google/wire/cmd/wire
```

Always commit both `wire.go` and the updated `wire_gen.go`.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Editing `wire_gen.go` by hand | Never edit — regenerate instead |
| Missing `wire.Bind` for interface param | Add `wire.Bind(new(IFoo), new(*foo))` to ProviderSet |
| `wire.go` compiled in normal build | Ensure `//go:build wireinject` is the first line |
| Provider returns concrete, caller wants interface | Add `wire.Bind` or change provider to return interface |
| Multiple providers for same type | Use `wire.NewSet` grouping to isolate scope |
