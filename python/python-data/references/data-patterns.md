# Data Patterns Reference

## 完整 ETL 管道

```python
# src/etl/pipeline.py
import pandas as pd
from pathlib import Path
from loguru import logger
from dataclasses import dataclass

@dataclass
class PipelineResult:
    input_rows: int
    output_rows: int
    dropped_rows: int

def run_pipeline(input_path: Path, output_path: Path) -> PipelineResult:
    # 1. Extract
    logger.info("Loading data", path=str(input_path))
    df = pd.read_parquet(input_path)
    input_rows = len(df)

    # 2. Transform
    df = (
        df
        .dropna(subset=["id", "email"])                   # 删除必填字段缺失行
        .drop_duplicates(subset=["id"])                    # 去重
        .assign(
            email=lambda x: x["email"].str.lower().str.strip(),
            created_at=lambda x: pd.to_datetime(x["created_at"], utc=True),
            amount=lambda x: x["amount"].fillna(0.0),
        )
        .query("amount >= 0")                              # 过滤无效数据
        .reset_index(drop=True)
    )

    # 3. Load
    df.to_parquet(output_path, index=False)
    output_rows = len(df)

    logger.info("Pipeline complete",
        input_rows=input_rows,
        output_rows=output_rows,
        dropped=input_rows - output_rows,
    )
    return PipelineResult(input_rows, output_rows, input_rows - output_rows)
```

## 时间序列处理

```python
# ✓ 时区感知 datetime
df["ts"] = pd.to_datetime(df["ts"], utc=True)
df["ts_local"] = df["ts"].dt.tz_convert("Asia/Shanghai")

# ✓ 重采样聚合
daily = (
    df
    .set_index("ts")
    .resample("1D")
    .agg({"amount": "sum", "count": "size"})
    .reset_index()
)

# ✓ 滚动窗口
df["amount_7d_avg"] = df["amount"].rolling(window=7, min_periods=1).mean()

# ✓ 时间范围过滤
last_30d = df[df["ts"] >= pd.Timestamp.now(tz="UTC") - pd.Timedelta(days=30)]
```

## 大文件分块处理

```python
from pathlib import Path

def process_large_csv(input_path: Path, output_path: Path, chunksize: int = 100_000) -> None:
    results = []

    for i, chunk in enumerate(pd.read_csv(input_path, chunksize=chunksize)):
        logger.info("Processing chunk", chunk=i, rows=len(chunk))
        processed = transform(chunk)
        results.append(processed)

    pd.concat(results, ignore_index=True).to_parquet(output_path, index=False)
```

## Polars 迁移对照表

| Pandas | Polars | 说明 |
|---|---|---|
| `pd.read_csv("f.csv")` | `pl.read_csv("f.csv")` | 直接读取 |
| `pl.scan_csv("f.csv")` | 惰性，推荐生产 |
| `df[df["a"] > 0]` | `df.filter(pl.col("a") > 0)` | 过滤 |
| `df.assign(b=df["a"] * 2)` | `df.with_columns((pl.col("a") * 2).alias("b"))` | 新增列 |
| `df.groupby("k").agg({"v": "sum"})` | `df.group_by("k").agg(pl.sum("v"))` | 聚合 |
| `df.merge(other, on="id")` | `df.join(other, on="id")` | 合并 |
| `df.rename({"a": "b"})` | `df.rename({"a": "b"})` | 同 |
| `df.to_parquet("f.parquet")` | `df.write_parquet("f.parquet")` | 写出 |

```python
# Polars LazyFrame — 完整管道示例
import polars as pl

result = (
    pl.scan_parquet("orders.parquet")
    .filter(pl.col("status") == "completed")
    .join(pl.scan_parquet("users.parquet"), on="user_id", how="left")
    .with_columns([
        (pl.col("amount") * pl.col("tax_rate")).alias("tax"),
        pl.col("created_at").dt.truncate("1mo").alias("month"),
    ])
    .group_by("month")
    .agg([
        pl.sum("amount").alias("total_amount"),
        pl.count("id").alias("order_count"),
    ])
    .sort("month")
    .collect()   # 触发执行
)
```

## 与 FastAPI 集成 — DataFrame 作为 API 响应

```python
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import pandas as pd
import io

router = APIRouter()

@router.get("/export/csv")
async def export_csv() -> StreamingResponse:
    df = await get_report_dataframe()
    buffer = io.StringIO()
    df.to_csv(buffer, index=False)
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=report.csv"},
    )
```

## Run Commands

```bash
# 安装数据依赖
uv add pandas pyarrow polars

# 类型检查（pandas-stubs）
uv add pandas-stubs --dev
pyright

# 性能分析
python -m cProfile -s cumtime script.py | head -20

# 内存分析
uv add memray --dev
python -m memray run script.py
python -m memray flamegraph memray-*.bin
```
