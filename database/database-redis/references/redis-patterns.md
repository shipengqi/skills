# Redis Patterns

## Stream — Consumer Groups

```
# Producer: append message with auto-generated ID
XADD orders * order_id 123 user_id 42 total 9900

# Create consumer group (read from start: 0, or latest: $)
XGROUP CREATE orders processing 0 MKSTREAM

# Consumer: read up to 10 unacknowledged messages
XREADGROUP GROUP processing worker-1 COUNT 10 BLOCK 5000 STREAMS orders >

# Acknowledge processed message (removes from PEL)
XACK orders processing {message-id}

# Check pending (unacked) messages — find stuck messages
XPENDING orders processing - + 10
```

Each consumer group maintains a Pending Entries List (PEL). If a consumer crashes, its
messages stay in PEL and can be re-claimed by another worker with `XAUTOCLAIM`.

## Pub/Sub

```
# Publisher
PUBLISH channel:notifications "{\"type\":\"order\",\"id\":123}"

# Subscriber (blocks waiting for messages)
SUBSCRIBE channel:notifications

# Pattern subscribe
PSUBSCRIBE channel:*
```

Pub/Sub has no persistence — messages are lost if no subscriber is connected.
Use Streams instead when delivery guarantees matter.

## Sliding Window Rate Limiting

```
# Allow at most 100 requests per minute per user
key = ratelimit:{user_id}:{window_minute}

MULTI
  INCR {key}
  EXPIRE {key} 60
EXEC

# Check result: if count > 100, reject
```

For precise sliding windows (not fixed-minute buckets), use a Sorted Set:

```
now_ms = current_timestamp_ms
window_ms = 60000
key = ratelimit:{user_id}

ZADD {key} {now_ms} {now_ms}              # add current request
ZREMRANGEBYSCORE {key} 0 {now_ms - window_ms}  # drop expired entries
count = ZCARD {key}
EXPIRE {key} 60
# reject if count > limit
```

Wrap the Sorted Set operations in a Lua script for atomicity:

```lua
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])

redis.call('ZADD', key, now, now)
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
redis.call('EXPIRE', key, math.ceil(window / 1000))
return count
```

## Lua Scripting

Use `EVAL` / `EVALSHA` when you need:
- Atomic read-modify-write (check then set)
- Multiple commands that must succeed or fail together
- Conditional logic that MULTI/EXEC cannot express

```
# Load script and get SHA
SCRIPT LOAD "return redis.call('GET', KEYS[1])"

# Call by SHA (preferred — avoids re-sending script bytes)
EVALSHA {sha} 1 mykey
```

Lua scripts run atomically — no other command executes concurrently. Keep scripts short;
long scripts block the server.

## TTL Jitter

Cache stampede happens when many keys expire at the same moment and all callers hit the DB together.

```python
import random

BASE_TTL = 300   # 5 minutes
jitter   = random.randint(0, int(BASE_TTL * 0.1))   # 0–30s
ttl      = BASE_TTL + jitter

redis.set(key, value, ex=ttl)
```

For very hot keys, use a background refresh: serve the stale value while a single goroutine
refreshes it — prevents thundering herd without jitter.

## Memory Optimization

Redis uses compact encodings for small structures:
- Hash with ≤128 fields and all values ≤64 bytes → **listpack** (dense, CPU-cache-friendly)
- List with ≤128 elements → **listpack**
- Sorted Set with ≤128 members → **listpack**

Exceeding these thresholds converts to a full hash table / skiplist — memory jumps.
Tune with `hash-max-listpack-entries`, `zset-max-listpack-entries`.

Scan for large keys before they become a problem:

```
redis-cli --bigkeys          # reports top-N largest per type
redis-cli --memkeys          # reports memory usage per key (slow on large keyspaces)
OBJECT ENCODING key          # check current encoding
OBJECT IDLETIME key          # seconds since last access (for eviction debugging)
```
