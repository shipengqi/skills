# Go Idioms Reference

常用 Go 惯用法代码示例，供快速参考。

## 接口编译期检查

```go
// 在接口定义的同一文件，紧随 struct 定义之后
type UserBiz interface {
    Create(ctx context.Context, req *apiv1.CreateUserRequest) (*apiv1.CreateUserResponse, error)
}

type userBiz struct {
    store store.IStore
}

// 编译期检查：若 userBiz 未实现 UserBiz，编译立即报错
var _ UserBiz = (*userBiz)(nil)

func NewUserBiz(store store.IStore) UserBiz {
    return &userBiz{store: store}
}
```

## iota 枚举

```go
type ServerMode string

const (
    GinServerMode         ServerMode = "gin"
    GRPCServerMode        ServerMode = "grpc"
    GRPCGatewayServerMode ServerMode = "grpc-gateway"
)

// 数值型枚举
type Status int

const (
    StatusActive   Status = iota + 1  // 从 1 开始，避免零值歧义
    StatusInactive
    StatusDeleted
)

func (s Status) String() string {
    switch s {
    case StatusActive:
        return "active"
    case StatusInactive:
        return "inactive"
    default:
        return "deleted"
    }
}
```

## 零值利用

```go
// sync 原语：直接声明，零值即可用
var mu sync.Mutex
var once sync.Once
var wg sync.WaitGroup

// bytes.Buffer：零值即可用
var buf bytes.Buffer
buf.WriteString("hello")

// struct 零值初始化：不写多余字段
type Config struct {
    Timeout  time.Duration  // 零值 0，调用方按需覆盖
    MaxRetry int            // 零值 0
    Debug    bool           // 零值 false
}
cfg := &Config{Timeout: 5 * time.Second}  // 只设非默认值
```

## 构造函数模式

```go
// 导出接口，隐藏实现
type Logger interface {
    Infow(msg string, kvs ...any)
    Errorw(msg string, kvs ...any)
    W(ctx context.Context) Logger
}

type zapLogger struct {
    z *zap.Logger
}

var _ Logger = (*zapLogger)(nil)

// New 返回接口，不暴露 *zapLogger
func New(opts *Options) Logger {
    // ...构建 zap.Logger...
    return &zapLogger{z: z}
}
```

## 函数选项模式（Option Pattern）

```go
type ServerOption func(*Server)

func WithTimeout(d time.Duration) ServerOption {
    return func(s *Server) { s.timeout = d }
}

func WithMaxConn(n int) ServerOption {
    return func(s *Server) { s.maxConn = n }
}

func NewServer(opts ...ServerOption) *Server {
    s := &Server{timeout: 30 * time.Second, maxConn: 100}  // 默认值
    for _, opt := range opts {
        opt(s)
    }
    return s
}
```

## Slice 预分配

```go
// ✓ 已知容量时预分配
result := make([]User, 0, len(users))
for _, u := range users {
    result = append(result, transform(u))
}

// ✓ 固定大小时直接指定长度
ids := make([]string, len(users))
for i, u := range users {
    ids[i] = u.ID
}
```

## Context 传递规范

```go
// Context 始终是第一个参数
func (s *userStore) Get(ctx context.Context, userID string) (*model.UserM, error) {
    // 从 context 提取追踪字段用于日志
    log.W(ctx).Infow("Getting user", "userID", userID)
    // ...
}

// 不在 struct 中存储 Context
// ✗ type Server struct { ctx context.Context }
// ✓ func (s *Server) Handle(ctx context.Context, req *Request) error
```

## defer 清理

```go
func processFile(path string) error {
    f, err := os.Open(path)
    if err != nil {
        return fmt.Errorf("open file: %w", err)
    }
    defer f.Close()  // 紧跟资源获取，不要忘记

    // 处理文件...
    return nil
}
```
