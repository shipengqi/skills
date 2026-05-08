---
name: golang-testing
description: Go testing with Ginkgo BDD suites, Gomega matchers, uber-go/mock mocks, and benchmarks. Use when writing unit tests, generating mocks for interfaces, or setting up test suites in Go projects.
metadata:
  triggers:
    files:
      - 'go.mod'
    keywords:
      - testing
      - ginkgo
      - gomega
      - mock
      - benchmark
---

# Go Testing

## Suite Bootstrap

```go
import (. "github.com/onsi/ginkgo/v2"; . "github.com/onsi/gomega"; "testing")
func TestUser(t *testing.T) { RegisterFailHandler(Fail); RunSpecs(t, "User Suite") }
```

## Describe / Context / It

```go
var _ = Describe("UserBiz", func() {
    var (mockStore *mock_store.MockIStore; biz UserBiz)
    BeforeEach(func() {
        ctrl := gomock.NewController(GinkgoT())
        mockStore = mock_store.NewMockIStore(ctrl)
        biz = New(mockStore)
    })
    It("returns a token on valid login", func() {
        mockStore.EXPECT().User().Return(mockUserStore).AnyTimes()
        mockUserStore.EXPECT().GetByUsername(gomock.Any(), "alice").Return(&model.UserM{}, nil)
        resp, err := biz.Login(ctx, req)
        Expect(err).NotTo(HaveOccurred())
        Expect(resp.Token).NotTo(BeEmpty())
    })
})
```

## DescribeTable (replaces table-driven tests)

```go
DescribeTable("isValidUsername",
    func(input string, wantErr bool) { Expect(isValidUsername(input) != nil).To(Equal(wantErr)) },
    Entry("valid",        "user_123",   false),
    Entry("too short",    "ab",          true),
    Entry("invalid char", "user*name",   true),
)
```

## BeforeSuite / AfterSuite / DeferCleanup

```go
var db *sql.DB
var _ = BeforeSuite(func() { db, _ = sql.Open("postgres", testDSN) })
var _ = AfterSuite(func() { db.Close() })
// DeferCleanup — scoped teardown inside any node:
It("creates user", func() { u := createUser(db); DeferCleanup(deleteUser, db, u.ID) })
```

## Eventually (async assertions)

```go
Eventually(func() string { return getJobStatus(jobID) }, "5s", "200ms").Should(Equal("completed"))
Consistently(func() int { return queue.Len() }, "1s", "100ms").Should(BeZero())
```

## uber-go/mock

```go
//go:generate mockgen -destination mock_store.go -package store <module>/internal/store IStore,UserStore
// go generate ./... — place directive in the file that defines the interface
```

## Benchmarks

```go
func BenchmarkIsValidUsername(b *testing.B) {
    for i := 0; i < b.N; i++ { isValidUsername("valid_user123") }
}
// go test -bench=. -benchmem ./...
```

## Anti-Patterns

- ❌ `gomock.NewController(t)` in Ginkgo — use `GinkgoT()` for proper failure integration
- ❌ Shared mutable state across `It` blocks — reset in `BeforeEach`, not `BeforeSuite`
- ❌ Assertions outside `It`/`BeforeEach` — Ginkgo silently ignores them
- ❌ `//go:generate` in a separate file — put it next to the interface definition
- ❌ Skipping `-race` — always run `go test -race ./...` in CI

## References

- [Ginkgo Patterns](references/ginkgo-patterns.md) — suite structure, Gomega matcher reference, mock setup
