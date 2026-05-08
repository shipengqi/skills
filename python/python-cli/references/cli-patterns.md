# CLI Patterns Reference

## 配置文件集成

```python
# src/cli/main.py — 支持 .env 和配置文件
import typer
from pathlib import Path
from typing import Annotated
from src.core.config import Settings

app = typer.Typer(no_args_is_help=True)

# ✓ 全局 --config 选项
@app.callback()
def configure(
    config: Annotated[
        Path | None,
        typer.Option("--config", "-c", help="Config file path", envvar="MYAPP_CONFIG"),
    ] = None,
) -> None:
    """MyApp CLI — manage and deploy."""
    if config:
        # 加载自定义配置
        import os
        os.environ["ENV_FILE"] = str(config)
```

## 交互式 Prompt

```python
@app.command()
def init(
    name: Annotated[str | None, typer.Option(prompt="Project name")] = None,
    db_url: Annotated[str | None, typer.Option(
        prompt="Database URL",
        hide_input=False,
    )] = None,
    overwrite: bool = False,
) -> None:
    """Initialize a new project."""
    # prompt=True 时如果用户没传值则交互式询问
    if not overwrite and Path("config.yaml").exists():
        if not typer.confirm("Config exists. Overwrite?"):
            raise typer.Abort()
    typer.echo(f"Initializing {name}...")
```

## 完整测试示例

```python
# tests/cli/test_deploy.py
import pytest
from typer.testing import CliRunner
from src.cli.main import app

runner = CliRunner()

def test_deploy_dry_run() -> None:
    result = runner.invoke(app, ["deploy", "dev", "--dry-run"])
    assert result.exit_code == 0
    assert "DRY RUN" in result.output

def test_deploy_invalid_env() -> None:
    result = runner.invoke(app, ["deploy", "invalid-env"])
    assert result.exit_code != 0

def test_deploy_prod_requires_confirm(monkeypatch) -> None:
    # 模拟用户输入 "y"
    result = runner.invoke(app, ["deploy", "prod"], input="y\n")
    assert result.exit_code == 0

def test_export_missing_output() -> None:
    result = runner.invoke(app, ["export"])
    assert result.exit_code == 2   # typer missing argument exit code
    assert "Missing argument" in result.output
```

## Rich 集成 — 表格 & 树形输出

```python
# ✓ Rich + Typer 组合 — 更丰富的终端输出
from rich.console import Console
from rich.table import Table
from rich import print as rprint

console = Console()

@app.command()
def list_users() -> None:
    """List all users."""
    users = fetch_users()

    table = Table(title="Users", show_header=True, header_style="bold blue")
    table.add_column("ID",       style="dim", width=6)
    table.add_column("Username", min_width=12)
    table.add_column("Email")
    table.add_column("Status",   justify="center")

    for user in users:
        status_color = "green" if user.is_active else "red"
        table.add_row(
            str(user.id),
            user.username,
            user.email,
            f"[{status_color}]{user.status}[/{status_color}]",
        )

    console.print(table)
```

## async 命令

```python
# Typer 本身是同步的；async 命令需要手动 asyncio.run
import asyncio

@app.command()
def migrate(version: str | None = None) -> None:
    """Run database migrations."""
    asyncio.run(_migrate(version))

async def _migrate(version: str | None) -> None:
    from src.core.database import engine
    from alembic.config import Config
    from alembic import command

    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, version or "head")
    typer.echo(typer.style("Migration complete", fg=typer.colors.GREEN))
```

## pyproject.toml — 多命令入口

```toml
[project.scripts]
myapp     = "src.cli.main:main"
myapp-db  = "src.cli.db:main"     # 独立 db 工具
myapp-etl = "src.cli.etl:main"    # 独立 ETL 工具

[project.optional-dependencies]
cli = [
    "typer>=0.12",
    "rich>=13.0",
]
```

## Run Commands

```bash
# 开发时直接运行（不需要安装）
uv run python -m src.cli.main --help
uv run python -m src.cli.main deploy dev --dry-run

# 安装后运行
uv pip install -e ".[cli]"
myapp --help
myapp users list
myapp db migrate

# 测试 CLI
uv run pytest tests/cli/ -v
```
