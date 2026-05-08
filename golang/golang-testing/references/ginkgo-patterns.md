# Ginkgo Patterns Reference

## Suite File Structure

```
pkg/
  user.go
  user_test.go          # Describe blocks (ginkgo generate user)
  suite_test.go         # bootstrap (ginkgo bootstrap)
```

```go
// suite_test.go
package user_test

import (
    "testing"
    . "github.com/onsi/ginkgo/v2"
    . "github.com/onsi/gomega"
)

func TestUser(t *testing.T) {
    RegisterFailHandler(Fail)
    RunSpecs(t, "User Suite")
}
```

## Ordered Container

Use `Ordered` when specs must run sequentially and share state:

```go
var _ = Describe("database migration", Ordered, func() {
    var db *sql.DB

    BeforeAll(func() { db = openTestDB() })
    AfterAll(func()  { db.Close() })

    It("runs migration v1", func() { Expect(migrateV1(db)).To(Succeed()) })
    It("runs migration v2", func() { Expect(migrateV2(db)).To(Succeed()) })
})
```

`BeforeAll`/`AfterAll` run once for the container; `BeforeEach` still runs per spec.

## uber-go/mock — Full Setup

```go
// store/store.go — place //go:generate next to the interface
//go:generate mockgen -destination mock_store.go -package store \
//   github.com/you/app/internal/store IStore,UserStore,PostStore

type IStore interface {
    User() UserStore
    Post() PostStore
}
```

```bash
go install go.uber.org/mock/mockgen@latest
go generate ./...
```

In tests, always use `GinkgoT()` (not `t`):

```go
ctrl := gomock.NewController(GinkgoT())
mock := mock_store.NewMockIStore(ctrl)
mock.EXPECT().User().Return(mockUserStore).Times(1)
mock.EXPECT().User().Return(mockUserStore).AnyTimes()
mock.EXPECT().Create(gomock.Any(), gomock.AssignableToTypeOf(&model.UserM{})).Return(nil)
```

## Gomega Matcher Reference

```go
// equality
Expect(x).To(Equal(y))
Expect(x).To(BeEquivalentTo(y))   // type-flexible
Expect(x).To(BeNumerically("~", y, delta))

// nil / zero
Expect(x).To(BeNil())
Expect(x).To(BeZero())
Expect(x).NotTo(BeEmpty())

// errors
Expect(err).NotTo(HaveOccurred())
Expect(err).To(MatchError("message"))
Expect(err).To(MatchError(ContainSubstring("partial")))

// collections
Expect(slice).To(ContainElement("x"))
Expect(slice).To(HaveLen(3))
Expect(m).To(HaveKey("key"))
Expect(m).To(HaveKeyWithValue("key", "val"))

// strings
Expect(s).To(ContainSubstring("sub"))
Expect(s).To(HavePrefix("pre"))
Expect(s).To(MatchRegexp(`^\d+$`))

// type assertion
Expect(x).To(BeAssignableToTypeOf(&MyStruct{}))
```

## DescribeTable — Full Pattern

```go
type testCase struct {
    input   string
    want    string
    wantErr bool
}

DescribeTable("ParseEmail",
    func(tc testCase) {
        got, err := ParseEmail(tc.input)
        if tc.wantErr {
            Expect(err).To(HaveOccurred())
            return
        }
        Expect(err).NotTo(HaveOccurred())
        Expect(got).To(Equal(tc.want))
    },
    Entry("valid email",    testCase{input: "a@b.com", want: "a@b.com"}),
    Entry("no @",           testCase{input: "invalid", wantErr: true}),
    Entry("empty",          testCase{input: "",        wantErr: true}),
)
```

## Run Commands

```bash
ginkgo ./...                        # run all suites
ginkgo -r --race                    # recursive, race detector
ginkgo --label-filter="unit"        # filter by label
ginkgo --focus="returns a token"    # focus by spec description
go test -bench=. -benchmem ./...    # run benchmarks
```
