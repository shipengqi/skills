---
name: python-async
description: Python asyncio 核心模式——并发任务、blocking 调用陷阱、超时处理与 FastAPI async/sync 选择。Use when writing async Python code, choosing between async and sync functions, handling concurrent tasks, or avoiding event loop blocking.
metadata:
  triggers:
    files:
      - 'pyproject.toml'
    keywords:
      - asyncio
      - async
      - await
      - event loop
      - coroutine
      - asyncio.gather
      - TaskGroup
      - asyncio.to_thread
---

# Python Async

## async/sync 选择原则

| 场景 | 建议 | 原因 |
|---|---|---|
| DB 查询（asyncpg / aiosqlite）| `async def` | I/O 非阻塞 |
| HTTP 请求（httpx）| `async def` | I/O 非阻塞 |
| CPU 密集计算 | `def` + `ProcessPoolExecutor` | GIL 限制，协程无益 |
| 同步第三方库（boto3, requests）| `def` 或 `run_in_executor` | 不能 await |
| 简单数据转换 | `def`（FastAPI 自动用线程池）| 不必要的 async 增加开销 |

## Concurrent Tasks

```python
import asyncio

# ✓ asyncio.gather — 并发执行，等待全部完成
async def get_dashboard(user_id: int) -> Dashboard:
    user, posts, notifications = await asyncio.gather(
        user_service.get(user_id),
        post_service.list_by_user(user_id),
        notification_service.count(user_id),
    )
    return Dashboard(user=user, posts=posts, unread=notifications)

# ✓ TaskGroup (Python 3.11+) — 一个失败则其余自动取消，异常传播更清晰
async def process_batch(items: list[Item]) -> list[Result]:
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(process(item)) for item in items]
    return [t.result() for t in tasks]
```

优先用 `TaskGroup`：异常传播清晰，子任务自动取消，无需 `return_exceptions`。

## Blocking 调用陷阱

```python
# ❌ async 函数里调用 blocking I/O — 卡死整个 event loop
async def bad_route():
    data = requests.get("https://api.example.com")  # ❌ blocking!
    time.sleep(1)                                     # ❌ blocking!

# ✓ 用 asyncio.to_thread 包裹 blocking 调用（Python 3.9+）
async def good_call():
    data = await asyncio.to_thread(requests.get, "https://api.example.com")

# ✓ FastAPI: sync route 自动在 threadpool 运行，blocking I/O 安全
def sync_route():
    data = requests.get("https://api.example.com")   # OK — 独立线程
    return data.json()

# ✓ run_in_threadpool (Starlette) — 在 async route 里调用 sync SDK
from fastapi.concurrency import run_in_threadpool

async def async_route_with_sync_sdk():
    obj = await run_in_threadpool(boto3_client.get_object, Bucket="b", Key="k")
    return obj
```

## Timeout & Cancellation

```python
# ✓ asyncio.timeout (Python 3.11+)
async def fetch_with_timeout(url: str) -> dict:
    async with asyncio.timeout(5.0):
        return await http_client.get(url)

# ✓ 兼容旧版本
async def fetch_compat(url: str) -> dict:
    try:
        return await asyncio.wait_for(http_client.get(url), timeout=5.0)
    except asyncio.TimeoutError:
        raise ExternalServiceError("Request timed out")
```

## Semaphore — 限制并发数

```python
async def fetch_all(urls: list[str]) -> list[dict]:
    semaphore = asyncio.Semaphore(10)  # 最多 10 个并发请求

    async def fetch_one(url: str) -> dict:
        async with semaphore:
            return await http_client.get(url)

    return await asyncio.gather(*[fetch_one(url) for url in urls])
```

## AsyncGenerator — Streaming

```python
from collections.abc import AsyncGenerator

async def stream_records(query: str) -> AsyncGenerator[dict, None]:
    async with db.stream(query) as cursor:
        async for row in cursor:
            yield dict(row)

# FastAPI streaming response
from fastapi.responses import StreamingResponse

@router.get("/export")
async def export_csv():
    async def generate():
        async for row in stream_records("SELECT * FROM users"):
            yield f"{row['id']},{row['username']}\n"
    return StreamingResponse(generate(), media_type="text/csv")
```

## anyio — FastAPI 集成说明

FastAPI/Starlette 底层用 `anyio`。直接写 `asyncio` 代码在 FastAPI 里完全没问题；只有写**库**（需要兼容 trio）或**测试**时才需要显式使用 anyio：

```python
# pytest 里可用 anyio 代替 pytest-asyncio（可选）
import pytest

@pytest.mark.anyio
async def test_something():
    await some_async_function()
```

## Anti-Patterns

- ❌ `async def` 函数体内无任何 `await` — 这只是普通函数，不会并发执行
- ❌ `asyncio.run()` 嵌套调用 — 不能在已有 event loop 里调用 `asyncio.run()`
- ❌ `time.sleep()` 在 async 函数 — 用 `await asyncio.sleep()`
- ❌ `asyncio.gather(*tasks)` 不处理异常 — 用 `return_exceptions=True` 或 `TaskGroup`
- ❌ 全局 `asyncio.get_event_loop()` — 用 `asyncio.get_running_loop()` 或 `asyncio.run()`
- ❌ CPU 密集任务用协程 — GIL 无法并行，用 `ProcessPoolExecutor`

## References

- [Asyncio Patterns](references/asyncio-patterns.md) — Queue 生产消费、事件通知、进程池 CPU 任务示例
