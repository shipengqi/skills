---
name: python-data
description: Pandas 核心操作模式、性能陷阱与 Polars 对比。Use when processing tabular data, performing data analysis, writing ETL pipelines, or deciding between Pandas and Polars in Python projects.
metadata:
  triggers:
    files:
      - 'pyproject.toml'
    keywords:
      - pandas
      - polars
      - dataframe
      - numpy
      - data processing
      - ETL
      - csv
      - parquet
---

# Python Data Processing

## Pandas — 核心操作

```python
import pandas as pd
import numpy as np

# ✓ 读取数据
df = pd.read_csv("data.csv", dtype={"id": int, "amount": float})
df = pd.read_parquet("data.parquet")             # 推荐格式，更快更小
df = pd.read_json("data.json", lines=True)       # JSONL

# ✓ 基础检查
df.shape          # (rows, cols)
df.dtypes         # 列类型
df.info()         # 内存用量
df.describe()     # 数值统计
df.isnull().sum() # 缺失值统计
```

## 选择 & 过滤

```python
# ✓ .loc — 标签索引（推荐）
df.loc[df["status"] == "active", ["id", "username"]]

# ✓ .iloc — 位置索引
df.iloc[0:10, 0:3]

# ✓ 多条件过滤
active_adults = df[(df["status"] == "active") & (df["age"] >= 18)]

# ✓ isin
df[df["country"].isin(["CN", "US", "JP"])]

# ✓ query — 可读性更好
df.query("status == 'active' and age >= 18")
```

## 变换 & 聚合

```python
# ✓ assign — 链式新增列（不修改原始 df）
result = (
    df
    .assign(
        full_name=lambda x: x["first"] + " " + x["last"],
        age_group=lambda x: pd.cut(x["age"], bins=[0, 18, 35, 60, 100],
                                    labels=["youth", "young", "mid", "senior"]),
    )
    .query("age >= 18")
    .groupby("age_group", observed=True)
    .agg(count=("id", "size"), avg_amount=("amount", "mean"))
    .reset_index()
)

# ✓ apply — 复杂行级操作
df["score"] = df.apply(lambda row: compute_score(row["a"], row["b"]), axis=1)

# ✗ iterrows() — 慢 10-100x，用 vectorized 操作替代
for idx, row in df.iterrows():    # ❌
    df.loc[idx, "score"] = row["a"] + row["b"]

# ✓ vectorized 等价
df["score"] = df["a"] + df["b"]  # ✓
```

## 合并操作

```python
# ✓ merge — 类似 SQL JOIN
merged = pd.merge(orders, users, left_on="user_id", right_on="id", how="left")

# ✓ concat — 纵向拼接
combined = pd.concat([df1, df2, df3], ignore_index=True)

# ✓ pivot_table
pivot = df.pivot_table(
    values="amount",
    index="month",
    columns="category",
    aggfunc="sum",
    fill_value=0,
)
```

## 性能技巧

```python
# ✓ 读取时指定 dtype — 节省内存，加快速度
df = pd.read_csv("large.csv", dtype={
    "id": "int32",           # 默认 int64 — 减半内存
    "category": "category",  # 低基数字符串用 category
    "amount": "float32",
})

# ✓ 分块处理大文件 — 避免内存溢出
for chunk in pd.read_csv("huge.csv", chunksize=100_000):
    process(chunk)

# ✓ 向量化操作替代 apply（数值计算）
df["tax"] = df["amount"] * 0.13          # vectorized ✓
df["tax"] = df["amount"].apply(lambda x: x * 0.13)  # apply ✗ — 慢 10x

# ✓ str accessor — 字符串向量化
df["email_domain"] = df["email"].str.split("@").str[1]
df["username_upper"] = df["username"].str.upper()
```

## Pandas vs Polars — 何时切换

| 场景 | 选择 | 原因 |
|---|---|---|
| 存量代码维护 | Pandas | 不要无故迁移 |
| 新项目，数据 > 1GB | Polars | 速度快 5-10x，内存用量少 |
| 需要真正并行处理 | Polars | Pandas 单线程，Polars 自动多线程 |
| 需要流式处理超大数据 | Polars LazyFrame | 惰性求值，不加载全量数据 |
| Jupyter 探索分析 | Pandas | 生态工具更完善 |

```python
# Polars 对比 — 相同操作，更快的写法
import polars as pl

# Polars 惰性求值（LazyFrame）— 推荐用于生产管道
result = (
    pl.scan_parquet("data.parquet")           # 不立即加载
    .filter(pl.col("status") == "active")
    .with_columns([
        (pl.col("first") + " " + pl.col("last")).alias("full_name"),
    ])
    .group_by("age_group")
    .agg([
        pl.count("id").alias("count"),
        pl.mean("amount").alias("avg_amount"),
    ])
    .collect()                                 # 触发执行
)
```

## 类型安全输出

```python
# ✓ 与 Pydantic 集成 — DataFrame 行转 model
from pydantic import BaseModel

class UserRecord(BaseModel):
    id: int
    username: str
    amount: float

records = [UserRecord(**row) for row in df.to_dict("records")]

# ✓ 保存
df.to_parquet("output.parquet", index=False)  # 推荐
df.to_csv("output.csv", index=False)
```

## Anti-Patterns

- ❌ `iterrows()` / `itertuples()` 做数值计算 — 用向量化操作
- ❌ 大文件一次性 `read_csv` 不指定 dtype — 内存溢出风险
- ❌ `df["col"] = df["col"].apply(lambda x: x * 2)` — 数值操作直接 `df["col"] * 2`
- ❌ 链式赋值 `df[df["a"] > 0]["b"] = 1` — 用 `.loc` 或 `.assign`
- ❌ 忽略 `SettingWithCopyWarning` — 这是真实的 bug 信号

## Verification Workflow

```bash
# 类型检查（pandas-stubs）
uv add pandas-stubs --dev
pyright

# 性能分析
python -c "import cProfile; cProfile.run('main()')"
```

## References

- [Data Patterns](references/data-patterns.md) — 完整 ETL 管道、时间序列处理、Polars 迁移对照表
