# GORM Patterns Reference

## Connection Pool Tuning

```go
sqlDB, _ := db.DB()
sqlDB.SetMaxOpenConns(100)              // cap concurrent connections
sqlDB.SetMaxIdleConns(10)               // idle pool (≤ MaxOpenConns)
sqlDB.SetConnMaxLifetime(10 * time.Minute) // recycle before server timeout
sqlDB.SetConnMaxIdleTime(2 * time.Minute)  // evict long-idle connections
```

| Setting | Typical Value | Rule |
|---------|---------------|------|
| `MaxOpenConns` | 10–100 | `DB.max_connections / num_app_instances` |
| `MaxIdleConns` | 10–25% of MaxOpenConns | Too high wastes memory; too low causes churn |
| `ConnMaxLifetime` | 5–10 min | Less than MySQL/PG `wait_timeout` |
| `ConnMaxIdleTime` | 1–3 min | Reclaim idle connections under low traffic |

## Model Conventions

```go
type UserM struct {
    ID        int64     `gorm:"column:id;primaryKey;autoIncrement:true"`
    UserID    string    `gorm:"column:userID;not null;uniqueIndex:idx_user_userID"`
    Username  string    `gorm:"column:username;not null;uniqueIndex:idx_user_username"`
    CreatedAt time.Time `gorm:"column:createdAt;not null;default:current_timestamp"`
    UpdatedAt time.Time `gorm:"column:updatedAt;not null;default:current_timestamp"`
}

func (m *UserM) TableName() string { return "user" }
```

- Use `M` suffix for model structs: `UserM`, `PostM`
- All columns explicit via `gorm:"column:..."` — never rely on GORM naming convention
- GORM auto-manages `CreatedAt`/`UpdatedAt` when field names match exactly

## GORM Hooks

```go
// BeforeCreate — transform before insert (e.g., hash password)
func (m *UserM) BeforeCreate(tx *gorm.DB) error {
    var err error
    m.Password, err = authn.Encrypt(m.Password)
    return err
}

// AfterCreate — generate domain IDs after auto-increment ID is set
func (m *UserM) AfterCreate(tx *gorm.DB) error {
    m.UserID = rid.UserID.New(uint64(m.ID))
    return tx.Save(m).Error
}
```

## Generic Store (onexstack)

For projects using `github.com/onexstack/onexstack`, a generic store eliminates CRUD boilerplate:

```go
// store/user.go
func NewUserStore(db *gorm.DB, logger ...gormx.Logger) UserStore {
    return genericstore.NewStore[model.UserM](db, logger...)
}
```

Provides `Create`, `Update`, `Delete`, `Get`, `List` automatically.
Use concrete store (manual GORM) when you need custom query logic.

## Where Builder

```go
import "github.com/onexstack/onexstack/pkg/store/where"

// Composable filters
db := store.DB(ctx,
    where.T(ctx),                        // tenant filter (userID from context)
    where.F("username", "admin"),        // field equality
    where.P(0, 10),                      // offset=0, limit=10
)

// In concrete store
func (s *postStore) List(ctx context.Context, opts ...where.Where) ([]*model.PostM, int64, error) {
    var posts []*model.PostM
    var total int64
    db := s.store.DB(ctx, opts...)
    if err := db.Find(&posts).Offset(-1).Limit(-1).Count(&total).Error; err != nil {
        return nil, 0, errno.ErrDBRead.WithMessage(err.Error())
    }
    return posts, total, nil
}
```

## Transaction Usage in Biz Layer

```go
// biz layer — TX wraps the entire multi-step operation
func (b *orderBiz) Place(ctx context.Context, rq *apiv1.PlaceOrderRequest) error {
    return b.store.TX(ctx, func(ctx context.Context) error {
        if err := b.store.Inventory().Deduct(ctx, rq.ItemID, rq.Qty); err != nil {
            return err
        }
        return b.store.Order().Create(ctx, &model.OrderM{...})
    })
}
```

## Mock Generation

```go
//go:generate mockgen -destination mock_store.go -package store \
//   github.com/yourorg/yourapp/internal/apiserver/store \
//   IStore,UserStore,PostStore
```

Run: `go generate ./internal/apiserver/store/...`

Use in tests:
```go
ctrl := gomock.NewController(t)
mockStore := NewMockIStore(ctrl)
mockStore.EXPECT().User().Return(NewMockUserStore(ctrl))
```
