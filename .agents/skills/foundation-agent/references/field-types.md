# Field Types Reference

All field types supported by the spec-engine, with SQL mapping and examples.

| Type | SQL | Nullable? | Default | Validation | Notes |
|------|-----|-----------|---------|------------|-------|
| `string` | VARCHAR(N) | Yes | — | min, max, pattern | `length` default 255 |
| `text` | TEXT | Yes | — | min, max | No length limit |
| `integer` | INTEGER | Yes | — | min, max | |
| `decimal` | DECIMAL(P,S) | Yes | — | min, max | `precision` default 10, `scale` default 2 |
| `boolean` | BOOLEAN | Yes | false | — | |
| `datetime` | TIMESTAMP | Yes | — | — | |
| `enum` | VARCHAR + CHECK | Yes | — | — | Requires `enum: [values]` |
| `ref` | INTEGER (FK) | Yes | — | — | Requires `ref: <target>`. `refOnDelete`: CASCADE, SET NULL, RESTRICT |
| `json` | JSONB | Yes | {} | — | PostgreSQL JSONB |
| `file` | VARCHAR | Yes | — | — | Stores file path/URL |
| `password` | VARCHAR | Yes | — | — | Masked in API responses |
| `vector` | VECTOR(N) | Yes | — | — | Requires pgvector extension. `dimensions` required. `index`: hnsw/ivfflat. `autoEmbed`: source + model + provider |

## Validation rules

```yaml
validation:
  min: 2          # String: minimum chars. Number: minimum value.
  max: 200        # String: maximum chars. Number: maximum value.
  pattern: '^[a-z]+$'  # Regex pattern (string only)
  email: true     # Must be valid email
  url: true       # Must be valid URL
```

## Ref targets

| Target | Resolves to | Notes |
|--------|-----------|-------|
| `user` | `user` table (Foundation built-in) | INTEGER PK |
| `role` | `role` table (Foundation built-in) | INTEGER PK |
| `file` | `file` table (Foundation built-in) | UUID PK |
| `<resource>` | `ext_<ext>_<resource>` table | INTEGER PK (spec-engine) |

## Permission roles

| Role | ID | Description |
|------|----|-----------|
| `admin` | 1 | Full access |
| `user` | 2 | Maps to `customer` in DB. Limited access via rowLevel |
| `manager` | Custom | Custom role defined in extension spec |
| `public` | — | No auth required. PublicGuard injects null user |

## rowLevel filter syntax

```yaml
rowLevel:
  user:
    filter: 'assigneeId == ${user.id}'     # User sees only their tasks
  manager:
    filter: 'reporterId == ${user.id}'     # Manager sees tasks they reported
```

The filter is a SQL-like expression. `${user.id}` is replaced with the authenticated user's ID. Multiple conditions: `'assigneeId == ${user.id} AND status != "done"'`