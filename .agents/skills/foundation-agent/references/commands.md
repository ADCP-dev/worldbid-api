# Command Reference

All CLI commands available in Foundation. Run from `apps/back/` unless noted.

## Spec Engine

| Command | What it does | Interactive? |
|---------|-------------|-------------|
| `pnpm spec:validate` | Validate all spec YAMLs (fields, permissions, hooks, handlers, templates) | No |
| `pnpm spec:validate <ext> --verbose` | Validate one extension with full details | No |
| `pnpm spec:list` | List all extensions + resources | No |
| `pnpm spec:list-endpoints` | List ALL endpoints (308): spec-engine + traditional, with guards + roles | No |
| `pnpm spec:list-endpoints --verbose` | Same + source file, validations, rowLevel, hooks, handler | No |
| `pnpm spec:list-endpoints --json` | JSON output for agent parsing | No |
| `pnpm spec:generate-migration <ext>` | Generate migration from spec YAML diff (ALTER/CREATE/DROP) | No |
| `pnpm spec:snapshot-save <ext>` | Save spec snapshot to DB (for next diff) | No |
| `pnpm spec:migrate <ext>` | Full flow: generate → run → save snapshot | No |
| `pnpm spec:generate-tests <ext>` | Generate test scaffolding from spec | No |
| `pnpm spec:trace <requestId>` | Fetch trace by request ID (requires app running) | No |

## Hygen Generators (traditional NestJS)

| Command | What it does | Interactive? |
|---------|-------------|-------------|
| `pnpm generate:resource -- --name=X` | Full CRUD: entity, domain, DTO, repository, service, controller, module | Yes (prompts name, destination) |
| `pnpm generate:extension` | Same but inside extensions/ (auto-discovered) | Yes |
| `pnpm add:property -- --name=X --property=p --kind=primitive --type=string` | Add column to resource | Yes (prompts details) |
| `pnpm add:property -- --name=X --property=p --kind=reference --type=Y --referenceType=manyToOne` | Add relation | Yes |
| `pnpm add:extension-property` | Same but for extension resources | Yes |
| `pnpm seed:create -- --name=X` | Create seeder file | Yes |

## TypeORM Migrations

| Command | What it does |
|---------|-------------|
| `pnpm migration:generate <Name>` | Generate migration from entities vs DB diff |
| `pnpm migration:run` | Run pending migrations |
| `pnpm migration:revert` | Revert last migration |
| `pnpm migration:create <Name>` | Create empty migration file |

## DB Branching (testing)

| Command | What it does |
|---------|-------------|
| `pnpm db:branch:create -- --name=test1` | Create isolated Postgres schema for testing |
| `pnpm db:branch:list` | List active branches |
| `pnpm db:branch:merge -- --name=test1` | Merge branch migrations to public |
| `pnpm db:branch:discard -- --name=test1` | Drop branch schema |
| `pnpm db:branch:cleanup -- --max-age-hours=24` | Clean stale branches |

## Testing

| Command | What it does |
|---------|-------------|
| `pnpm test` | Run all tests (Vitest) |
| `pnpm test -- <path>` | Run tests in path |
| `pnpm test:watch` | Watch mode |
| `pnpm check-types` | TypeScript type check (tsc --noEmit) |
| `pnpm lint` | ESLint + fix |

## Docker

| Command | What it does |
|---------|-------------|
| `docker compose up -d` | Start Postgres, Redis, Mailpit |
| `docker compose ps` | Check status |
| `docker compose down` | Stop all |

## Postgres queries (via Docker)

```bash
# List tables
docker exec vps-dev-arch-postgres-1 psql -U dev -d foundation -c "\dt"

# List columns of a table
docker exec vps-dev-arch-postgres-1 psql -U dev -d foundation -c "\d ext_tasks_task"

# Query data
docker exec vps-dev-arch-postgres-1 psql -U dev -d foundation -c "SELECT * FROM ext_tasks_task LIMIT 5"

# List migrations
docker exec vps-dev-arch-postgres-1 psql -U dev -d foundation -c "SELECT * FROM migrations ORDER BY id DESC LIMIT 10"

# Count rows
docker exec vps-dev-arch-postgres-1 psql -U dev -d foundation -c "SELECT count(*) FROM ext_tasks_task"
```

## Frontend (from apps/front/)

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Nuxt dev server (port 3000) |
| `pnpm build` | Production build |
| `pnpm test` | Playwright E2E |