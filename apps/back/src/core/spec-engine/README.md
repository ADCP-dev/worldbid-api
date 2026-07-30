# Spec Engine — Spike

> **Status**: Proof of concept. Not production-ready.
> **Branch**: `feat/spec-engine`

## What this is

A runtime interpreter for YAML specs that materializes full CRUD APIs without generating any `.ts` files. Inspired by Hytale's mod system where everything is data-driven.

## The problem it solves

Foundation's current extension system requires **8 hand-written files** per resource (entity, controller, service, DTOs, module, manifest). The Hygen generator scaffolds them, but the generated code drifts and the AI has to maintain 8 files with cross-references.

**Spec engine approach**: write **1 YAML file** → engine reads it at runtime → materializes entity, controller, validation, and auth dynamically.

```
tasks.spec.yaml (1 file)  →  SpecEngine  →  GET /api/v1/tasks
                                           POST /api/v1/tasks
                                           PATCH /api/v1/tasks/:id
                                           DELETE /api/v1/tasks/:id
                                           + stale-tasks job (60s interval)
                                           + stale webhook endpoint
```

## Architecture

```
spec-engine/
├── spec.types.ts          ← TypeScript types for the spec format
├── spec-loader.ts         ← Scans extensions/*/*.spec.yaml, parses YAML
├── entity-factory.ts      ← Builds TypeORM EntitySchema from field defs (no decorators)
├── validation-factory.ts  ← Builds Zod schemas from field defs (replaces DTOs)
├── controller-factory.ts  ← Builds dynamic NestJS controllers with CRUD + auth
├── spec-job-runner.ts     ← Runs scheduled jobs from spec (setInterval for spike)
└── spec-engine.module.ts  ← Wires everything into NestJS DI
```

## How it works

1. `SpecEngineModule.register()` scans `extensions/` for `*.spec.yaml` files
2. For each resource in each spec:
   - `EntityFactory.create()` → TypeORM `EntitySchema` (dynamic entity, no `@Entity` decorator)
   - `ValidationFactory.createCreateSchema()` → Zod schema (replaces `class-validator` DTOs)
   - `ControllerFactory.create()` → NestJS controller class with `@Get`, `@Post`, `@Patch`, `@Delete`
3. `TypeOrmModule.forFeature([...entitySchemas])` registers all dynamic repositories
4. Controllers are registered with `@Inject(entitySchemaName)` for repository DI
5. `SpecJobRunner` loads job handlers and schedules them via `setInterval`

## What the tasks spec demonstrates

The `tasks.spec.yaml` defines:

- **2 resources**: `task` (kanban card) + `task-comment` (nested)
- **7 field types**: string, text, enum, ref, datetime, integer, json
- **Permissions**: RBAC per action (list/read/create/update/delete × admin/customer)
- **1 job**: `stale-tasks-detector` — runs every 60s, checks for pending tasks >24h
- **1 webhook**: `tasks/webhooks/stale` — receives external alerts (HMAC auth)
- **4 seeds**: demo tasks with different statuses and priorities

## Key insight for AI-driven development

```
Before (Hygen):  AI generates 8 .ts files with cross-references → high failure rate
After (Spec):    AI generates 1 YAML file validated against schema → trivial for LLM
```

The spec is the **entire surface area** between the AI and the runtime. It's structured, validatable, and declarative. The AI doesn't need to understand NestJS DI, TypeORM decorators, or Zod — it just writes data.

## What's NOT done yet (intentional — this is a spike)

- [ ] Auto-migration from spec (currently relies on `synchronize: true`)
- [ ] Webhook controllers (spec defines them, handler exists, but controller not materialized yet)
- [ ] BullMQ integration for jobs (using setInterval for the spike)
- [ ] Ref relations materialized as actual FK constraints (field stored as integer, not @ManyToOne)
- [ ] Frontend (Nuxt layer that reads API metadata and auto-generates CRUD views)
- [ ] Plugin format (spec packages that can be installed via `pnpm add plugin:stripe`)
- [ ] Tests

## How to test

```bash
# From apps/back
pnpm start:dev

# The SpecEngine should log:
# [SpecLoader] 📖 Loaded spec: tasks (2 resources)
# [SpecEngine] ✅ Materialized: task → table ext_tasks_task, 7 fields
# [SpecEngine] ✅ Materialized: task-comment → table ext_tasks_comment, 3 fields
# [SpecEngine] Spec engine ready: 2 entities, 2 controllers
# [SpecJobRunner] ⏰ Scheduled job "stale-tasks-detector" every 60s

# Then (with auth):
curl http://localhost:3000/api/v1/tasks
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"title":"My task","status":"pending","priority":"high"}'
```