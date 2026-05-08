# Router Setup Reference

## 完整路由示例（含版本管理）

```python
# src/main.py — 版本前缀统一在 include_router
from src.auth.router import router as auth_router
from src.posts.router import router as posts_router
from src.users.router import router as users_router

app.include_router(auth_router,  prefix="/api/v1")
app.include_router(posts_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")

# v2 — 新版本独立 router，与 v1 共存
# app.include_router(auth_router_v2, prefix="/api/v2")
```

```python
# src/posts/router.py — 完整示例
from fastapi import APIRouter, Depends, status, Query
from .dependencies import get_post_service, valid_post_id, CurrentUser
from .schemas import PostCreate, PostUpdate, PostResponse, PostListResponse
from .service import PostService

router = APIRouter(prefix="/posts", tags=["posts"])

@router.get("", response_model=PostListResponse)
async def list_posts(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    svc: PostService = Depends(get_post_service),
):
    posts, total = await svc.list(page=page, size=size)
    return PostListResponse(items=posts, total=total, page=page, size=size)

@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    data: PostCreate,
    user: CurrentUser,
    svc: PostService = Depends(get_post_service),
):
    return await svc.create(user_id=user.id, data=data)

@router.get("/{post_id}", response_model=PostResponse)
async def get_post(post: PostResponse = Depends(valid_post_id)):
    return post

@router.put("/{post_id}", response_model=PostResponse)
async def update_post(
    data: PostUpdate,
    post: PostResponse = Depends(valid_post_id),
    user: CurrentUser = ...,
    svc: PostService = Depends(get_post_service),
):
    return await svc.update(post=post, user_id=user.id, data=data)

@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post: PostResponse = Depends(valid_post_id),
    user: CurrentUser = ...,
    svc: PostService = Depends(get_post_service),
):
    await svc.delete(post=post, user_id=user.id)
```

## BackgroundTasks

```python
from fastapi import BackgroundTasks

@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    data: UserCreate,
    background_tasks: BackgroundTasks,
    svc: AuthService = Depends(get_auth_service),
):
    user = await svc.register(data)
    background_tasks.add_task(send_welcome_email, user.email)  # fire-and-forget
    return user
```

**规则**：任务耗时 < 1s 且丢失可接受 → `BackgroundTasks`；需要重试/持久化 → Celery/Arq。

## Health Check & Readiness

```python
# src/main.py
from sqlalchemy import text
from src.core.database import AsyncSessionLocal

@app.get("/healthz", tags=["health"], include_in_schema=False)
async def healthz() -> dict[str, str]:
    return {"status": "ok"}

@app.get("/readyz", tags=["health"], include_in_schema=False)
async def readyz() -> dict[str, str]:
    async with AsyncSessionLocal() as session:
        await session.execute(text("SELECT 1"))
    return {"status": "ready"}
```

## Response Schema — 统一分页格式

```python
# src/core/schemas.py
from pydantic import BaseModel
from typing import Generic, TypeVar

T = TypeVar("T")

class PageResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def create(cls, items: list[T], total: int, page: int, size: int) -> "PageResponse[T]":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=(total + size - 1) // size,
        )

# 使用
@router.get("", response_model=PageResponse[PostResponse])
async def list_posts(page: int = 1, size: int = 20, ...):
    posts, total = await svc.list(page, size)
    return PageResponse.create(posts, total, page, size)
```

## OpenAPI 文档配置

```python
app = FastAPI(
    title="My API",
    description="API description",
    version="1.0.0",
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    openapi_tags=[
        {"name": "auth", "description": "Authentication operations"},
        {"name": "posts", "description": "Post CRUD"},
    ],
)
```
