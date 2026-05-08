---
name: golang-testing
description: Go testing with table-driven tests, mockgen mocks, testify assertions, and benchmarks. Use when writing unit tests, generating mocks for interfaces, setting up test suites, or adding benchmark/fuzz tests in Go projects.
metadata:
  triggers:
    files:
      - 'go.mod'
    keywords:
      - testing
      - mockgen
      - testify
      - assert
      - mock
      - benchmark
      - table-driven
---

# Go Testing

## Table-Driven Tests

```go
func TestIsValidUsername(t *testing.T) {
    t.Parallel()

    tests := []struct {
        name    string
        input   string
        wantErr bool
    }{
        {name: "valid", input: "user_123", wantErr: false},
        {name: "too short", input: "ab", wantErr: true},
        {name: "too long", input: "user_that_is_way_too_long_here", wantErr: true},
        {name: "invalid chars", input: "user*name", wantErr: true},
    }

    for _, tc := range tests {
        t.Run(tc.name, func(t *testing.T) {
            t.Parallel()
            err := isValidUsername(tc.input)
            if tc.wantErr {
                assert.Error(t, err)
            } else {
                assert.NoError(t, err)
            }
        })
    }
}
```

## mockgen Directives

Place `//go:generate` at the top of the file that **defines** the interface:

```go
// biz/biz.go — aggregate interface + mock for the whole layer
//go:generate mockgen -destination mock_biz.go -package biz <module>/internal/apiserver/biz IBiz

// biz/v1/user/user.go — sub-interface mock in same package
//go:generate mockgen -destination mock_user.go -package user <module>/internal/apiserver/biz/v1/user UserBiz

// store/store.go — multiple interfaces in one command
//go:generate mockgen -destination mock_store.go -package store <module>/internal/apiserver/store IStore,UserStore,PostStore
```

Regenerate all mocks:
```bash
go generate ./...
```

## testify Assertions

```go
import (
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

// assert — test continues on failure
assert.Equal(t, expected, actual)
assert.NoError(t, err)
assert.Error(t, err)
assert.NotNil(t, obj)
assert.Nil(t, obj)
assert.Contains(t, slice, elem)
assert.NotPanics(t, func() { doSomething() })
assert.Panics(t, func() { mustPanic() })
assert.IsType(t, &MyStruct{}, result)

// require — test stops immediately on failure (use for fatal preconditions)
require.NoError(t, err)       // stops if err != nil
require.NotNil(t, obj)        // stops if obj == nil
```

Use `require` when subsequent assertions would panic on a nil/zero value.

## TestMain — Test Environment Setup

```go
// log_test.go, biz_test.go, etc.
func TestMain(m *testing.M) {
    log.Init(&log.Options{
        Level:             "debug",
        Format:            "console",
        DisableCaller:     true,
        DisableStacktrace: true,
        OutputPaths:       []string{"stdout"},
    })
    os.Exit(m.Run())
}
```

One `TestMain` per package. Used for: log init, test DB setup, global fixtures.

## Benchmarks

```go
func BenchmarkIsValidUsername(b *testing.B) {
    inputs := []string{"valid_user123", "sh", "in*valid", "user_too_long_example"}

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        for _, input := range inputs {
            isValidUsername(input)
        }
    }
}

// Run with: go test -bench=. -benchmem ./...
```

## Fuzz Tests (Go 1.18+)

```go
func FuzzIsValidUsername(f *testing.F) {
    // Seed corpus
    f.Add("valid_user")
    f.Add("ab")
    f.Add("user*name")

    f.Fuzz(func(t *testing.T, input string) {
        // Must not panic
        _ = isValidUsername(input)
    })
}

// Run with: go test -fuzz=FuzzIsValidUsername -fuzztime=30s
```

## Using Mocks in Tests

```go
func TestUserBiz_Login(t *testing.T) {
    t.Parallel()

    ctrl := gomock.NewController(t)
    // ctrl.Finish() is called automatically in Go 1.14+

    mockStore := mock_store.NewMockIStore(ctrl)
    mockUserStore := mock_store.NewMockUserStore(ctrl)

    mockStore.EXPECT().User().Return(mockUserStore).AnyTimes()
    mockUserStore.EXPECT().
        GetByUsername(gomock.Any(), "alice").
        Return(&model.UserM{UserID: "u1", Password: hashedPwd}, nil)

    biz := userv1.New(mockStore, nil)
    resp, err := biz.Login(context.Background(), &apiv1.LoginRequest{
        Username: "alice", Password: "plaintext",
    })

    require.NoError(t, err)
    assert.NotEmpty(t, resp.Token)
}
```

## Anti-Patterns

- ❌ `assert` in a loop without `t.Run` — failures are hard to identify; use subtests
- ❌ Global mock state shared across tests — use `gomock.NewController(t)` per test
- ❌ Skipping `-race` flag — always run `go test -race ./...` in CI
- ❌ `t.Fatal` / `t.Error` directly — use `require` / `assert` from testify instead
- ❌ `//go:generate` in a separate file — put it in the interface definition file

## References

- [Mock and Table-Driven](references/mock-and-table-driven.md) — full mock setup, gomock matchers, t.Cleanup, parallel patterns
