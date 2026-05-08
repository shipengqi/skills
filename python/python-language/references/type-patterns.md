# Type Patterns Reference

## Protocol — Structural Subtyping

Protocol 是 Python 的 structural typing，对标 Go 的隐式接口实现：

```python
from typing import Protocol, runtime_checkable

# 定义协议 — 消费方声明，不在实现方
@runtime_checkable
class Notifier(Protocol):
    async def send(self, user_id: int, message: str) -> None: ...

# 实现方无需继承 Protocol
class EmailNotifier:
    async def send(self, user_id: int, message: str) -> None:
        await email_client.send(user_id, message)

class SMSNotifier:
    async def send(self, user_id: int, message: str) -> None:
        await sms_client.send(user_id, message)

# 消费方只依赖 Protocol
class NotificationService:
    def __init__(self, notifier: Notifier) -> None:
        self._notifier = notifier

# 编译期检查 (类似 Go 的 var _ Interface = (*impl)(nil))
_: Notifier = EmailNotifier()
```

## TypedDict — Typed Dictionaries

```python
from typing import TypedDict, NotRequired

class UserDict(TypedDict):
    id: int
    username: str
    email: str
    role: NotRequired[str]   # optional key

def process(user: UserDict) -> str:
    return f"{user['username']} <{user['email']}>"
```

## Generic Repository

```python
from typing import TypeVar, Generic
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase

ModelT = TypeVar("ModelT", bound=DeclarativeBase)

class BaseRepository(Generic[ModelT]):
    model: type[ModelT]

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, id: int) -> ModelT | None:
        return await self._session.get(self.model, id)

    async def delete(self, id: int) -> None:
        obj = await self.get_by_id(id)
        if obj:
            await self._session.delete(obj)

class UserRepository(BaseRepository[User]):
    model = User

    async def get_by_email(self, email: str) -> User | None:
        ...
```

## Annotated — 附加元数据

```python
from typing import Annotated
from fastapi import Depends, Query

# ✓ 类型别名 — 减少 endpoint 里重复的 Depends
CurrentUser = Annotated[User, Depends(get_current_user)]
PageSize = Annotated[int, Query(ge=1, le=100, default=20)]

@router.get("/users")
async def list_users(user: CurrentUser, size: PageSize) -> list[UserResponse]:
    ...
```

## ParamSpec — 高阶函数类型

```python
from typing import ParamSpec, Callable, TypeVar
import functools

P = ParamSpec("P")
R = TypeVar("R")

def log_call(func: Callable[P, R]) -> Callable[P, R]:
    @functools.wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        print(f"Calling {func.__name__}")
        return func(*args, **kwargs)
    return wrapper
```

## Type Narrowing

```python
from typing import assert_never

def handle_status(status: Status) -> str:
    match status:
        case Status.ACTIVE:
            return "active"
        case Status.INACTIVE:
            return "inactive"
        case Status.DELETED:
            return "deleted"
        case _ as unreachable:
            assert_never(unreachable)  # pyright 会在有遗漏时报错
```
