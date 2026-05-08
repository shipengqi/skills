# Pytest Patterns Reference

## Factory Fixtures

```python
# tests/conftest.py
import pytest
from collections.abc import AsyncGenerator
from typing import Any
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from src.main import app
from src.core.database import get_db
from src.auth.models import Base

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"

@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
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

# ✓ factory fixture — 创建多个实体
@pytest.fixture
def make_user(db_session: AsyncSession):
    async def _make_user(**kwargs: Any) -> User:
        defaults = {"username": "testuser", "email": "test@example.com", "hashed_password": "hashed"}
        user = User(**{**defaults, **kwargs})
        db_session.add(user)
        await db_session.flush()
        return user
    return _make_user
```

## conftest 层级

```
tests/
  conftest.py          # 全局 fixtures: db_session, client
  auth/
    conftest.py        # auth-specific fixtures: authenticated_client, test_user
    test_router.py
    test_service.py
  posts/
    conftest.py
    test_router.py
```

```python
# tests/auth/conftest.py
import pytest
from httpx import AsyncClient

@pytest.fixture
async def test_user(make_user) -> User:
    return await make_user(username="alice", email="alice@example.com")

@pytest.fixture
async def authenticated_client(client: AsyncClient, test_user: User) -> AsyncClient:
    response = await client.post("/api/v1/auth/login", json={
        "username": "alice",
        "password": "testpassword",
    })
    token = response.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return client
```

## 完整 Service 单元测试示例

```python
# tests/auth/test_service.py
import pytest
from src.auth.service import AuthService
from src.auth.exceptions import UserNotFound, InvalidCredentials, UserAlreadyExists
from src.auth.schemas import UserCreate, LoginIn

@pytest.mark.parametrize("username,email,raises", [
    ("alice", "alice@example.com", False),
    ("", "bad@example.com", True),        # empty username
    ("alice", "not-an-email", True),      # invalid email
])
async def test_register_validation(
    username: str,
    email: str,
    raises: bool,
    mocker,
) -> None:
    mock_repo = mocker.AsyncMock()
    svc = AuthService(repo=mock_repo)
    data = UserCreate(username=username, email=email, password="securepass123")
    if raises:
        with pytest.raises(Exception):
            await svc.register(data)
    else:
        await svc.register(data)
        mock_repo.create.assert_called_once()

async def test_login_user_not_found(mocker) -> None:
    mock_repo = mocker.AsyncMock()
    mock_repo.get_by_username.return_value = None
    svc = AuthService(repo=mock_repo)

    with pytest.raises(InvalidCredentials):
        await svc.login(LoginIn(username="ghost", password="pw12345678"))

async def test_login_wrong_password(mocker) -> None:
    mock_repo = mocker.AsyncMock()
    mock_repo.get_by_username.return_value = User(
        id=1, username="alice", hashed_password="$hashed$"
    )
    svc = AuthService(repo=mock_repo)

    with pytest.raises(InvalidCredentials):
        await svc.login(LoginIn(username="alice", password="wrongpassword"))
```

## Coverage 配置

```toml
# pyproject.toml
[tool.coverage.run]
source = ["src"]
omit = ["src/core/migrations/*", "*/tests/*"]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise NotImplementedError",
    "if TYPE_CHECKING:",
]
```

## Run Commands

```bash
# 全部测试
uv run pytest

# 单个文件
uv run pytest tests/auth/test_service.py -v

# 指定测试
uv run pytest tests/auth/test_service.py::test_login_user_not_found -v

# 覆盖率报告
uv run pytest --cov=src --cov-report=html
open htmlcov/index.html

# 只跑失败的测试
uv run pytest --lf

# 并行（pytest-xdist）
uv run pytest -n auto
```
