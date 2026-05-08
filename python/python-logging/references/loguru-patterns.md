# Loguru Patterns Reference

## JSON 生产配置

```python
# src/core/logging.py
import sys
from loguru import logger

def setup_logging(level: str = "INFO", json: bool = False) -> None:
    logger.remove()

    if json:
        # 生产环境 — JSON 输出，适合 ELK / Loki / CloudWatch
        logger.add(
            sys.stdout,
            level=level,
            serialize=True,   # 输出 JSON
            backtrace=False,
            diagnose=False,   # 生产关闭诊断，避免泄漏变量值
        )
    else:
        # 开发环境 — 彩色可读格式
        logger.add(
            sys.stdout,
            level=level,
            format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
                   "<level>{level:<8}</level> | "
                   "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
                   "{message}",
            colorize=True,
            backtrace=True,
            diagnose=True,
        )
```

## 文件轮转（长期运行服务）

```python
logger.add(
    "logs/app_{time:YYYY-MM-DD}.log",
    level="INFO",
    serialize=True,
    rotation="00:00",       # 每天午夜轮转
    retention="30 days",    # 保留 30 天
    compression="gz",       # 压缩旧文件
)
```

## Access Log 格式

```python
# src/core/middleware.py — 结构化 access log
async def logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid4()))
    start = time.perf_counter()

    with logger.contextualize(request_id=request_id):
        try:
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            logger.info(
                "HTTP request",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=duration_ms,
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
            )
        except Exception:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            logger.exception(
                "Unhandled exception",
                method=request.method,
                path=request.url.path,
                duration_ms=duration_ms,
            )
            raise

    response.headers["X-Request-ID"] = request_id
    return response
```

## 测试中捕获日志

```python
# conftest.py
import pytest
from loguru import logger

@pytest.fixture
def log_messages(capsys):
    """Capture loguru output in tests."""
    messages = []
    handler_id = logger.add(lambda msg: messages.append(msg), level="DEBUG")
    yield messages
    logger.remove(handler_id)

# test usage
def test_logs_warning_on_slow_query(log_messages) -> None:
    execute_slow_query()
    assert any("slow query" in m for m in log_messages)
```

## structlog — 生产 JSON 管道（进阶）

只有需要与 Python stdlib `logging` 集成或需要严格 processor 链时才引入：

```python
# src/core/logging_structlog.py
import structlog

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

log = structlog.get_logger()

# 使用
log.info("user_created", user_id=42, username="alice")
```

## Run Commands

```bash
# 开发时查看日志
uvicorn src.main:app --reload 2>&1 | head -50

# 生产 JSON 日志解析
uvicorn src.main:app | jq '.message, .level, .request_id'

# 按级别过滤
uvicorn src.main:app | jq 'select(.level == "ERROR")'
```
