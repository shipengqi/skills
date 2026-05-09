---
name: database-redis
description: Redis key design, caching patterns, data structure selection, and performance. Use when working with Redis cache, sessions, queues, pub/sub, or streams. Apply whenever user uses KEYS * instead of SCAN in Redis, forgets TTL on ephemeral cache keys, stores full JSON in String when Hash fits, uses DEL on large keys instead of UNLINK, or asks how to implement a distributed lock or rate limiter with Redis.
metadata:
  triggers:
    files:
      - 'redis.conf'
      - 'docker-compose*.yml'
    keywords:
      - redis
      - cache
      - ttl
      - eviction
      - pub/sub
      - sorted set
      - distributed lock
---

# Redis

## Data Structures

| Structure | Best For | Core Commands |
|-----------|----------|---------------|
| String | Counters, simple values, flags | `SET`, `GET`, `INCR`, `SETEX` |
| Hash | Objects, sessions (field-level access) | `HSET`, `HGET`, `HMGET`, `HINCRBY` |
| List | Queues, recent feed (FIFO/LIFO) | `LPUSH`, `RPOP`, `LTRIM`, `LRANGE` |
| Set | Unique tags, deduplication | `SADD`, `SINTER`, `SUNION`, `SISMEMBER` |
| Sorted Set | Leaderboards, time-ordered events | `ZADD`, `ZRANGE`, `ZRANGEBYSCORE`, `ZRANK` |
| Bitmap | Boolean flags per user ID | `SETBIT`, `GETBIT`, `BITCOUNT` |
| HyperLogLog | Approximate unique counts | `PFADD`, `PFCOUNT` |
| Stream | Message queue with consumer groups | `XADD`, `XREADGROUP`, `XACK` |

Prefer Hash over JSON-in-String when you need per-field access, increments, or partial reads.

## Key Naming

```
{service}:{entity}:{id}            # user:session:42
{service}:{entity}:{id}:{field}    # order:cart:7:items
```

- Separator: `:` only
- Always include entity type + ID — never bare IDs like `42`
- Max ~100 bytes per key

## Expiration

```
SET session:{id} {data} EX 3600        # set + TTL in one atomic call
EXPIRE key 3600                         # update TTL on existing key
TTL key                                 # -1 = no TTL, -2 = key missing
```

Every ephemeral key must have a TTL. For high-traffic cache keys, add jitter to prevent stampede:
`ttl = base_ttl + random(0, base_ttl * 0.1)`

## Command Efficiency

```
# ✗ KEYS blocks the server — never use in production
# ✓ SCAN is cursor-based and non-blocking
SCAN 0 MATCH user:* COUNT 100

# ✗ DEL on a large key blocks the main thread
# ✓ UNLINK deletes in the background
UNLINK large:hash:key

# Batch reads save round trips
MGET key1 key2 key3
HMGET hash field1 field2

# Pipeline — buffer multiple commands, flush in one round trip
# (use your client's .pipeline() / .multi() API)
```

## Caching Pattern (Cache-Aside)

```
value = GET cache:{key}
if value == nil:
    value = query_db(key)
    SET cache:{key} {value} EX {ttl + jitter}
return value
```

## Distributed Lock

```
# Acquire: SET NX EX is a single atomic command
SET lock:{resource} {uuid} NX EX 30

# Release: Lua script — check UUID before deleting to avoid releasing another caller's lock
EVAL "
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  else
    return 0
  end
" 1 lock:{resource} {uuid}
```

Never `DEL` without checking the UUID — you may delete a lock you don't own.

## Anti-Patterns

- ❌ `KEYS *` in production — use `SCAN`
- ❌ `DEL` on large keys (blocks event loop) — use `UNLINK`
- ❌ No TTL on ephemeral keys — all cache entries must expire
- ❌ Full JSON in String when Hash fits — loses per-field `INCR` and selective reads
- ❌ `SMEMBERS` / `HGETALL` on unbounded collections — use `SSCAN` / `HSCAN` with COUNT
- ❌ `MULTI/EXEC` for conditional logic — use Lua script for atomic branching

## Operations

```
maxmemory-policy allkeys-lru      # pure cache; volatile-lru for mixed TTL/persistent keys
redis-cli --bigkeys               # scan keyspace for unexpectedly large values
redis-cli INFO stats              # keyspace_hits, keyspace_misses, used_memory_rss
SLOWLOG GET 10                    # show 10 slowest recent commands
```

- Connect via hostname, not IP (cloud providers change IPs on failover)
- Use a connection pool (min=2, max=10 per app instance); never open a connection per request

## References

- [Redis Patterns](references/redis-patterns.md) — Stream consumer groups, pub/sub, sliding-window rate limiting, Lua scripting, TTL jitter
- [Redis Ops](references/redis-ops.md) — Persistence (RDB/AOF), eviction deep-dive, replication, Sentinel
