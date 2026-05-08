# Exception Patterns Reference

## 完整异常层级

```python
# src/core/exceptions.py
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exception_handlers import http_exception_handler
from fastapi.exceptions import RequestValidationError

class AppError(Exception):
    status_code: int = 500
    detail: str = "Internal server error"
    code: str = "INTERNAL_ERROR"

    def __init__(self, detail: str | None = None) -> None:
        self.detail = detail or self.__class__.detail
        super().__init__(self.detail)

# 4xx 客户端错误
class BadRequestError(AppError):
    status_code = 400
    detail = "Bad request"
    code = "BAD_REQUEST"

class UnauthorizedError(AppError):
    status_code = 401
    detail = "Authentication required"
    code = "UNAUTHORIZED"

class ForbiddenError(AppError):
    status_code = 403
    detail = "Permission denied"
    code = "FORBIDDEN"

class NotFoundError(AppError):
    status_code = 404
    detail = "Resource not found"
    code = "NOT_FOUND"

class ConflictError(AppError):
    status_code = 409
    detail = "Resource already exists"
    code = "CONFLICT"

class ValidationError(AppError):
    status_code = 422
    detail = "Validation failed"
    code = "VALIDATION_ERROR"

# 5xx 服务端错误
class InternalError(AppError):
    status_code = 500
    detail = "Internal server error"
    code = "INTERNAL_ERROR"

class ExternalServiceError(AppError):
    status_code = 502
    detail = "External service unavailable"
    code = "EXTERNAL_SERVICE_ERROR"

# Global handlers
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.code, "detail": exc.detail},
    )

async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "code": "VALIDATION_ERROR",
            "detail": exc.errors()[0]["msg"] if exc.errors() else "Validation failed",
            "errors": exc.errors(),
        },
    )
```

## 注册所有 Handler

```python
# src/main.py
from fastapi.exceptions import RequestValidationError
from src.core.exceptions import AppError, app_error_handler, validation_error_handler

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
```

## Pydantic ValidationError 集成

```python
# Pydantic validator 里 raise ValueError — FastAPI 自动转为 422 响应
from pydantic import BaseModel, field_validator

class UserCreate(BaseModel):
    username: str
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v
```

## 测试异常

```python
# tests/auth/test_service.py
import pytest
from src.auth.exceptions import UserNotFound, InvalidCredentials

async def test_get_user_not_found(mocker) -> None:
    mock_repo = mocker.AsyncMock()
    mock_repo.get_by_id.return_value = None

    svc = UserService(repo=mock_repo)

    with pytest.raises(UserNotFound):
        await svc.get_user(999)

async def test_get_user_returns_code(client: AsyncClient) -> None:
    response = await client.get("/api/v1/users/99999")
    assert response.status_code == 404
    assert response.json()["code"] == "USER_NOT_FOUND"
```

## Domain 异常文件规范

```
src/
  core/
    exceptions.py    # AppError 基类 + 通用子类 + global handlers
  auth/
    exceptions.py    # UserNotFound, UserAlreadyExists, InvalidCredentials
  posts/
    exceptions.py    # PostNotFound, PostAlreadyExists
  payments/
    exceptions.py    # PaymentFailed, InsufficientFunds
```

每个 domain 一个文件，通用异常在 `core/exceptions.py`。
