# ErrorX Patterns Reference

## ErrorX API

```go
import "github.com/onexstack/onexstack/pkg/errorsx"

// Define a sentinel
var ErrUserNotFound = &errorsx.ErrorX{
    Code:    http.StatusNotFound,
    Reason:  "NotFound.UserNotFound",
    Message: "User not found.",
}

// Dynamic message (returns a copy, doesn't mutate sentinel)
err := errno.ErrUserNotFound.WithMessage("user %s not found", username)

// Add structured metadata for debugging
err.WithMetadata(map[string]string{"user_id": uid, "request_id": reqID})
err.KV("trace_id", traceID)  // shorthand for single KV

// Check error type (compares Code + Reason only, not Message)
errno.ErrUserNotFound.Is(someErr)  // → true/false

// Create ad-hoc error (prefer named sentinels when possible)
errx := errorsx.New(500, "InternalError.DBConnection", "DB error: %s", dbErr)
```

## Full Layer Examples

### store/concrete_user.go

```go
func (s *concreteUserStore) Get(ctx context.Context, userID string) (*model.UserM, error) {
    var obj model.UserM
    result := s.db.Where("user_id = ?", userID).First(&obj)
    if result.Error != nil {
        if errors.Is(result.Error, gorm.ErrRecordNotFound) {
            return nil, errno.ErrUserNotFound
        }
        return nil, errno.ErrDBRead.WithMessage(result.Error.Error())
    }
    return &obj, nil
}

func (s *concreteUserStore) Create(ctx context.Context, obj *model.UserM) error {
    if err := s.db.Create(obj).Error; err != nil {
        // map duplicate key to domain error
        if isDuplicateKeyError(err) {
            return errno.ErrUserAlreadyExists
        }
        return errno.ErrDBWrite.WithMessage(err.Error())
    }
    return nil
}
```

### biz/v1/user/user.go

```go
func (b *userBiz) Login(ctx context.Context, rq *apiv1.LoginRequest) (*apiv1.LoginResponse, error) {
    userM, err := b.store.User().GetByUsername(ctx, rq.GetUsername())
    if err != nil {
        // store already returned errno — propagate directly
        return nil, err
    }

    // internal failure: log raw error, return sanitized errno
    if err := authn.Compare(userM.Password, rq.GetPassword()); err != nil {
        log.W(ctx).Errorw("Failed to compare password", "err", err)
        return nil, errno.ErrPasswordInvalid
    }

    tokenStr, expireAt, err := token.Sign(userM.UserID)
    if err != nil {
        log.W(ctx).Errorw("Failed to sign token", "err", err)
        return nil, errno.ErrSignToken
    }

    return &apiv1.LoginResponse{Token: tokenStr, ExpireAt: timestamppb.New(expireAt)}, nil
}
```

### handler/http/user.go

```go
// Handler is ultra-thin — no error handling, no logging
func (h *Handler) Login(c *gin.Context) {
    core.HandleJSONRequest(c, h.biz.UserV1().Login, h.val.ValidateLoginRequest)
}
```

`core.HandleJSONRequest` binds the request, calls biz, and writes the errno-based JSON response automatically.

## errno/code.go Generic Errors

```go
var (
    OK                 = &errorsx.ErrorX{Code: http.StatusOK, Message: ""}
    ErrInternal        = errorsx.ErrInternal       // 500
    ErrNotFound        = errorsx.ErrNotFound        // 404
    ErrBind            = errorsx.ErrBind            // 400 request bind failure
    ErrInvalidArgument = errorsx.ErrInvalidArgument // 400 validation failure
    ErrUnauthenticated = errorsx.ErrUnauthenticated // 401
    ErrPermissionDenied = errorsx.ErrPermissionDenied // 403
    ErrOperationFailed = errorsx.ErrOperationFailed // generic op failure

    // Project-specific generics
    ErrDBRead  = &errorsx.ErrorX{Code: http.StatusInternalServerError, Reason: "InternalError.DBRead", Message: "Database read failure."}
    ErrDBWrite = &errorsx.ErrorX{Code: http.StatusInternalServerError, Reason: "InternalError.DBWrite", Message: "Database write failure."}
)
```

## Reason Field Convention

Format: `"Category.SpecificError"` — PascalCase, no spaces.

| Category prefix | When to use |
|----------------|-------------|
| `NotFound.*` | Resource does not exist |
| `AlreadyExist.*` | Duplicate resource |
| `InvalidArgument.*` | Bad input / validation failure |
| `Unauthenticated.*` | Auth token issues |
| `PermissionDenied.*` | Authorization failure |
| `InternalError.*` | Internal server/DB errors |

## GORM Error Mapping

```go
import (
    "errors"
    "gorm.io/gorm"
)

func mapGORMError(err error, notFoundErr, writeErr *errorsx.ErrorX) error {
    if errors.Is(err, gorm.ErrRecordNotFound) {
        return notFoundErr
    }
    return writeErr.WithMessage(err.Error())
}
```
