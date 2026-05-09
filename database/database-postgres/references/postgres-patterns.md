# PostgreSQL Patterns

## Row Level Security (RLS)

Enforce per-row access control inside the database — useful for multi-tenant SaaS.

```sql
-- Enable RLS on the table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own rows
CREATE POLICY orders_user_isolation ON orders
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::BIGINT);

-- Bypass RLS for superuser / service account
ALTER TABLE orders FORCE ROW LEVEL SECURITY;   -- applies to table owner too
```

Set the session variable from your app before queries:

```sql
SET LOCAL app.current_user_id = 42;
SELECT * FROM orders;   -- automatically filtered to user 42
```

## Table Partitioning

Use partitioning to keep large tables manageable — each partition is a separate file.

```sql
-- Range partitioning by month
CREATE TABLE events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY,
  created_at  TIMESTAMPTZ NOT NULL,
  payload     JSONB
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2026_01 PARTITION OF events
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE events_2026_02 PARTITION OF events
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

Always include the partition key in WHERE clauses — otherwise Postgres scans all partitions.
Automate partition creation with `pg_partman` for time-based partitions.

## JSONB Operators

```sql
-- Containment: does this row's attrs contain {"color": "red"}?
SELECT * FROM products WHERE attributes @> '{"color": "red"}';

-- Key exists
SELECT * FROM products WHERE attributes ? 'size';

-- Extract field
SELECT attributes->>'name' FROM products;      -- text
SELECT attributes->'price' FROM products;      -- jsonb

-- Nested path
SELECT attributes#>>'{address,city}' FROM users;

-- Update a single field without rewriting the whole object
UPDATE users SET metadata = metadata || '{"verified": true}';

-- Index for containment queries (mandatory for performance)
CREATE INDEX idx_products_attrs ON products USING GIN (attributes);
```

## Full-Text Search

```sql
-- Add a tsvector column (pre-computed, kept in sync by trigger)
ALTER TABLE articles ADD COLUMN search_vector TSVECTOR;

UPDATE articles SET search_vector =
  to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,''));

CREATE INDEX idx_articles_fts ON articles USING GIN (search_vector);

-- Search
SELECT * FROM articles
WHERE search_vector @@ plainto_tsquery('english', 'database indexing');

-- Ranked results
SELECT title, ts_rank(search_vector, query) AS rank
FROM articles, plainto_tsquery('english', 'database indexing') query
WHERE search_vector @@ query
ORDER BY rank DESC;
```

## NOT IN vs NOT EXISTS

`NOT IN` returns no rows if the subquery contains any NULL:

```sql
-- ✗ returns empty if any order has user_id = NULL
SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM orders);

-- ✓ correct — NOT EXISTS handles NULLs properly
SELECT * FROM users u
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);

-- ✓ also correct — LEFT JOIN anti-pattern
SELECT u.* FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE o.id IS NULL;
```

## Batch Insert

```sql
-- Single multi-row INSERT is faster than N individual INSERTs
INSERT INTO events (user_id, type, created_at)
VALUES
  (1, 'login', now()),
  (2, 'purchase', now()),
  (3, 'logout', now());

-- COPY is fastest for bulk loads (CSV or binary)
COPY events (user_id, type, created_at) FROM '/tmp/events.csv' CSV HEADER;

-- ON CONFLICT for upsert
INSERT INTO user_stats (user_id, login_count)
VALUES (42, 1)
ON CONFLICT (user_id) DO UPDATE
  SET login_count = user_stats.login_count + EXCLUDED.login_count;
```

## Window Functions

```sql
-- Running total per user
SELECT
  user_id,
  order_date,
  amount,
  SUM(amount) OVER (PARTITION BY user_id ORDER BY order_date) AS running_total
FROM orders;

-- Row number within each partition
SELECT
  *,
  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
FROM orders;
-- WHERE rn = 1 in a subquery gives the latest order per user
```
