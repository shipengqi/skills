---
name: golang-error-handling
description: Go error handling using ErrorX sentinel pattern and errno directory structure. Use when defining errors, wrapping errors, propagating errors across layers, or checking error types in Go projects.
metadata:
  triggers:
    files:
      - 'go.mod'
    keywords:
      - errno
      - ErrorX
      - error handling
      - error wrapping
      - errors.Is
      - errors.As
---

# Go Error Handling

## ErrorX Sentinel Pattern

All errors are defined as `*errorsx.ErrorX` sentinels in `internal/pkg/errno/`:

```go
// internal/pkg/errno/user.go
var (
    ErrUserNotFound = &errorsx.ErrorX{
        Code:    http.StatusNotFound,
        Reason:  "NotFound.UserNotFound",
        Message: "User not found.",
    }
    ErrUserAlreadyExists = &errorsx.ErrorX{
        Code:    http.StatusBadRequest,
        Reason:  "AlreadyExist.UserAlreadyExists",
        Message: "User already exists.",
    }
)
```

- `Code` — HTTP status code
- `Reason` — `"Domain.SpecificReason"` format, machine-readable, used for `Is()` matching
- `Message` — human-readable default message

## Dynamic Messages

Use `.WithMessage()` when you need to add runtime context:

```go
// ✓ wrap with dynamic detail
return nil, errno.ErrDBRead.WithMessage(err.Error())
return nil, errno.ErrUsernameInvalid.WithMessage("Username is too short")

// ✗ don't fmt.Errorf wrap business errors
return nil, fmt.Errorf("user not found: %w", err)
```

## Error Propagation by Layer

```
handler (ultra-thin, no manual error handling)
  └── core.HandleJSONRequest — writes response, catches all errors

biz layer
  ├── internal errors: log.W(ctx).Errorw("reason", "err", err) + return errno.ErrXxx
  └── user-visible errors: return errno.ErrXxx (no log)

store layer
  └── no logging — return errno.ErrDBRead.WithMessage(err.Error())
```

**Rule**: Log the raw technical error where you have context; always return an `errno` sentinel (never raw errors from biz/store up).

```go
// biz — internal failure: log raw err, return sanitized errno
if err := authn.Compare(userM.Password, rq.GetPassword()); err != nil {
    log.W(ctx).Errorw("Failed to compare password", "err", err)
    return nil, errno.ErrPasswordInvalid  // ← sanitized, no raw err exposed
}

// store — no log, wrap with errno
result := db.First(&obj, opts)
if result.Error != nil {
    if errors.Is(result.Error, gorm.ErrRecordNotFound) {
        return nil, errno.ErrPostNotFound
    }
    return nil, errno.ErrDBRead.WithMessage(result.Error.Error())
}
```

## Error Matching

Use `.Is()` method (compares Code + Reason, ignores Message):

```go
if errno.ErrUserNotFound.Is(err) { ... }   // ✓ errno.Is() method
if errors.Is(err, gorm.ErrRecordNotFound)  // ✓ stdlib errors.Is() for external libs
```

`errors.As()` for extracting error type from external libraries (DB, IO):

```go
var pgErr *pgconn.PgError
if errors.As(err, &pgErr) && pgErr.Code == "23505" {
    return nil, errno.ErrUserAlreadyExists
}
```

**Never** use string comparison: `strings.Contains(err.Error(), "not found")` ❌

## errno Directory Structure

```
internal/pkg/errno/
├── code.go    # generic errors: ErrInternal, ErrNotFound, ErrBind, ErrInvalidArgument, ErrUnauthenticated
├── user.go    # user domain: ErrUsernameInvalid, ErrPasswordInvalid, ErrUserNotFound, ErrUserAlreadyExists
└── post.go    # post domain: ErrPostNotFound, ErrPostAlreadyExists
```

One file per domain. Generic cross-domain errors live in `code.go`.

## Anti-Patterns

- ❌ `return nil, err` — raw errors leak implementation details; always wrap with errno
- ❌ `log.Errorw(...); return nil, err` — double-expose: logs raw, also returns raw
- ❌ `fmt.Errorf("...: %w", err)` for business errors — use errno sentinel + `.WithMessage()`
- ❌ `strings.Contains(err.Error(), "not found")` — use `errors.Is`/`errors.As` or `.Is()`
- ❌ Defining errors inline: `errors.New("user not found")` — all errors go in `errno/`

## References

- [ErrorX Patterns](references/errorx-patterns.md) — full ErrorX API, Is/As usage, gorm error mapping
