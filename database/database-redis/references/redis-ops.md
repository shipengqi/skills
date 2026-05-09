# Redis Ops

## Persistence

### RDB (Snapshots)

Point-in-time binary dump — compact, fast to restore, but may lose recent writes.

```
# redis.conf
save 900 1        # snapshot if ≥1 key changed in 900s
save 300 10       # snapshot if ≥10 keys changed in 300s
save 60 10000     # snapshot if ≥10000 keys changed in 60s

dbfilename dump.rdb
dir /var/lib/redis
```

`BGSAVE` forks a child process (Copy-On-Write) — parent continues serving requests.
Risk: if Redis crashes between snapshots, you lose all writes since the last dump.

### AOF (Append-Only File)

Logs every write command — survives crashes with minimal data loss.

```
# redis.conf
appendonly yes
appendfilename "appendonly.aof"

# fsync policy (tradeoff: durability vs throughput)
appendfsync always       # fsync on every write — safest, slowest
appendfsync everysec     # fsync every second — good balance (default)
appendfsync no           # OS decides — fastest, least safe
```

AOF grows over time. Redis rewrites it periodically (`BGREWRITEAOF`) to compact it.

### Recommendation

- Pure cache (data is rebuildable): disable both RDB and AOF — restart fills from DB
- Session/queue (moderate durability): AOF with `everysec`
- Critical data: AOF + RDB for faster restores; or use a persistent datastore instead

## Eviction Policies

Set `maxmemory` and `maxmemory-policy` in redis.conf or via `CONFIG SET`:

| Policy | Behavior |
|--------|----------|
| `noeviction` | Reject writes when full (default — dangerous for caches) |
| `allkeys-lru` | Evict least-recently-used key from all keys — **best for pure caches** |
| `allkeys-lfu` | Evict least-frequently-used — better for skewed access patterns |
| `allkeys-random` | Evict a random key — avoid unless workload is truly uniform |
| `volatile-lru` | LRU among keys with TTL — for mixed TTL/persistent workloads |
| `volatile-lfu` | LFU among keys with TTL |
| `volatile-ttl` | Evict key with shortest remaining TTL |
| `volatile-random` | Random among keys with TTL |

```
# redis.conf
maxmemory 4gb
maxmemory-policy allkeys-lru
```

Monitor eviction rate: `INFO stats` → `evicted_keys`. Sustained evictions mean maxmemory is too low.

## Replication

Redis uses async replication by default. A replica streams all writes from the primary via `PSYNC`.

```
# redis.conf on replica
replicaof <primary-host> 6379

# Check replication lag
INFO replication
# → master_repl_offset vs replica_repl_offset
```

- Replicas are read-only by default (`replica-read-only yes`)
- On failover, replica may miss a few seconds of writes (async lag)
- Use `WAIT numreplicas timeout` for semi-synchronous guarantees on critical writes

## Sentinel (HA)

Sentinel monitors primary + replicas and triggers automatic failover.

```
# sentinel.conf
sentinel monitor mymaster 127.0.0.1 6379 2    # 2 = quorum
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 60000
```

Minimum deployment: 3 Sentinel instances (quorum = 2) to prevent split-brain.
Connect your app to Sentinel, not directly to the primary — Sentinel hands you the current primary address.

## Key Expiration Internals

Redis uses two strategies in combination:
1. **Lazy expiry**: check expiry when a key is accessed — O(1) but stale keys remain in memory
2. **Active scanning**: every 100ms, randomly sample 20 keys with TTL; delete expired ones; repeat if >25% were expired

Large keyspaces with many short-TTL keys may accumulate expired-but-not-yet-deleted keys. Monitor `expired_keys` in `INFO stats`.
