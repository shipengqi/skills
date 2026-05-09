---
name: python-language
description: Python 核心 idioms、类型注解规范、命名约定与项目工具链（uv + ruff + pyright）。Use when writing or reviewing Python code, especially when creating new modules, defining types, or structuring a project. Apply whenever user writes List[str]/Dict[str,int], Optional[X], str+Enum combination, print() for debug logging, or asks about Python naming conventions, type annotations, or uv/ruff/pyright toolchain.
metadata:
  triggers:
    files:
      - 'pyproject.toml'
    keywords:
      - python
      - type hints
      - pydantic
      - dataclass
      - idiomatic python
      - python idioms
---

# Python Language Standards

## Toolchain

标准工具链：`uv` + `ruff` + `pyright` + Python 3.12+

```toml
# pyproject.toml
[project]
name = "myapp"
requires-python = ">=3.12"

[tool.ruff]
line-length = 88
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]

[tool.pyright]
pythonVersion = "3.12"
typeCheckingMode = "strict"
```

```bash
uv sync                  # install deps
ruff check . --fix       # lint + autofix
ruff format .            # format (replaces black + isort)
pyright                  # type check
```

## Naming

| 对象 | 约定 | 示例 |
|---|---|---|
| 模块 / 包 | `snake_case` | `user_service.py` |
| 类 | `PascalCase` | `class UserService:` |
| 函数 / 方法 | `snake_case` | `def get_user():` |
| 常量 | `SCREAMING_SNAKE_CASE` | `MAX_RETRY = 3` |
| 私有 | 前缀 `_` | `_internal_cache` |
| 类型变量 | 单大写或描述性 | `T`, `UserT` |

不用 `get` 前缀访问属性，用 property：

```python
# ✓
@property
def full_name(self) -> str:
    return f"{self.first} {self.last}"

# ✗
def get_full_name(self) -> str: ...
```

## Type Hints

所有公共函数必须有完整类型注解：

```python
from __future__ import annotations

from collections.abc import Sequence
from typing import TypeVar, Generic

# ✓ Python 3.12+ — union 用 | 而非 Optional/Union
def find_user(user_id: int) -> User | None: ...

# ✓ 集合类型用小写 (PEP 585)
def process(items: list[str]) -> dict[str, int]: ...

# ✓ TypeVar + Generic — 类型安全容器
T = TypeVar("T")

class Repository(Generic[T]):
    async def get(self, id: int) -> T | None: ...
    async def list(self) -> list[T]: ...
```

## Dataclasses vs Pydantic

| 场景 | 选择 |
|---|---|
| 内部数据容器，无验证需求 | `@dataclass` |
| API 请求/响应 schema | `pydantic.BaseModel` |
| 配置 / env vars | `pydantic_settings.BaseSettings` |
| DB 模型 | SQLAlchemy `DeclarativeBase` |

```python
from dataclasses import dataclass

# 内部数据容器
@dataclass
class Pagination:
    page: int = 1
    size: int = 20
    total: int = 0

# API schema
from pydantic import BaseModel, EmailStr, Field

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr
    password: str = Field(min_length=8)
```

## Enums

```python
from enum import StrEnum, IntEnum, auto

class Status(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    DELETED = "deleted"

class Priority(IntEnum):
    LOW = auto()
    MEDIUM = auto()
    HIGH = auto()
```

用 `StrEnum` 而非 `str, Enum` 组合（Python 3.11+，Pydantic 原生支持）。

## Context Managers

```python
# ✓ 自定义 async 上下文管理器
from contextlib import asynccontextmanager

@asynccontextmanager
async def get_db_session():
    async with AsyncSession(engine) as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

## Anti-Patterns

- ❌ 可变默认参数：`def f(items=[])` → 用 `None`，函数体内初始化
- ❌ 裸 `except:` — 至少用 `except Exception:`，不要吞掉异常
- ❌ `type: ignore` 满天飞 — 解决根本问题，或精准注释原因
- ❌ `print()` 调试日志 — 用 `loguru`
- ❌ `from module import *` — 显式 import，保持可追溯
- ❌ 全局可变状态 — 通过构造函数注入依赖
- ❌ `Optional[X]` — 用 `X | None`（Python 3.10+）

## Verification Workflow

每次写完或修改 Python 代码后依次执行：

1. `pyright` — 类型检查
2. `ruff check . --fix` — lint + 自动修复
3. `ruff format .` — 格式化

## References

- [Type Patterns](references/type-patterns.md) — Generic、Protocol、TypedDict、Annotated 代码示例
- [Idioms](references/idioms.md) — 推导式、walrus operator、结构化解包、生成器模式
