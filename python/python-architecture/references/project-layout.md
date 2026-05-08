# Project Layout Reference

## 完整目录结构

```
myapp/
├── src/
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── router.py          # FastAPI APIRouter — 路由定义
│   │   ├── schemas.py         # Pydantic models (request/response)
│   │   ├── models.py          # SQLAlchemy ORM models
│   │   ├── service.py         # business logic — 依赖 repository
│   │   ├── repository.py      # DB operations — 依赖 SQLAlchemy session
│   │   ├── dependencies.py    # FastAPI Depends() 定义
│   │   ├── exceptions.py      # domain 异常 (UserNotFound, InvalidCredentials)
│   │   └── constants.py       # domain 常量、错误码
│   ├── posts/
│   │   └── ...                # 相同结构
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py          # pydantic_settings.BaseSettings
│   │   ├── database.py        # AsyncSession factory, get_db
│   │   ├── exceptions.py      # AppError 基类 + 全局 handler
│   │   ├── logging.py         # loguru setup_logging
│   │   ├── middleware.py      # logging_middleware, request_id
│   │   └── security.py        # JWT sign/verify
│   └── main.py                # FastAPI app, lifespan, router 注册
├── tests/
│   ├── conftest.py            # 共享 fixtures (db_session, client)
│   ├── auth/
│   │   ├── test_router.py     # endpoint 集成测试
│   │   └── test_service.py    # service 单元测试
│   └── posts/
│       └── ...
├── alembic/
│   ├── versions/              # 迁移脚本
│   └── env.py
├── pyproject.toml
├── .env                       # 本地开发环境变量（不提交）
├── .env.example               # 环境变量模板（提交）
└── alembic.ini
```

## 模块职责边界

| 文件 | 可以 import | 禁止 import |
|---|---|---|
| `router.py` | `schemas`, `service`, `dependencies` | `repository`, `models` 直接 |
| `service.py` | `repository`, `schemas`, `exceptions` | `router`, FastAPI 类型 |
| `repository.py` | `models`, `core.exceptions` | `service`, `schemas`, `FastAPI` |
| `models.py` | SQLAlchemy 类型 | 任何业务模块 |
| `dependencies.py` | `service`, `repository`, FastAPI | — |

## 跨 Domain 调用

```python
# ✓ 通过 service 调用另一个 domain
# posts/service.py
from src.auth.service import AuthService

class PostService:
    def __init__(self, repo: PostRepository, auth_svc: AuthService) -> None:
        self._repo = repo
        self._auth = auth_svc

    async def create(self, user_id: int, data: PostCreate) -> Post:
        user = await self._auth.get_user(user_id)   # 通过 service 调用
        ...

# ✗ 跨 domain 直接 import repository
from src.auth.repository import UserRepository  # ❌
```

## pyproject.toml 完整配置

```toml
[project]
name = "myapp"
version = "1.0.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "sqlalchemy>=2.0",
    "alembic>=1.13",
    "pydantic[email]>=2.0",
    "pydantic-settings>=2.0",
    "loguru>=0.7",
    "httpx>=0.27",
    "aiosqlite>=0.20",        # for SQLite in tests
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "pytest-mock>=3.12",
    "pytest-cov>=5.0",
    "respx>=0.21",
    "ruff>=0.4",
    "pyright>=1.1",
]

[tool.ruff]
line-length = 88
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM", "RUF"]

[tool.pyright]
pythonVersion = "3.12"
typeCheckingMode = "strict"

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
addopts = "--cov=src --cov-report=term-missing --cov-fail-under=80"
```
