---
name: python-logging
description: Python 结构化日志——loguru 日常配置与使用，structlog 生产 JSON 日志管道。Use when initializing loggers, writing log statements, adding request context to logs, or configuring JSON log output in Python projects.
metadata:
  triggers:
    files:
      - 'pyproject.toml'
    keywords:
      - loguru
      - structlog
      - logging
      - structured logging
      - logger
      - log
---

# Python Logging

## loguru — 日常使用（90% 场景）

```python
# src/core/logging.py
import sys
from loguru import logger

def setup_logging(level: str = "INFO", json: bool = False) -> None:
    logger.remove()  # 移除默认 handler
    logger.add(
        sys.stdout,
        level=level,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | {name}:{function}:{line} | {message}",
        serialize=json,   # True → JSON 输出，适合生产
    )

# src/main.py — 在 lifespan 里初始化，最早执行
from src.core.logging import setup_logging
setup_logging(level=settings.LOG_LEVEL, json=settings.is_production)
```

```python
# 使用 — 直接从 loguru import，无需传实例
from loguru import logger

logger.debug("Starting process", count=len(items))
logger.info("User created", user_id=user.id, username=user.username)
logger.warning("Rate limit approaching", remaining=remaining, limit=limit)
logger.error("DB connection failed", error=str(e), host=settings.DB_HOST)
```

## Context Binding — 请求级 logger

```python
# src/core/middleware.py
from uuid import uuid4
from loguru import logger
from fastapi import Request

async def logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid4()))
    with logger.contextualize(request_id=request_id, path=request.url.path):
        response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

# src/main.py
from starlette.middleware.base import BaseHTTPMiddleware
app.add_middleware(BaseHTTPMiddleware, dispatch=logging_middleware)

# service / repository — 直接用 logger，request_id 自动注入到每行日志
logger.info("Fetching user", user_id=user_id)
# 输出: 2024-01-15 10:23:45 | INFO     | ... | Fetching user | request_id=abc-123 user_id=42
```

## When to Log

| 层 | 记录？ | 内容 |
|---|---|---|
| `router` | 否 | 交给中间件 access log |
| `service` | 是（内部错误）| 技术性异常 + 上下文字段 |
| `service` | 否（用户错误）| 直接 raise 业务异常，不记录 |
| `repository` | 否 | raise 异常，不记录 |
| 启动/关闭 | 是 | 监听端口、配置值、数据库连接状态 |

```python
# ✓ service — 记录内部技术错误
async def send_email(self, user_id: int) -> None:
    try:
        await self._email_client.send(...)
    except EmailClientError as e:
        logger.error("Email send failed", user_id=user_id, error=str(e))
        raise InternalError("Failed to send email")

# ✓ service — 用户错误，不记录（安全原因：避免用户名枚举攻击日志）
async def login(self, data: LoginIn) -> TokenResponse:
    user = await self._repo.get_by_username(data.username)
    if not user or not verify_password(data.password, user.hashed_password):
        raise InvalidCredentials()   # ← 不 log
```

## Key-Value Conventions

```python
# ✓ 结构化字段作为 keyword args
logger.info("Order processed", order_id=order.id, amount=order.total, currency="USD")

# ✗ 格式化进 message 字符串
logger.info(f"Order {order.id} processed for {order.total}")  # ❌ 无法被日志系统索引

# ✓ 错误字段统一用 error=
logger.error("Payment failed", error=str(exc), order_id=order_id)

# ✓ 布尔/计数字段用原始类型
logger.info("Cache result", hit=True, count=42)  # ← 不要 str(True)
```

## Anti-Patterns

- ❌ `print()` 代替 logger — 无结构、无级别、无上下文
- ❌ `logging.basicConfig()` 混用 loguru — 选一个，用 loguru
- ❌ f-string 格式化进 message — 用 keyword args 保持结构化
- ❌ 在 repository 层记录日志 — raise 异常，让上层决定
- ❌ 记录密码、token、PII 字段 — 脱敏后再记录
- ❌ `logger.info("err: " + str(e))` — 用 `error=str(e)` keyword

## References

- [Loguru Patterns](references/loguru-patterns.md) — JSON 配置、文件轮转、测试中捕获日志、access log 格式
