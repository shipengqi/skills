# Dependency Patterns Reference

## 链式 Depends

```python
# src/auth/dependencies.py
from typing import Annotated
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from src.core.database import get_db
from .repository import UserRepository
from .service import AuthService
from .models import User
from .exceptions import UnauthorizedError, ForbiddenError

security = HTTPBearer()

# Layer 1 — DB session
def get_db_session(db = Depends(get_db)):
    return db

# Layer 2 — Repository
def get_user_repo(db = Depends(get_db)) -> UserRepository:
    return UserRepository(db)

# Layer 3 — Service
def get_auth_service(repo: UserRepository = Depends(get_user_repo)) -> AuthService:
    return AuthService(repo)

# Layer 4 — Auth guard
async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    svc: AuthService = Depends(get_auth_service),
) -> User:
    user = await svc.verify_token(credentials.credentials)
    if not user:
        raise UnauthorizedError()
    return user

# Layer 5 — Authorization guard (chains from auth)
async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise ForbiddenError("Admin access required")
    return user

# ✓ Annotated 类型别名 — 减少 router 里的重复
CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_admin)]
```

## 共享 Path 参数 Dependency

```python
# ✓ 验证 post 存在 — 在所有 GET/PUT/DELETE /{post_id} 复用
async def valid_post_id(
    post_id: int,
    svc: PostService = Depends(get_post_service),
) -> Post:
    post = await svc.get(post_id)
    if not post:
        raise PostNotFound()
    return post

# ✓ 验证所有权 — 链式
async def owned_post(
    post: Post = Depends(valid_post_id),
    user: CurrentUser = ...,
) -> Post:
    if post.author_id != user.id:
        raise ForbiddenError("You don't own this post")
    return post

# 使用
@router.put("/{post_id}")
async def update_post(data: PostUpdate, post: Post = Depends(owned_post)):
    ...

@router.delete("/{post_id}")
async def delete_post(post: Post = Depends(owned_post)):
    ...
```

## Depends 缓存行为

FastAPI 在同一个请求内缓存 `Depends()` 的返回值：

```python
# get_db() 只调用一次，即使 3 个 dependency 都 Depends(get_db)
async def dep_a(db = Depends(get_db)) -> ...: ...
async def dep_b(db = Depends(get_db)) -> ...: ...

@router.get("/")
async def route(a = Depends(dep_a), b = Depends(dep_b)):
    # get_db() 实际只调用一次
    ...

# 关闭缓存（罕见场景）
async def route(a = Depends(dep_a), b = Depends(dep_b, use_cache=False)):
    ...
```

## 测试中覆盖 Depends

```python
# tests/conftest.py
@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    # ✓ 覆盖 get_db — 注入测试 session
    app.dependency_overrides[get_db] = lambda: db_session

    # ✓ 覆盖 get_current_user — 跳过 JWT 验证
    test_user = User(id=1, username="testuser", email="test@example.com")
    app.dependency_overrides[get_current_user] = lambda: test_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()
```

## pydantic_settings — 按 Domain 拆分

```python
# ✓ 避免单一 God Settings — 按 domain 拆分
# src/auth/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class AuthSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AUTH_")
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXP_MINUTES: int = 30
    REFRESH_TOKEN_EXP_DAYS: int = 30

auth_settings = AuthSettings()

# src/core/config.py — 只放全局配置
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")
    APP_NAME: str = "myapp"
    ENVIRONMENT: str = "development"
    DATABASE_URL: PostgresDsn
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
```
