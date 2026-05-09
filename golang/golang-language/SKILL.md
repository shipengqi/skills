---
name: golang-language
description: Go 语言核心 idioms、命名规范、包结构与接口设计准则。Use when writing or reviewing any Go code — naming conventions, package layout, interface design, enum patterns, anti-patterns, or verifying Go code correctness. Trigger whenever the user writes Go functions, types, packages, or asks about idiomatic Go style.
metadata:
  triggers:
    files:
      - 'go.mod'
    keywords:
      - golang
      - go code
      - idiomatic go
      - go interface
      - go package
      - go struct
      - go naming
      - go enum
      - go iota
      - go anti-pattern
---

# Go Language Standards

## Naming

**Packages** — 短、小写、单数，不含 `_` 或驼峰：
```go
// ✓
package user
package contextx
package errno

// ✗
package userService
package user_handler
```

**Exported symbols** — `PascalCase`；internal — `camelCase`：
```go
type UserBiz interface { ... }   // 导出接口
type userBiz struct { ... }      // 内部实现
func NewUserBiz(...) UserBiz     // 导出构造函数
func (u *userBiz) login(...)     // 内部方法
```

**Errors** — 哨兵用 `ErrXxx`，错误类型用 `XxxError`：
```go
var ErrUserNotFound = &errno.ErrorX{...}
type ValidationError struct { Field string }
```

**不加 `Get` 前缀**（Go 惯例）：
```go
func (b *biz) UserV1() UserBiz { ... }   // ✓ 不是 GetUserV1()
```

## Interfaces

- 接口小而专一：1-2 个方法
- 在**消费方**定义，不在实现方定义
- **必须**在接口同文件加编译期检查：

```go
// 接口定义
type UserBiz interface {
    Create(ctx context.Context, req *CreateUserRequest) (*CreateUserResponse, error)
    Update(ctx context.Context, req *UpdateUserRequest) (*UpdateUserResponse, error)
}

// 编译期检查（确保 userBiz 实现了 UserBiz）
var _ UserBiz = (*userBiz)(nil)
```

## Package Layout

遵循 miniblog 风格的标准布局：

```
cmd/
  <app-name>/
    app/
      config.go       # 配置加载（viper）
      server.go       # 服务启动
      options/        # CLI 选项定义（cobra + pflag）
    main.go
internal/
  <app-name>/         # 业务代码
    handler/          # 表现层：parse → validate → call biz → respond
    biz/              # 业务层：业务规则，依赖 store 接口
    store/            # 数据层：DB/外部服务操作，依赖 model
    model/            # 实体：GORM model，零外部依赖
    wire.go           # Wire 依赖注入定义（wireinject build tag）
    wire_gen.go       # Wire 自动生成，不手写
  pkg/                # 跨模块通用工具
    errno/            # 错误定义
    contextx/         # Context 辅助函数
    log/              # 日志封装
    middleware/       # 中间件
pkg/                  # 可对外暴露的公共包（可选）
```

依赖方向：`handler → biz → store → model`，禁止反向或跨层。

## Enums

用 `const` + `iota`，导出类型，加 `String()` 方法：

```go
type Status int

const (
    StatusActive Status = iota + 1
    StatusInactive
    StatusDeleted
)
```

## Zero Values

利用零值，不写多余的 nil/空值初始化：

```go
// ✓
var mu sync.Mutex
var buf bytes.Buffer
s := &Server{}   // 字段自动零值初始化

// ✗
mu := &sync.Mutex{}
buf := &bytes.Buffer{}
```

## Anti-Patterns

- ❌ `init()` — 用构造函数 `NewXxx()`，`init` 隐式运行且难以测试
- ❌ 全局可变变量 — 通过 Wire/构造函数注入依赖
- ❌ `panic` — 仅在不可恢复的启动错误时使用
- ❌ 忽略错误 `_ = f()` — 必须处理或显式注释原因
- ❌ 空接口参数 `func f(v any)` — 用具体类型或泛型约束
- ❌ 包名与类型名重复（stutter）— `log.Logger` 不是 `log.LogLogger`
- ❌ Goroutine 泄漏 — 所有 goroutine 必须有退出路径，通过 `ctx.Done()` 或 channel 控制
- ❌ `defer` 在循环内 — defer 在函数退出时才执行，循环内累积导致资源未及时释放；改用内部函数包裹

## Verification Workflow

每次写完或修改 Go 代码后依次执行：

1. `mcp__ide__getDiagnostics` — 捕获编译错误和 gopls 类型诊断
2. `go vet ./...` — 检查常见错误（printf 不匹配、不可达代码、变量遮蔽）
3. `goimports -w .` — 修复 import 和格式（一步替代 gofmt）

## References

- [Idioms](references/idioms.md) — iota、零值、接口编译检查代码示例
- [Package Layout](references/package-layout.md) — 标准目录结构与依赖方向详解
