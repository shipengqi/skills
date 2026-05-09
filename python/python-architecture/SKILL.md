---
name: python-architecture
description: Python 服务分层架构、SQLAlchemy 2.x async、Alembic 迁移与 FastAPI Depends() 依赖注入。Use when structuring a new Python service, wiring dependencies, defining layer interfaces, or deciding where business logic belongs. Apply whenever user writes SQLAlchemy models with Column() (old style), session.commit() in repositories, or asks about router→service→repository layering, Mapped[] annotations, or FastAPI Depends() wiring.
metadata:
  triggers:
    files:
      - 'pyproject.toml'
    keywords:
      - sqlalchemy
      - alembic
      - repository
      - service layer
      - dependency injection
      - clean architecture
      - layered architecture
---

# Python Architecture

## Layer Structure

```
api (router) → services → repositories → models
```

| 层 | 文件 | 职责 |
|---|---|---|
| `router.py` | `src/<domain>/router.py` | 路由定义、请求绑定、调用 service |
| `service.py` | `src/<domain>/service.py` | 业务规则，协调多个 repository |
| `repository.py` | `src/<domain>/repository.py` | DB 操作，只依赖 SQLAlchemy session |
| `models.py` | `src/<domain>/models.py` | SQLAlchemy ORM 模型，零业务逻辑 |
| `schemas.py` | `src/<domain>/schemas.py` | Pydantic 请求/响应 schema |

**依赖方向**：`router → service → repository → models`，禁止反向或跨层。

## Project Layout

```
src/
  auth/
    router.py          # FastAPI APIRouter
    schemas.py         # Pydantic models (request/response)
    models.py          # SQLAlchemy ORM models
    service.py         # business logic
    repository.py      # DB operations
    dependencies.py    # FastAPI Depends() definitions
    exceptions.py      # domain-specific exceptions
    constants.py
  posts/
    ... (same structure)
  core/
    database.py        # AsyncSession factory
    config.py          # pydantic_settings.BaseSettings
    exceptions.py      # base exceptions + global handlers
  main.py
alembic/
  versions/
  env.py
pyproject.toml
tests/
  auth/
  posts/
  conftest.py
```

## SQLAlchemy 2.x Async

### Engine & Session

```python
# src/core/database.py
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from src.core.config import settings

engine = create_async_engine(str(settings.DATABASE_URL), echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
```

### Model Definition

```python
# src/auth/models.py
import datetime
from sqlalchemy import String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(server_default=func.now())
```

用 `Mapped[]` 注解（SQLAlchemy 2.x 风格），不用旧式 `Column()`。

### Repository Pattern

```python
# src/auth/repository.py
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from .models import User
from src.core.exceptions import ConflictError, NotFoundError

class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: int) -> User | None:
        return await self._session.get(User, user_id)

    async def get_by_username(self, username: str) -> User | None:
        result = await self._session.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()

    async def create(self, **data: Any) -> User:
        try:
            user = User(**data)
            self._session.add(user)
            await self._session.flush()   # flush, not commit — let caller manage tx
            return user
        except IntegrityError:
            raise ConflictError("Username or email already taken")
```

## Dependency Injection — FastAPI Depends()

```python
# src/auth/dependencies.py
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from .repository import UserRepository
from .service import AuthService

def get_user_repository(db: AsyncSession = Depends(get_db)) -> UserRepository:
    return UserRepository(db)

def get_auth_service(
    repo: UserRepository = Depends(get_user_repository),
) -> AuthService:
    return AuthService(repo)
```

FastAPI 在同一请求内缓存 `Depends()` 结果——`get_db` 被多个依赖使用时只调用一次。

## Alembic Migration

```bash
# 初始化（项目创建时一次）
alembic init -t async alembic

# 自动生成迁移
alembic revision --autogenerate -m "add users table"

# 执行迁移
alembic upgrade head

# 回滚一步
alembic downgrade -1
```

```python
# alembic/env.py — 关键配置
from src.core.config import settings
from src.auth.models import Base   # 必须 import 所有 model 才能自动检测

target_metadata = Base.metadata
config.set_main_option("sqlalchemy.url", str(settings.DATABASE_URL))
```

## Anti-Patterns

- ❌ 在 `router` 层直接调用 `repository` — 通过 `service` 中转
- ❌ `session.commit()` 在 repository 内 — 只 `flush()`，事务由调用方管理
- ❌ 在 `models.py` 写业务逻辑 — model 只有字段映射
- ❌ 跨 domain 直接 import repository — 通过对方的 service 调用
- ❌ `Base.metadata.create_all()` 代替 Alembic — 生产环境必须用迁移

## References

- [Project Layout](references/project-layout.md) — 完整目录结构、模块职责说明
- [SQLAlchemy Async](references/sqlalchemy-async.md) — 事务管理、关系查询、批量操作模式
