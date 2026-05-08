# Python Idioms Reference

## 推导式 & 生成器

```python
# ✓ list comprehension
active_users = [u for u in users if u.is_active]

# ✓ dict comprehension
username_map = {u.id: u.username for u in users}

# ✓ generator expression — 懒求值，节省内存
total = sum(order.amount for order in orders if order.status == Status.PAID)

# ✓ 嵌套推导式 — 扁平化
flat = [item for sublist in nested for item in sublist]

# ✗ 多层嵌套推导式 — 改用 for 循环
result = [f(x) for x in [g(y) for y in [h(z) for z in data]]]  # ❌ 难以阅读
```

## 结构化解包

```python
# ✓ tuple unpack
first, *rest = items
head, *middle, tail = items

# ✓ dict merge (Python 3.9+)
merged = {**defaults, **overrides}
merged = defaults | overrides   # 等价，更现代

# ✓ 函数返回多值
def get_range(items: list[int]) -> tuple[int, int]:
    return min(items), max(items)

lo, hi = get_range(data)
```

## Walrus Operator (Python 3.8+)

```python
# ✓ 避免重复计算
if match := pattern.search(text):
    print(match.group(0))

# ✓ while 读取
while chunk := file.read(8192):
    process(chunk)
```

## Dataclass Patterns

```python
from dataclasses import dataclass, field

@dataclass(frozen=True)   # immutable
class Point:
    x: float
    y: float

@dataclass
class Config:
    host: str = "localhost"
    port: int = 8080
    tags: list[str] = field(default_factory=list)  # ✓ 可变默认值用 field
    extra: dict[str, str] = field(default_factory=dict)

# ✓ __post_init__ — 计算字段
@dataclass
class Rectangle:
    width: float
    height: float
    area: float = field(init=False)

    def __post_init__(self) -> None:
        self.area = self.width * self.height
```

## Context Manager — @contextmanager

```python
from contextlib import contextmanager, asynccontextmanager
import time

@contextmanager
def timer(label: str):
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed = (time.perf_counter() - start) * 1000
        print(f"{label}: {elapsed:.2f}ms")

with timer("db query"):
    result = db.execute(query)
```

## functools 工具

```python
from functools import cache, lru_cache, partial

# ✓ @cache — 无界缓存（纯函数）
@cache
def fibonacci(n: int) -> int:
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

# ✓ @lru_cache — 有界缓存
@lru_cache(maxsize=128)
def get_config(key: str) -> str:
    return os.environ[key]

# ✓ partial — 固定部分参数
multiply_by_2 = partial(operator.mul, 2)
```

## 命令式 vs 声明式错误处理

```python
# ✓ EAFP (Easier to Ask Forgiveness than Permission) — Python 风格
try:
    value = d["key"]
except KeyError:
    value = default

# ✓ dict.get — 更简洁
value = d.get("key", default)

# ✓ getattr with default
handler = getattr(obj, method_name, None)
if handler:
    handler()
```
