---
name: python-fastapi
description: FastAPI 应用搭建——app 初始化、路由分组、Pydantic schema、Depends() 依赖注入与中间件。Use when building FastAPI HTTP servers, adding middleware, defining routes, handling requests, or structuring FastAPI projects. Apply whenever user writes @app.on_event('startup'), defines get_current_user without Annotated type alias, or asks about Depends() caching behavior within a single request.
metadata:
  triggers:
    files:
      - 'pyproject.toml'
    keywords:
      - fastapi
      - APIRouter
      - Depends
      - pydantic
      - BaseModel
      - response_model
      - FastAPI
---

# FastAPI

## App Initialization

```python
# src/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from src.core.config import settings
from src.core.exceptions import AppError, app_error_handler
from src.core.logging import setup_logging
from src.core.middleware import logging_middleware
from src.auth.router import router as auth_router
from src.posts.router import router as posts_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(level=settings.LOG_LEVEL, json=settings.is_production)
    yield
    # cleanup: close connections, flush queues

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.is_development else None,
)

app.add_middleware(CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(BaseHTTPMiddleware, dispatch=logging_middleware)
app.add_exception_handler(AppError, app_error_handler)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(posts_router, prefix="/api/v1")

@app.get("/healthz", tags=["health"])
async def healthz() -> dict[str, str]:
    return {"status": "ok"}
```

## Router Definition

```python
# src/auth/router.py
from fastapi import APIRouter, Depends, status
from .dependencies import get_auth_service, get_current_user, CurrentUser
from .schemas import UserCreate, UserResponse, LoginIn, TokenResponse
from .service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, svc: AuthService = Depends(get_auth_service)):
    return await svc.register(data)

@router.post("/login", response_model=TokenResponse)
async def login(data: LoginIn, svc: AuthService = Depends(get_auth_service)):
    return await svc.login(data)

@router.get("/me", response_model=UserResponse)
async def get_me(user: CurrentUser):
    return user

# ✓ 共用 path 参数 dependency — 避免每个 endpoint 重复验证
@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user: UserResponse = Depends(valid_user_id)):
    return user

@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    data: UserUpdate,
    user: UserResponse = Depends(valid_user_id),
    svc: AuthService = Depends(get_auth_service),
):
    return await svc.update(user, data)
```

## Pydantic Schemas

```python
# src/auth/schemas.py
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict

# ✓ Base + Create + Update + Response 分离
class UserBase(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr

class UserCreate(UserBase):
    password: str = Field(min_length=8)

class UserUpdate(BaseModel):
    username: str | None = Field(None, min_length=3, max_length=64)
    email: EmailStr | None = None

class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)  # ORM mode
    id: int
    created_at: datetime

# ✓ 自定义 BaseSettings 按模块拆分
from pydantic_settings import BaseSettings, SettingsConfigDict

class AuthConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AUTH_")
    JWT_SECRET: str
    JWT_EXP_MINUTES: int = 30
```

## Dependencies — Depends()

```python
# src/auth/dependencies.py
from typing import Annotated
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from src.core.database import get_db
from .repository import UserRepository
from .service import AuthService
from .models import User
from .exceptions import UnauthorizedError

security = HTTPBearer()

def get_user_repository(db = Depends(get_db)) -> UserRepository:
    return UserRepository(db)

def get_auth_service(repo: UserRepository = Depends(get_user_repository)) -> AuthService:
    return AuthService(repo)

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    svc: AuthService = Depends(get_auth_service),
) -> User:
    user = await svc.verify_token(credentials.credentials)
    if not user:
        raise UnauthorizedError()
    return user

# ✓ Annotated 类型别名 — 减少 endpoint 里的重复
CurrentUser = Annotated[User, Depends(get_current_user)]
```

## Middleware

```python
# src/core/middleware.py
import time
from uuid import uuid4
from loguru import logger
from fastapi import Request

async def logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid4()))
    start = time.perf_counter()
    with logger.contextualize(request_id=request_id):
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.info("Request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
        )
    response.headers["X-Request-ID"] = request_id
    return response
```

## Configuration — pydantic_settings

```python
# src/core/config.py
from pydantic import PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    APP_NAME: str = "myapp"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    DATABASE_URL: PostgresDsn
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

settings = Settings()
```

## Anti-Patterns

- ❌ `@app.on_event("startup")` — 已弃用，用 `lifespan` context manager
- ❌ 在 router 函数里直接查 DB — 通过 `Depends()` 注入 service
- ❌ `response_model` 省略 — 始终声明，确保响应 schema 文档化和验证
- ❌ `HTTPException` 在 service/repository 里 raise — 用业务异常，router 以下不知道 HTTP
- ❌ `docs_url="/docs"` 在生产环境 — 生产关闭或加认证保护
- ❌ 全局实例化 service (`svc = AuthService()`) — 通过 `Depends()` 函数返回新实例

## References

- [Router Setup](references/router-setup.md) — 完整路由示例、API 版本管理、BackgroundTasks
- [Dependency Patterns](references/dependency-patterns.md) — 链式 Depends、缓存行为、测试中覆盖依赖
