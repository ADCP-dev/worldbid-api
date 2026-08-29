---
id: "spec-engine"
name: "Spec Engine"
type: "extension"
parent: null
dependencies: ["auth", "storage", "translations"]
conventions: ["YAML specs as source of truth", "Runtime interpretation over code generation", "Hooks as escape hatch"]
entities: ["SpecResource", "SpecField", "JoinTable"]
aliases: []
external_apis: []
---

# Spec Engine Extension

Runtime interpreter that turns YAML specs into a complete backend: dynamic TypeORM entities, NestJS controllers, Zod validation, auth/RBAC, hooks, notifications, jobs, webhooks, and dashboards. No `.ts` files are generated; everything is materialized at runtime.

## Overview

| Property | Value |
|---|---|
| Name | `spec-engine` |
| Version | 0.1.0 (spike) |
| Dependencies | `auth`, `storage`, `translations` |
| Location | `apps/back/src/core/spec-engine/` |
| Status | Backend core implemented; runtime hardened (2026-08, commit `e40c50f`), 34 tests files / 347 tests green (vitest) |
| Config key | `'spec-engine'` (reserved for future use) |

## What it does

1. **SpecLoader** scans `extensions/<name>/*.spec.yaml` and loads them at boot.
2. **SpecValidator** checks structural correctness, cross-references (`ref` targets, hook paths), table collisions, and permission/row-level rules.
3. **EntityFactory** builds TypeORM `EntitySchema` objects from `ResourceSpec` fields, including `ref` (many-to-one) and `many-to-many` (join table).
4. **ValidationFactory** builds Zod schemas for create/update payloads from field definitions.
5. **ControllerFactory** materializes a NestJS controller with standard CRUD routes plus relation endpoints for `many-to-many` fields.
6. **HookExecutor** loads and runs `beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate`, `beforeDelete`, `afterDelete`, and `beforeQuery` hooks with a typed `HookContext`.
7. **NotificationDispatcher** evaluates triggers and dispatches email/webhook notifications.
8. **MigrationGenerator** diffs a spec against a previous snapshot and emits TypeORM migrations, including join tables.
9. **SpecTrace** records every pipeline stage per request (dev and prod) into an in-memory ring buffer, queryable via `GET /_spec/trace/:requestId` (admin).

## Core files

| File | Responsibility |
|---|---|
| `spec.types.ts` | All TypeScript contracts: ExtensionSpec, ResourceSpec, FieldSpec, HookContext, etc. |
| `hook-context.ts` | `HookContext` implementation: repositories, services, config, logger, `transaction()`. |
| `controller-factory.ts` | Builds dynamic NestJS controllers, transaction wrapper, many-to-many sync. |
| `entity-factory.ts` | Builds `EntitySchema` from spec, including join tables for `many-to-many`. |
| `validation-factory.ts` | Builds Zod schemas from field specs. |
| `spec-validator.ts` | Validates specs and accepts `computed`, `beforeQuery`, `many-to-many`. |
| `migration-generator.ts` | Spec diff → TypeORM migration, including `CREATE TABLE` for join tables. |
| `naming.ts` | Shared `joinTableName()` — single source of truth for m:n join-table names (entity factory + controller factory). |
| `trace-store.ts` | In-memory ring buffer (default 500) of finished traces keyed by `requestId`, with automatic oldest-first eviction. |
| `spec-trace.ts` | `TraceBuilder` — records all pipeline stages per request (dev and prod) and pushes finished traces into the ring buffer. |
| `error-trace.ts` | Attaches a sanitized `SpecTrace` to thrown errors via a Symbol marker; the global exception filter extracts it when persisting 5xx errors to the ErrorTracker. |
| `meta-controller.ts` | `_spec` metadata API, including the admin-only trace lookup `GET /_spec/trace/:requestId`. |
| `outbound-http.ts` | Outbound POST helper: abort-signal timeout, per-webhook HMAC secret resolution (spec → env → unsigned + warn-once), bounded failure logging. |
| `spec-schema-drift.ts` | Boot-time schema drift detection: sha256 of each extension's merged spec vs the persisted `spec_schema_version` table. |
| `extension-module-loader.ts` | Centralized loading of hook/action/webhook handler modules (path containment + `.ts` → `.js` production resolution). |
| `spec-trace-test.ts` | CLI (`pnpm spec:trace-test`) that exercises the full trace loop — operation → `X-Spec-Trace` header → trace endpoint → verdict. |

## Spec format

Specs live in `extensions/<name>/<name>.spec.yaml`:

```yaml
name: tasks
version: 1.0.0
resources:
  - name: task
    table: ext_tasks_task
    transactional: true
    fields:
      - name: title
        type: string
        required: true
      - name: tags
        type: many-to-many
        ref: tag
    permissions:
      list: [admin, user]
      create: [admin]
    hooks:
      beforeCreate: ./hooks/task-before-create.ts
```

See the detailed reference docs:

- [SPEC-ENGINE-OVERVIEW.md](../SPEC-ENGINE-OVERVIEW.md) — pitch, architecture, coverage matrix
- [SPEC-ENGINE-DESIGN.md](../SPEC-ENGINE-DESIGN.md) — design principles, pipeline, roadmap
- [SPEC-ENGINE-REFERENCE.md](../SPEC-ENGINE-REFERENCE.md) — complete spec format, types, HookContext API
- [SPEC-ENGINE-GUIDE.md](../SPEC-ENGINE-GUIDE.md) — step-by-step guide to build a spec-driven app
- [SPEC-ENGINE-FEATURES.md](../SPEC-ENGINE-FEATURES.md) — 10+ advanced features

## Runtime hardening (2026-08)

Commit `e40c50f` tightened runtime correctness, resilience, and observability:

- **Validation gate** — resources with validation errors are skipped at materialization, not just warned; only errored resources are dropped.
- **Transaction-per-request** — the singleton dynamic controller no longer shares a `DataSource`/manager across concurrent requests; each request opens its own transaction so one request can never see another's in-flight writes.
- **Hook abort → HTTP 400** — `HookAbortError` from a `before*` hook maps to `BadRequestException` (HTTP 400) instead of a 200/201 body with `{error}`.
- **Shared `joinTableName()`** — entity factory and controller factory previously disagreed on m:n join-table names (doubled `ext_` prefix, e.g. `ext_tasks_ext_tasks_task_tags`); both sides now call the shared helper in `naming.ts`.
- **Outbound HTTP hardening** — every outbound webhook/notification POST gets an `AbortSignal.timeout` (`SPEC_ENGINE_WEBHOOK_TIMEOUT_MS`, default `10000`); HMAC secret precedence is per-webhook spec secret → `WEBHOOK_HMAC_SECRET` env → unsigned delivery with a loud warn-once per webhook.
- **Boot schema-drift detection** — each extension's merged spec is hashed (sha256, canonical JSON) and compared against the persisted `spec_schema_version` table; drift reacts per `SPEC_ENGINE_DRIFT` (`warn` non-prod default / `block` prod default / `off`), and never blocks boot on its own internal errors (fail open).

## Multi-tenant note

Multi-tenant row-level security is documented but not implemented in Foundation base. The extension doc and reference docs describe how a copied app could add `companyId` to the JWT, declare it in specs, and use `rowLevel` / `beforeQuery` hooks for tenant filtering. See SPEC-ENGINE-DESIGN.md §21 and SPEC-ENGINE-REFERENCE.md §31.
