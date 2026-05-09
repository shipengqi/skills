---
name: database-postgres
description: PostgreSQL schema design, indexing strategies, transactions, and zero-downtime migrations. Use when designing tables, writing SQL queries, adding indexes, or planning schema changes. Apply whenever user uses serial instead of GENERATED ALWAYS AS IDENTITY, timestamp without time zone, NOT IN with nullable columns, drops a column directly instead of Expand-Contract, or creates a plain index without CONCURRENTLY on a live table.
metadata:
  triggers:
    files:
      - '*.sql'
      - 'docker-compose*.yml'
      - 'postgresql.conf'
    keywords:
      - postgresql
      - postgres
      - migration
      - vacuum
      - pgbouncer
      - index
      - rls
---

# PostgreSQL

## Data Types

```sql
-- Identity: GENERATED ALWAYS AS IDENTITY is SQL-standard; serial is legacy
id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY

-- Timestamps: always with time zone — stores UTC, displays in client tz
created_at  TIMESTAMPTZ DEFAULT now()
updated_at  TIMESTAMPTZ DEFAULT now()

-- Money: never float/double (rounding errors) or the money type (locale-dependent)
price       NUMERIC(19, 4)      -- or store as integer cents

-- Strings: text is the native optimized type; char(n) pads with spaces
name        TEXT NOT NULL
status      TEXT NOT NULL       -- avoid ENUM: hard to add/remove values in production

-- JSON: JSONB is binary and indexable; json stores raw text (slower, no index)
metadata    JSONB DEFAULT '{}'
```

## Indexing

```sql
-- B-tree (default): =, <, >, range, ORDER BY — covers 95% of cases
CREATE INDEX idx_orders_user_id ON orders (user_id);

-- Partial: smaller, faster for filtered queries
CREATE INDEX idx_users_active_email ON users (email) WHERE deleted_at IS NULL;

-- Covering (INCLUDE): enables Index-Only Scan — avoids heap lookup
CREATE INDEX idx_users_lookup ON users (email) INCLUDE (id, name);

-- GIN: JSONB containment (@>), array overlap, full-text search (tsvector)
CREATE INDEX idx_products_attrs ON products USING GIN (attributes);

-- BRIN: very large append-only tables with sequential data (timestamps, IDs)
CREATE INDEX idx_events_created ON events USING BRIN (created_at);

-- ALWAYS use CONCURRENTLY on live tables — plain CREATE INDEX locks all writes
CREATE INDEX CONCURRENTLY idx_orders_status ON orders (status);
```

Always index foreign key columns — unindexed FKs cause sequential scans on JOINs.

## EXPLAIN ANALYZE

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE user_id = 42;
```

| Plan node | Meaning |
|-----------|---------|
| `Seq Scan` on large table | Missing index |
| `Index Scan` | Good — using an index |
| `Index Only Scan` | Best — no heap access needed |
| `Bitmap Heap Scan` | Multiple indexes combined |
| `Nested Loop` with large rows | N+1 — add index or restructure JOIN |

High `shared hit` = cache hit. High `read` = disk I/O — check `work_mem` or missing index.

## Transactions

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;   -- or ROLLBACK on error

-- Savepoint for partial rollback within a transaction
SAVEPOINT sp1;
INSERT INTO audit_log (...) VALUES (...);
-- ROLLBACK TO SAVEPOINT sp1;   -- undo just this step if needed
RELEASE SAVEPOINT sp1;
COMMIT;
```

Default isolation: `READ COMMITTED`. Use `REPEATABLE READ` for consistent snapshots, `SERIALIZABLE` for strict correctness. Avoid long transactions — they block VACUUM and hold locks.

## Zero-Downtime Migrations (Expand-Contract)

Never break running code while deploying. For any destructive change:

```sql
-- Phase 1: Expand — add new column (old code still works)
ALTER TABLE orders ADD COLUMN status_v2 TEXT;
UPDATE orders SET status_v2 = status;           -- backfill existing rows
CREATE INDEX CONCURRENTLY idx_orders_status_v2 ON orders (status_v2);

-- Phase 2: Switch — deploy new code that reads/writes status_v2

-- Phase 3: Contract — after all instances use the new column
ALTER TABLE orders DROP COLUMN status;
ALTER TABLE orders RENAME COLUMN status_v2 TO status;
```

Rules:
- Never `DROP COLUMN` in the same migration that adds the replacement
- Adding `NOT NULL` to an existing column: add nullable → backfill → `SET NOT NULL`
- `ADD COLUMN` with no default is instant; `ADD COLUMN DEFAULT val` rewrites table (pre-PG11)
- `CREATE INDEX CONCURRENTLY` can fail — check `pg_indexes` and rebuild if needed

## Anti-Patterns

- ❌ `serial` → `BIGINT GENERATED ALWAYS AS IDENTITY`
- ❌ `timestamp` → `timestamptz` (avoids timezone bugs on server moves)
- ❌ `char(n)` → `text` (char pads with spaces; slower comparisons)
- ❌ `float`/`double` for money → `NUMERIC(19,4)` or integer cents
- ❌ `NOT IN (subquery)` where subquery can return NULL — always returns empty; use `NOT EXISTS`
- ❌ `BETWEEN` for timestamps — inclusive both ends; use `>= AND <`
- ❌ `CREATE INDEX` without `CONCURRENTLY` on a live table — locks all writes
- ❌ `DROP COLUMN` without Expand-Contract — breaks in-flight requests on old schema

## Operations

```sql
-- Update planner statistics after bulk inserts/deletes
VACUUM ANALYZE orders;

-- Check table bloat (dead rows)
SELECT relname, n_dead_tup, n_live_tup
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;

-- Active connections by state
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
```

- Use PgBouncer in **transaction mode** between app and Postgres for high-concurrency workloads
- Postgres handles ~100–200 direct connections well; beyond that, latency degrades sharply
- Autovacuum must be ON; tune `autovacuum_vacuum_scale_factor = 0.05` for large tables

## References

- [PostgreSQL Patterns](references/postgres-patterns.md) — Row Level Security, table partitioning, JSONB operators, full-text search, batch insert
- [PostgreSQL Ops](references/postgres-ops.md) — PgBouncer config, VACUUM tuning, autovacuum, replication, monitoring queries
