---
name: python-cli
description: Typer CLI 应用构建——命令定义、子命令、选项与参数、进度条与错误处理。Use when building command-line tools, adding subcommands, parsing arguments, or structuring a CLI application in Python.
metadata:
  triggers:
    files:
      - 'pyproject.toml'
    keywords:
      - typer
      - click
      - CLI
      - command line
      - argparse
      - typer.Typer
      - typer.Option
      - typer.Argument
---

# Python CLI — Typer

## App Setup

```python
# src/cli/main.py
import typer
from typing import Annotated

app = typer.Typer(
    name="myapp",
    help="My application CLI",
    no_args_is_help=True,   # 无参数时显示 help
)

# 入口
def main() -> None:
    app()

if __name__ == "__main__":
    main()
```

```toml
# pyproject.toml — 注册 CLI 命令
[project.scripts]
myapp = "src.cli.main:main"
```

安装后直接运行 `myapp`，无需 `python -m`。

## 命令定义

```python
# ✓ 函数签名即 CLI 接口 — 类型注解自动生成 help
@app.command()
def deploy(
    env: Annotated[str, typer.Argument(help="Target environment (dev/staging/prod)")],
    dry_run: Annotated[bool, typer.Option("--dry-run", help="Preview changes without applying")] = False,
    workers: Annotated[int, typer.Option("--workers", "-w", help="Number of workers")] = 4,
) -> None:
    """Deploy application to the target environment."""
    if dry_run:
        typer.echo(f"[DRY RUN] Would deploy to {env} with {workers} workers")
        return
    typer.echo(f"Deploying to {env}...")

# ✓ 必填 Argument vs 可选 Option
@app.command()
def export(
    output: Annotated[str, typer.Argument(help="Output file path")],        # 必填位置参数
    format: Annotated[str, typer.Option(help="Output format")] = "csv",     # 可选，有默认值
    limit: Annotated[int | None, typer.Option(help="Max rows")] = None,     # 可选，无默认值
) -> None:
    """Export data to file."""
    ...
```

## 子命令 — 嵌套 Typer

```python
# src/cli/main.py
import typer
from src.cli import users, db

app = typer.Typer(no_args_is_help=True)
app.add_typer(users.app, name="users", help="User management commands")
app.add_typer(db.app,    name="db",    help="Database commands")

# src/cli/users.py
app = typer.Typer(no_args_is_help=True)

@app.command("list")
def list_users(
    active_only: Annotated[bool, typer.Option("--active")] = False,
) -> None:
    """List all users."""
    ...

@app.command("create")
def create_user(
    username: Annotated[str, typer.Argument()],
    email: Annotated[str, typer.Option("--email", "-e", prompt=True)],
) -> None:
    """Create a new user."""
    ...
```

```bash
myapp users list --active
myapp users create alice --email alice@example.com
myapp db migrate
```

## 枚举选项

```python
from enum import StrEnum

class Environment(StrEnum):
    DEV     = "dev"
    STAGING = "staging"
    PROD    = "prod"

@app.command()
def deploy(
    env: Annotated[Environment, typer.Argument()],
) -> None:
    """Deploy to environment."""
    match env:
        case Environment.PROD:
            if not typer.confirm("Deploy to PRODUCTION?"):
                raise typer.Abort()
        case _:
            pass
    typer.echo(f"Deploying to {env}...")
```

Typer 自动限制合法值并在 `--help` 里展示枚举列表。

## 进度条 & 输出样式

```python
import time

@app.command()
def process(
    files: Annotated[list[str], typer.Argument()],
) -> None:
    """Process multiple files."""
    with typer.progressbar(files, label="Processing") as progress:
        for f in progress:
            time.sleep(0.1)   # simulate work

# ✓ 彩色输出
typer.echo(typer.style("✓ Success", fg=typer.colors.GREEN, bold=True))
typer.echo(typer.style("✗ Error",   fg=typer.colors.RED))
typer.echo(typer.style("! Warning", fg=typer.colors.YELLOW))

# ✓ stderr — 错误信息走 stderr，不污染 stdout 管道
typer.echo("Error: file not found", err=True)
```

## 错误处理

```python
@app.command()
def migrate(
    version: Annotated[str | None, typer.Argument()] = None,
) -> None:
    """Run database migrations."""
    try:
        run_migration(version)
        typer.echo(typer.style("Migration complete", fg=typer.colors.GREEN))
    except MigrationError as e:
        typer.echo(f"Migration failed: {e}", err=True)
        raise typer.Exit(code=1)   # ← 非零退出码，CI 可以检测
```

## 文件 & Path 参数

```python
from pathlib import Path

@app.command()
def convert(
    input_file: Annotated[Path, typer.Argument(exists=True, readable=True)],
    output_file: Annotated[Path, typer.Argument(writable=True)],
    overwrite: Annotated[bool, typer.Option("--force", "-f")] = False,
) -> None:
    """Convert input file to output format."""
    if output_file.exists() and not overwrite:
        typer.echo(f"Output file exists. Use --force to overwrite.", err=True)
        raise typer.Exit(code=1)
    ...
```

`exists=True` / `readable=True` 让 Typer 在参数解析时自动验证。

## Anti-Patterns

- ❌ `argparse` / 裸 `sys.argv` — 用 Typer，类型安全且自动生成 help
- ❌ `print()` 输出结果 — 用 `typer.echo()`，支持 `err=True` 分流
- ❌ 命令函数里直接 `sys.exit(1)` — 用 `raise typer.Exit(code=1)`
- ❌ 忘记 `no_args_is_help=True` — 用户不带参数时应该看到 help
- ❌ 在 CLI 函数里混入业务逻辑 — CLI 只解析参数，调用 service 层

## Verification Workflow

```bash
# 测试 CLI（不需要安装）
uv run python -m src.cli.main --help
uv run python -m src.cli.main deploy dev --dry-run

# 测试 Typer 命令（pytest）
from typer.testing import CliRunner
runner = CliRunner()
result = runner.invoke(app, ["deploy", "dev", "--dry-run"])
assert result.exit_code == 0
assert "DRY RUN" in result.output
```

## References

- [CLI Patterns](references/cli-patterns.md) — 配置文件集成、交互式 prompt、完整测试示例
