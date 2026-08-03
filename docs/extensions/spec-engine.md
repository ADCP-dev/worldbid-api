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
| Status | Backend core implemented on `feat/spec-engine`, 12 passing unit tests |
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
9. **SpecTrace** records every pipeline stage per request for observability.

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
| `__tests__/spec-engine.spec.ts` | 12 unit tests for transactions, many-to-many, validation, spec-validator. |

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

## Multi-tenant note

Multi-tenant row-level security is documented but not implemented in Foundation base. The extension doc and reference docs describe how a copied app could add `companyId` to the JWT, declare it in specs, and use `rowLevel` / `beforeQuery` hooks for tenant filtering. See SPEC-ENGINE-DESIGN.md §21 and SPEC-ENGINE-REFERENCE.md §31.
