---
name: foundation-agent
description: >
  Foundation platform agent — knows how to build, inspect, and operate
  the Foundation app without reading source code. Use this skill when
  working in the Foundation monorepo: creating resources, writing spec
  YAML, generating migrations, listing endpoints, validating specs,
  querying the database, or understanding the app architecture. Covers
  spec-engine (YAML → CRUD backend), Hygen generators, NestJS modules,
  Nuxt frontend, and all CLI commands. Activates whenever the agent
  needs to know what exists in the app or how to generate new code.
---

# Foundation Agent

## When to Activate

Activate when:
- Working in the Foundation monorepo (`apps/back/`, `apps/front/`)
- Creating a new resource, extension, or field
- Writing or modifying a spec YAML file
- Generating migrations (spec-engine or TypeORM)
- Listing endpoints, jobs, permissions, or DB structure
- Validating spec YAML before loading
- Querying the database (Postgres via Docker)
- Understanding what the app does without reading source

Do NOT activate when:
- Writing frontend Vue/Nuxt components (use the `frontend` skill)
- Writing backend NestJS code by hand (use the `backend` skill)
- Running SDD phases (use SDD skills)

## Stack

NestJS + TypeORM + PostgreSQL + BullMQ (backend). Nuxt 4 + Vue 3 + Tailwind + DaisyUI (frontend). Turborepo monorepo. Spec engine reads YAML → generates CRUD + guards + hooks + seeds.

## Docker — always running

```bash
docker compose up -d                    # Postgres (5432), Redis (6379), Mailpit (1025)
```

## Inspect the app (without running it)

### List ALL endpoints with guards, roles, validations

```bash
cd apps/back && pnpm spec:list-endpoints --verbose
```

Shows 308 endpoints: 30 spec-engine (from YAML) + 278 traditional (from code). Each with HTTP method, path, guard type, allowed roles, validations, source file.

### Validate spec YAML files

```bash
cd apps/back && pnpm spec:validate                       # all extensions
cd apps/back && pnpm spec:validate tasks --verbose      # one extension, full detail
```

Checks: required fields, types, enum values, ref targets, permissions, hook files exist, handler files exist, template files exist, table name collisions. Verbose shows all fields, permissions, hooks, actions, jobs, notifications, seeds.

### List extensions and resources

```bash
cd apps/back && pnpm spec:list
```

### Query the database

Use the Postgres MCP (already configured in `opencode.jsonc`). Or via bash:

```bash
docker exec vps-dev-arch-postgres-1 psql -U dev -d foundation -c "SELECT * FROM ext_tasks_task LIMIT 5"
```

## Generate code

### Create a new spec YAML resource

Write `apps/back/src/extensions/<ext>/<resource>.spec.yaml`. See the template in `references/spec-template.md`.

Then generate the migration:
```bash
cd apps/back && pnpm spec:generate-migration <ext>
cd apps/back && pnpm migration:run
cd apps/back && pnpm spec:snapshot-save <ext>
```

### Create a traditional NestJS resource (Hygen)

```bash
cd apps/back && pnpm generate:resource -- --name=Product
cd apps/back && pnpm generate:extension              # inside an extension
```

### Add a field to an existing resource

```bash
cd apps/back && pnpm add:property -- --name=User --property=email --kind=primitive --type=string
cd apps/back && pnpm add:property -- --name=Post --property=author --kind=reference --type=User --referenceType=manyToOne
```

### Generate and run migrations

```bash
cd apps/back && pnpm spec:generate-migration tasks    # spec-engine (diff against snapshot)
cd apps/back && pnpm migration:generate AddUserEmail   # traditional (diff against DB)
cd apps/back && pnpm migration:run
cd apps/back && pnpm migration:revert
```

### Full spec migration flow (generate → run → save snapshot)

```bash
cd apps/back && pnpm spec:migrate tasks
```

## Test

```bash
cd apps/back && pnpm test                    # Vitest (all tests)
cd apps/back && pnpm test -- src/core/spec-engine/   # spec-engine only
cd apps/back && pnpm check-types            # tsc --noEmit
```

## Key conventions

- Spec YAML tables MUST prefix with `ext_<extension>_`
- Permissions block is MANDATORY per resource (list, read, create, update, delete)
- `import type` for types, never `any`
- Path aliases: `@iam/*`, `@users/*`, `@ext/*`, `@src/*`, `@core/*`
- Migrations via CLI only, never hand-SQL
- Hooks are fire-and-forget (try/catch, never throw)

## References

- `references/spec-template.md` — Full spec YAML template with all field types, permissions, hooks, actions, jobs, notifications, webhooks, seeds
- `references/field-types.md` — All supported field types with examples and SQL mapping
- `references/commands.md` — Complete command reference with flags and examples