---
name: python-error-handling
description: Python 异常层级设计、跨层错误传播规范与 FastAPI 全局 HTTP 错误响应。Use when defining custom exceptions, propagating errors across service layers, or mapping domain errors to HTTP status codes in Python projects.
metadata:
  triggers:
    files:
      - 'pyproject.toml'
    keywords:
      - exception
      - error handling
      - HTTPException
      - raise
      - custom exception
      - AppError
---

# Python Error Handling

## Exception Hierarchy

在 `src/core/exceptions.py` 定义基础异常，各 domain 在自己的 `exceptions.py` 扩展：

```python
# src/core/exceptions.py
class AppError(Exception):
    """所有业务异常的基类。"""
    status_code: int = 500
    detail: str = "Internal server error"
    code: str = "INTERNAL_ERROR"

    def __init__(self, detail: str | None = None) -> None:
        self.detail = detail or self.__class__.detail
        super().__init__(self.detail)

class NotFoundError(AppError):
    status_code = 404
    detail = "Resource not found"
    code = "NOT_FOUND"

class ConflictError(AppError):
    status_code = 409
    detail = "Resource already exists"
    code = "CONFLICT"

class UnauthorizedError(AppError):
    status_code = 401
    detail = "Authentication required"
    code = "UNAUTHORIZED"

class ForbiddenError(AppError):
    status_code = 403
    detail = "Permission denied"
    code = "FORBIDDEN"

class ValidationError(AppError):
    status_code = 422
    detail = "Validation failed"
    code = "VALIDATION_ERROR"
```

```python
# src/auth/exceptions.py
from src.core.exceptions import NotFoundError, ConflictError, UnauthorizedError

class UserNotFound(NotFoundError):
    detail = "User not found"
    code = "USER_NOT_FOUND"

class UserAlreadyExists(ConflictError):
    detail = "Username or email already taken"
    code = "USER_ALREADY_EXISTS"

class InvalidCredentials(UnauthorizedError):
    detail = "Invalid username or password"
    code = "INVALID_CREDENTIALS"
```

## Global Exception Handler

```python
# src/core/exceptions.py — handler 定义
from fastapi import Request
from fastapi.responses import JSONResponse

async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.code, "detail": exc.detail},
    )

# src/main.py — 注册
from src.core.exceptions import AppError, app_error_handler
app.add_exception_handler(AppError, app_error_handler)
```

一个全局 handler 覆盖所有 `AppError` 子类——不在每个 endpoint 手写 `try/except`。

## Error Propagation by Layer

```
router (api)
  └── 不 try/except，异常自动传播到全局 handler

service
  ├── 捕获技术性异常（DB、外部 API），转换为业务异常
  └── 直接 raise 业务异常（UserNotFound、InvalidCredentials 等）

repository
  └── 捕获 SQLAlchemy 异常，raise 通用业务异常（ConflictError、NotFoundError）
```

```python
# repository — 捕获 DB 异常，隐藏实现细节
from sqlalchemy.exc import IntegrityError
from src.core.exceptions import ConflictError

async def create(self, **data: Any) -> User:
    try:
        user = User(**data)
        self._session.add(user)
        await self._session.flush()
        return user
    except IntegrityError:
        raise ConflictError()   # ← 不暴露原始 DB 错误

# service — 直接 raise，无需 try/except
async def get_user(self, user_id: int) -> User:
    user = await self._repo.get_by_id(user_id)
    if not user:
        raise UserNotFound()
    return user

# service — 捕获外部服务异常，转换为业务异常
async def send_notification(self, user_id: int) -> None:
    try:
        await self._notifier.send(user_id)
    except NotifierTimeoutError as e:
        logger.error("Notification failed", user_id=user_id, error=str(e))
        raise InternalError("Notification service unavailable")
```

## Error Matching

```python
# ✓ isinstance / except 子类
try:
    user = await service.get_user(user_id)
except NotFoundError:
    ...

# ✓ 多个异常
except (NotFoundError, ForbiddenError):
    ...

# ✓ 访问字段
except AppError as e:
    logger.warning("App error", code=e.code, detail=e.detail)
    raise

# ✗ 字符串比较
except Exception as e:
    if "not found" in str(e): ...   # ❌
```

## Anti-Patterns

- ❌ 在 `router` 里 try/except 返回不同状态码 — 让全局 handler 处理
- ❌ `raise Exception("user not found")` — 用具体异常子类
- ❌ 在 `repository` 里 raise `HTTPException` — repository 不知道 HTTP 协议
- ❌ `except Exception: pass` — 永远不要吞掉异常
- ❌ 原始 DB 错误信息暴露给客户端 — 在 repository 层转换
- ❌ 同一个错误既 log 又 raise 原始异常 — log 技术细节，raise 业务异常

## References

- [Exception Patterns](references/exception-patterns.md) — 完整异常层级、Pydantic ValidationError 集成、测试异常
