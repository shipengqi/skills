---
name: golang-database
description: GORM database client setup and store layer — connection pool config, IStore interface, context-based transaction propagation, concrete store implementation.
metadata:
  triggers:
    files:
      - 'go.mod'
    keywords:
      - gorm
      - IStore
      - database
      - db client
      - transaction
      - mysql
      - sqlite
---

# Go Database (GORM)

## DB Initialization

```go
db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})  // or cfg.MySQLOptions.NewDB()
sqlDB, _ := db.DB()
sqlDB.SetMaxOpenConns(100); sqlDB.SetMaxIdleConns(10)
sqlDB.SetConnMaxLifetime(10 * time.Minute)
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
if err := sqlDB.PingContext(ctx); err != nil { return nil, fmt.Errorf("db unreachable: %w", err) }
```

Pool settings live in config options (`MySQLOptions.MaxOpenConns`, etc.), not hardcoded.
## IStore Interface

```go
type IStore interface {
    DB(ctx context.Context, wheres ...where.Where) *gorm.DB
    TX(ctx context.Context, fn func(ctx context.Context) error) error
    User() UserStore
    Post() PostStore
}

type datastore struct{ core *gorm.DB }

func NewStore(db *gorm.DB) *datastore {
    once.Do(func() { S = &datastore{db} })
    return S
}
```

Wire: `wire.NewSet(NewStore, wire.Bind(new(IStore), new(*datastore)))`

## Transaction Pattern

Transactions are passed through context — biz calls `TX`, store calls `DB` transparently:

```go
type transactionKey struct{}

func (s *datastore) TX(ctx context.Context, fn func(ctx context.Context) error) error {
    return s.core.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
        return fn(context.WithValue(ctx, transactionKey{}, tx))
    })
}

func (s *datastore) DB(ctx context.Context, wheres ...where.Where) *gorm.DB {
    db := s.core
    if tx, ok := ctx.Value(transactionKey{}).(*gorm.DB); ok { db = tx }
    for _, w := range wheres { db = w.Where(db) }
    return db.WithContext(ctx)
}
```
## Concrete Store

```go
type userStore struct{ store *datastore }

func (s *userStore) Get(ctx context.Context, userID string) (*model.UserM, error) {
    var obj model.UserM
    if err := s.store.DB(ctx).Where("user_id = ?", userID).First(&obj).Error; err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) { return nil, errno.ErrUserNotFound }
        return nil, errno.ErrDBRead.WithMessage(err.Error())
    }
    return &obj, nil
}
```

Mock generation: `//go:generate mockgen -destination mock_store.go -package store . IStore,UserStore`
## Anti-Patterns

- ❌ Global `*gorm.DB` — inject via `NewStore`, expose only through `IStore`
- ❌ Skipping `PingContext` on startup — fail fast before serving traffic
- ❌ `tx *gorm.DB` as function parameter in biz — pass transaction via context only
- ❌ Unconfigured connection pool — default `MaxOpenConns` is unlimited; always cap it
- ❌ Returning raw GORM errors — translate `gorm.ErrRecordNotFound` → `errno.ErrXxxNotFound`

## References

- [GORM Patterns](references/gorm-patterns.md) — pool tuning, model conventions, generic store, Where Builder
