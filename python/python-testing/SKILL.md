---
name: python-testing
description: Python 测试体系——pytest 参数化、pytest-mock fixture、pytest-asyncio 异步测试与 respx HTTP mock。Use when writing unit tests, integration tests, mocking dependencies, or testing async FastAPI endpoints.
metadata:
  triggers:
    files:
      - 'pyproject.toml'
    keywords:
      - pytest
      - pytest-mock
      - pytest-asyncio
      - testing
      - mock
      - fixture
      - test
---

# Python Testing

## Parametrize — 对标 table-driven tests

```python
import pytest

@pytest.mark.parametrize("username,expected_valid", [
    ("valid_user",              True),
    ("ab",                      False),   # too short
    ("user*name",               False),   # invalid chars
    ("a" * 65,                  False),   # too long
    ("valid_123",               True),
])
def test_validate_username(username: str, expected_valid: bool) -> None:
    result = is_valid_username(username)
    assert result == expected_valid
```

## Fixtures — conftest.py

```python
# tests/conftest.py
import pytest
from collections.abc import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from src.main import app
from src.core.database import get_db
from src.auth.models import Base

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(TEST_DB_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        yield session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides[get_db] = lambda: db_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
```

## pytest-mock — 对标 gomock

```python
# ✓ mocker fixture — 比 @patch 装饰器干净
def test_service_calls_repo(mocker) -> None:
    mock_repo = mocker.MagicMock()
    mock_repo.get_by_id.return_value = User(id=1, username="alice")

    svc = UserService(repo=mock_repo)
    result = svc.get_user(1)

    mock_repo.get_by_id.assert_called_once_with(1)
    assert result.username == "alice"

# ✓ AsyncMock for async methods
async def test_login_invalid_credentials(mocker) -> None:
    mock_repo = mocker.AsyncMock()
    mock_repo.get_by_username.return_value = None

    svc = AuthService(repo=mock_repo)
    with pytest.raises(InvalidCredentials):
        await svc.login(LoginIn(username="ghost", password="pw"))

# ✓ mocker.patch — 替换模块级函数
def test_sends_email(mocker) -> None:
    mock_send = mocker.patch("src.auth.service.email_client.send")
    svc.notify_user(user_id=1)
    mock_send.assert_called_once()
```

## pytest-asyncio — Async Tests

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"   # 所有 async test 自动识别，无需 @pytest.mark.asyncio
testpaths = ["tests"]
addopts = "--cov=src --cov-report=term-missing --cov-fail-under=80"
```

```python
# tests/auth/test_router.py
async def test_register_user(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/register", json={
        "username": "newuser",
        "email": "new@example.com",
        "password": "securepassword",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "newuser"
    assert "password" not in data   # 确认密码不泄漏

async def test_register_duplicate(client: AsyncClient) -> None:
    payload = {"username": "alice", "email": "alice@example.com", "password": "pw12345678"}
    await client.post("/api/v1/auth/register", json=payload)  # first
    response = await client.post("/api/v1/auth/register", json=payload)  # duplicate
    assert response.status_code == 409
    assert response.json()["code"] == "USER_ALREADY_EXISTS"
```

## respx — Mock External HTTP

```python
import respx
import httpx

@respx.mock
async def test_external_api_call() -> None:
    respx.get("https://api.example.com/users/1").mock(
        return_value=httpx.Response(200, json={"id": 1, "name": "Alice"})
    )
    result = await external_service.fetch_user(1)
    assert result.name == "Alice"

# ✓ 测试超时/错误场景
@respx.mock
async def test_external_api_timeout() -> None:
    respx.get("https://api.example.com/users/1").mock(side_effect=httpx.TimeoutException)
    with pytest.raises(ExternalServiceError):
        await external_service.fetch_user(1)
```

## Anti-Patterns

- ❌ `@patch` 装饰器嵌套超过 2 层 — 改用 `mocker` fixture 或依赖注入
- ❌ 测试间共享可变 fixture — 用 `function` scope（默认）
- ❌ 真实外部 DB 连接在单元测试 — 用 `dependency_overrides` 注入测试 session
- ❌ `assert response.text == "..."` — 用 `response.json()` 做结构化断言
- ❌ 忽略 `asyncio_mode = "auto"` — 配置后无需每个 async test 加 marker
- ❌ 测试文件命名不含 `test_` 前缀 — pytest 不会自动收集

## References

- [Pytest Patterns](references/pytest-patterns.md) — factory fixtures、conftest 层级、覆盖率配置、完整 service 单元测试示例
