# Asyncio Patterns Reference

## Queue — 生产者消费者

```python
import asyncio
from collections.abc import AsyncGenerator

async def producer(queue: asyncio.Queue, items: list[str]) -> None:
    for item in items:
        await queue.put(item)
    await queue.put(None)   # sentinel

async def consumer(queue: asyncio.Queue, results: list[str]) -> None:
    while True:
        item = await queue.get()
        if item is None:
            break
        result = await process(item)
        results.append(result)
        queue.task_done()

async def run_pipeline(items: list[str]) -> list[str]:
    queue: asyncio.Queue = asyncio.Queue(maxsize=50)
    results: list[str] = []

    await asyncio.gather(
        producer(queue, items),
        consumer(queue, results),
    )
    return results
```

## Semaphore — 限制并发数

```python
import asyncio
import httpx

async def fetch_all(urls: list[str], max_concurrent: int = 10) -> list[dict]:
    semaphore = asyncio.Semaphore(max_concurrent)

    async def fetch_one(client: httpx.AsyncClient, url: str) -> dict:
        async with semaphore:
            response = await client.get(url)
            return response.json()

    async with httpx.AsyncClient() as client:
        return await asyncio.gather(*[fetch_one(client, url) for url in urls])
```

## Event — 协调多个协程

```python
async def worker(ready_event: asyncio.Event, name: str) -> None:
    await ready_event.wait()   # 等待信号
    print(f"{name} started")

async def main() -> None:
    ready = asyncio.Event()
    workers = [asyncio.create_task(worker(ready, f"worker-{i}")) for i in range(5)]

    await asyncio.sleep(1)   # do setup
    ready.set()              # 唤醒所有 worker

    await asyncio.gather(*workers)
```

## ProcessPoolExecutor — CPU 密集任务

```python
import asyncio
from concurrent.futures import ProcessPoolExecutor

def cpu_heavy(data: bytes) -> bytes:
    """纯 CPU 操作：加密、压缩、图像处理等。"""
    import zlib
    return zlib.compress(data, level=9)

async def process_async(data: bytes) -> bytes:
    loop = asyncio.get_running_loop()
    with ProcessPoolExecutor() as pool:
        return await loop.run_in_executor(pool, cpu_heavy, data)
```

## asyncio.to_thread vs run_in_executor

```python
# ✓ asyncio.to_thread — 推荐，Python 3.9+，更简洁
result = await asyncio.to_thread(sync_function, arg1, arg2)

# ✓ run_in_executor — 旧版兼容，或需要自定义线程池
loop = asyncio.get_running_loop()
with ThreadPoolExecutor(max_workers=4) as executor:
    result = await loop.run_in_executor(executor, sync_function, arg1)
```

## 超时组合

```python
# ✓ 多个操作共享同一个 timeout
async def handle_request(user_id: int) -> Response:
    async with asyncio.timeout(10.0):   # 整个处理流程不超过 10s
        user = await get_user(user_id)          # 最多用掉部分 budget
        permissions = await get_permissions(user)
        result = await process(user, permissions)
    return result

# ✓ 独立 timeout
async def robust_fetch(url: str) -> dict | None:
    try:
        async with asyncio.timeout(3.0):
            return await http_client.get(url)
    except asyncio.TimeoutError:
        logger.warning("Fetch timed out", url=url)
        return None
```

## 常见错误诊断

| 错误 | 原因 | 修复 |
|---|---|---|
| `RuntimeError: This event loop is already running` | `asyncio.run()` 嵌套 | 用 `await` 或 `nest_asyncio` |
| `MissingGreenlet` | async session 里触发 lazy load | 用 `selectinload` 或 `lazy="noload"` |
| `RuntimeError: Task attached to a different loop` | 跨 event loop 共享任务 | 每个 loop 独立创建资源 |
| Event loop 卡死 | async 函数里调用 blocking I/O | 用 `asyncio.to_thread` |
