# PostgreSQL Ops

## PgBouncer

PgBouncer sits between your app and Postgres, multiplexing many app connections into a small number of real Postgres connections.

```ini
# pgbouncer.ini
[databases]
mydb = host=127.0.0.1 port=5432 dbname=mydb

[pgbouncer]
listen_port = 6432
listen_addr = 0.0.0.0
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

pool_mode = transaction          # transaction pooling — most efficient
max_client_conn = 1000           # total client connections PgBouncer accepts
default_pool_size = 25           # real Postgres connections per database/user pair
min_pool_size = 5
reserve_pool_size = 5

log_connections = 0
log_disconnections = 0
```

**Pool modes:**
- `transaction` (recommended): connection returned to pool after each transaction — lowest Postgres connection count
- `session`: connection held for the entire client session — higher Postgres count, needed for `SET` / `LISTEN`
- `statement`: connection returned after each statement — rarely used

`SET LOCAL` works in transaction mode; `SET` (session-level) does not — use `SET LOCAL` or connection-level app settings.

## VACUUM and Autovacuum

PostgreSQL uses MVCC — old row versions accumulate and must be reclaimed by VACUUM.

```sql
-- Manual VACUUM on a specific table (non-blocking)
VACUUM ANALYZE orders;

-- VACUUM FULL rewrites the table (reclaims disk space but takes exclusive lock)
VACUUM FULL orders;   -- avoid on live tables; use pg_repack instead
```

### Autovacuum Tuning

```sql
-- Check if autovacuum is keeping up
SELECT schemaname, relname, n_dead_tup, n_live_tup, last_autovacuum
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

For large, frequently-updated tables, the default scale factor (20%) triggers autovacuum too late:

```sql
-- Table-level override (more aggressive for large tables)
ALTER TABLE orders SET (
  autovacuum_vacuum_scale_factor = 0.05,    -- trigger at 5% dead rows (default 20%)
  autovacuum_analyze_scale_factor = 0.02    -- update stats at 2% changes
);
```

Signs autovacuum is falling behind: rising `n_dead_tup`, table bloat, slowing queries.

## Replication

```sql
-- primary: postgresql.conf
wal_level = replica
max_wal_senders = 5
wal_keep_size = 512MB   # keep recent WAL for lagging replicas

-- replica: postgresql.conf / recovery.conf (PG12+: standby.signal + primary_conninfo)
primary_conninfo = 'host=primary port=5432 user=replicator'
```

Monitor replication lag:

```sql
-- On primary: lag per replica
SELECT client_addr, state, sent_lsn, write_lsn, flush_lsn, replay_lsn,
       (sent_lsn - replay_lsn) AS lag_bytes
FROM pg_stat_replication;
```

## Monitoring Queries

```sql
-- Long-running queries (>5 minutes)
SELECT pid, now() - query_start AS duration, state, query
FROM pg_stat_activity
WHERE state != 'idle' AND query_start < now() - interval '5 minutes'
ORDER BY duration DESC;

-- Blocking queries
SELECT bl.pid AS blocked_pid, a.query AS blocked_query,
       kl.pid AS blocking_pid, ka.query AS blocking_query
FROM pg_catalog.pg_locks bl
JOIN pg_catalog.pg_stat_activity a ON a.pid = bl.pid
JOIN pg_catalog.pg_locks kl ON kl.transactionid = bl.transactionid AND kl.pid != bl.pid
JOIN pg_catalog.pg_stat_activity ka ON ka.pid = kl.pid
WHERE NOT bl.granted;

-- Index usage (find unused indexes)
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- Cache hit ratio (should be >99% for OLTP)
SELECT
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) AS cache_hit_ratio
FROM pg_statio_user_tables;
```

## Connection Limits

```sql
-- Current connections vs max
SELECT count(*) AS current, max_conn
FROM pg_stat_activity,
     (SELECT setting::int AS max_conn FROM pg_settings WHERE name = 'max_connections') s
GROUP BY max_conn;

-- Per-database connection count
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;
```

If approaching `max_connections`, increase PgBouncer's pool or raise `max_connections` (requires restart). Each Postgres connection uses ~5–10MB of RAM.
