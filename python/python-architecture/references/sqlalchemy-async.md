# SQLAlchemy Async Reference

## 事务管理

```python
# ✓ 单次操作 — session 自动管理（lifespan 内 commit）
async def create_user(self, data: UserCreate) -> User:
    user = User(username=data.username, email=data.email)
    self._session.add(user)
    await self._session.flush()   # 获取自增 ID，但不 commit
    return user

# ✓ 显式事务 — 多步操作需要原子性
async def transfer(self, from_id: int, to_id: int, amount: Decimal) -> None:
    async with self._session.begin_nested():  # savepoint
        sender = await self._session.get(Account, from_id)
        receiver = await self._session.get(Account, to_id)
        sender.balance -= amount
        receiver.balance += amount
        # 异常自动 rollback savepoint
```

## 关系查询

```python
from sqlalchemy.orm import selectinload, joinedload

# ✓ selectinload — N+1 安全，推荐用于集合关系
result = await self._session.execute(
    select(User)
    .options(selectinload(User.posts))
    .where(User.is_active == True)
)
users = result.scalars().all()

# ✓ joinedload — 推荐用于单值关系（many-to-one）
result = await self._session.execute(
    select(Post)
    .options(joinedload(Post.author))
    .where(Post.id == post_id)
)
post = result.scalar_one_or_none()
```

## 批量操作

```python
# ✓ bulk insert — 比逐条 add 快 10x
from sqlalchemy.dialects.postgresql import insert

async def bulk_create(self, items: list[dict]) -> None:
    await self._session.execute(
        insert(User).on_conflict_do_nothing(),
        items,
    )
    await self._session.flush()

# ✓ bulk update
from sqlalchemy import update

async def deactivate_users(self, user_ids: list[int]) -> None:
    await self._session.execute(
        update(User)
        .where(User.id.in_(user_ids))
        .values(is_active=False)
    )
```

## 分页查询

```python
from sqlalchemy import func, select

async def list_paginated(
    self,
    page: int = 1,
    size: int = 20,
) -> tuple[list[User], int]:
    total_result = await self._session.execute(
        select(func.count()).select_from(User).where(User.is_active == True)
    )
    total = total_result.scalar_one()

    result = await self._session.execute(
        select(User)
        .where(User.is_active == True)
        .order_by(User.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    return result.scalars().all(), total
```

## Model 关系定义

```python
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship, Mapped, mapped_column

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    posts: Mapped[list["Post"]] = relationship("Post", back_populates="author", lazy="noload")

class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    author: Mapped["User"] = relationship("User", back_populates="posts", lazy="noload")
```

用 `lazy="noload"` 防止意外的同步懒加载，在 async 环境下触发 `MissingGreenlet` 错误。

## Run Commands

```bash
# 开发环境启动
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# 生产环境
uvicorn src.main:app --workers 4 --host 0.0.0.0 --port 8000

# 迁移
alembic upgrade head
alembic revision --autogenerate -m "description"
alembic history
alembic current
```
