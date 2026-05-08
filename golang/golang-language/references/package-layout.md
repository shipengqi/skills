# Go Package Layout Reference

标准目录结构与依赖方向，基于 miniblog 风格。

## 标准目录结构

```
<project-root>/
├── cmd/
│   └── <app-name>/
│       ├── app/
│       │   ├── config.go       # viper 配置加载、环境变量绑定
│       │   ├── server.go       # 服务生命周期（Init/Start/Stop）
│       │   └── options/
│       │       └── options.go  # ServerOptions struct + AddFlags + Validate
│       └── main.go             # 仅调用 app.NewApp().Run()
│
├── internal/
│   ├── <app-name>/             # 业务代码（私有）
│   │   ├── handler/            # 表现层
│   │   │   ├── http/           #   Gin handler
│   │   │   └── grpc/           #   gRPC handler（如有）
│   │   ├── biz/                # 业务层
│   │   │   ├── v1/
│   │   │   │   ├── user/       #   用户业务：user.go + mock_user.go
│   │   │   │   └── post/
│   │   │   └── biz.go          #   IBiz 聚合接口
│   │   ├── store/              # 数据层
│   │   │   ├── user.go         #   UserStore 接口 + 实现
│   │   │   ├── store.go        #   IStore 聚合接口
│   │   │   └── mock_store.go   #   mockgen 自动生成
│   │   ├── model/              # 实体层（GORM model，零外部依赖）
│   │   │   ├── user.gen.go     #   gorm gen 自动生成
│   │   │   └── post.gen.go
│   │   ├── pkg/
│   │   │   ├── conversion/     #   类型转换（Request ↔ Model ↔ Response）
│   │   │   └── validation/     #   请求验证逻辑
│   │   ├── wire.go             #   Wire injector 定义（wireinject build tag）
│   │   └── wire_gen.go         #   Wire 自动生成，禁止手动修改
│   │
│   └── pkg/                    # 跨模块通用工具（可被多个 app 使用）
│       ├── errno/              #   错误定义（code.go + 按域拆分）
│       ├── contextx/           #   Context 存取（RequestID、UserID）
│       ├── log/                #   Zap logger 封装
│       ├── middleware/
│       │   ├── gin/            #   Gin 中间件（authn、cors、header 等）
│       │   └── grpc/           #   gRPC interceptor
│       ├── known/              #   常量（Context key、Header key）
│       └── server/             #   服务器基础设施（GenericServer）
│
└── pkg/                        # 对外公开的可复用包（可选）
```

## 依赖方向

```
┌─────────────┐
│   handler   │  ← 表现层：HTTP/gRPC，不含业务逻辑
└──────┬──────┘
       │ 依赖接口 IBiz
       ▼
┌─────────────┐
│     biz     │  ← 业务层：规则、编排，不直接访问 DB
└──────┬──────┘
       │ 依赖接口 IStore
       ▼
┌─────────────┐
│    store    │  ← 数据层：GORM/外部 API，操作 model
└──────┬──────┘
       │ 使用
       ▼
┌─────────────┐
│    model    │  ← 实体层：纯数据结构，零外部依赖
└─────────────┘
```

**禁止的依赖方向**：
- ❌ `biz` 直接导入 `handler` 包
- ❌ `store` 直接导入 `biz` 包
- ❌ `model` 导入任何业务包
- ❌ `handler` 跳过 `biz` 直接访问 `store`

## 接口聚合模式（miniblog 风格）

```go
// biz/biz.go — IBiz 聚合接口
type IBiz interface {
    UserV1() userv1.UserBiz
    PostV1() postv1.PostBiz
}

// store/store.go — IStore 聚合接口
type IStore interface {
    User() UserStore
    Post() PostStore
}
```

handler 通过 `h.biz.UserV1().Create(...)` 访问，层次清晰，便于 Mock。

## Wire 依赖注入

```go
// wire.go（编译时不参与普通构建）
//go:build wireinject

package apiserver

import "github.com/google/wire"

func InitializeWebServer(cfg *Config) (server.Server, error) {
    wire.Build(
        NewWebServer,
        store.ProviderSet,   // 提供 IStore
        biz.ProviderSet,     // 提供 IBiz
        validation.ProviderSet,
        ProvideDB,
    )
    return nil, nil
}
```

```go
// 每层定义 ProviderSet
var ProviderSet = wire.NewSet(
    NewStore,
    wire.Bind(new(IStore), new(*datastore)),
)
```

## 文件命名约定

| 文件 | 用途 |
|------|------|
| `user.go` | UserStore/UserBiz 接口 + 实现 |
| `mock_user.go` | mockgen 自动生成的 Mock |
| `user.gen.go` | gorm gen 自动生成的 Model |
| `wire.go` | Wire injector（wireinject tag） |
| `wire_gen.go` | Wire 生成结果（不手写） |
| `doc.go` | 包级别文档注释 |
| `biz.go` / `store.go` | 聚合接口定义 |

## internal/pkg/errno 结构

```
internal/pkg/errno/
├── code.go        # 通用错误（ErrInternal、ErrNotFound、ErrBind...）
├── user.go        # 用户域错误（ErrUserNotFound、ErrPasswordInvalid...）
└── post.go        # 博客域错误
```

每个错误独立定义，便于精确匹配和国际化扩展。
