---
name: foundation-agent
description: >-
  Foundation agent — sabe todo lo que un agente necesita para programar en Foundation.
  Comandos de generación, estructura de extensiones, spec-engine, migraciones, seeds,
  testing, frontend. No requiere la app corriendo — solo bash + Docker (Postgres).
  Usar cuando un agente (Claude/Cursor/otro) vaya a trabajar en Foundation.
---

# Foundation Agent — Guía completa para programar en Foundation

## Stack

- **Backend**: NestJS + TypeORM + PostgreSQL + BullMQ
- **Frontend**: Nuxt 4 + Vue 3 + Tailwind + DaisyUI + TanStack Query
- **Monorepo**: Turborepo (apps/back, apps/front, packages/)
- **Spec Engine**: YAML → CRUD backend automático (permisos, hooks, seeds, migraciones con diff)

## Estructura del repo

```
foundation/
├── apps/
│   ├── back/                     # NestJS API (puerto 3010)
│   │   ├── src/
│   │   │   ├── core/spec-engine/    # Motor que lee *.spec.yaml
│   │   │   ├── modules/             # Módulos NestJS (iam, users, comms, etc)
│   │   │   ├── extensions/          # Extensiones auto-descubiertas
│   │   │   └── infrastructure/     # DB, config, database
│   │   └── .hygen/                  # Generadores de código
│   └── front/                    # Nuxt SPA (puerto 3000)
│       ├── modules/base/           # Capa base (auth, layout, ui-app)
│       └── extensions/             # Extensiones frontend (custom por app)
├── packages/                     # Paquetes compartidos
└── docker-compose.yml            # Postgres + Redis + Mailpit
```

## Docker — servicios siempre corriendo

```bash
docker compose up -d          # Postgres (5432), Redis (6379), Mailpit (1025/8025)
docker compose ps             # Ver estado
```

## Comandos de generación de código (desde apps/back/)

### Crear recurso CRUD completo (NestJS tradicional)

```bash
pnpm generate:resource -- --name=Product
# Genera: entity, domain, DTO, repository, service, controller, module
# Pregunta: nombre, destino (modules/ o custom/)
```

### Crear recurso dentro de extensión

```bash
pnpm generate:extension -- --name=Blog
# Igual que resource pero dentro de extensions/ (auto-descubierto)
```

### Agregar campo a recurso existente

```bash
# Campo primitivo
pnpm add:property -- --name=User --property=email --kind=primitive --type=string

# Relación many-to-one
pnpm add:property -- --name=Post --property=author --kind=reference --type=User --referenceType=manyToOne
```

### Crear seeder

```bash
pnpm seed:create -- --name=Users
# Genera archivo en src/infrastructure/database/seeds/
```

## Comandos de migración (desde apps/back/)

```bash
# Generar migración desde entities (NestJS tradicional)
pnpm migration:generate AddUserEmail

# Generar migración desde spec YAML (spec-engine)
pnpm spec:generate-migration tasks
# Lee el snapshot previo, hace diff, genera ALTER/CREATE

# Correr migraciones
pnpm migration:run

# Revertir última migración
pnpm migration:revert

# Guardar snapshot de spec después de migrar (para diff下次)
pnpm spec:snapshot-save tasks

# Flujo completo: generar → correr → guardar snapshot
pnpm spec:migrate tasks
```

## Comandos de testing (desde apps/back/)

```bash
# Correr todos los tests
pnpm test

# Correr tests de un directorio
pnpm test -- src/core/spec-engine/

# Verificar tipos
pnpm check-types

# Lint
pnpm lint
```

## Spec Engine — cómo funciona

El spec-engine lee `*.spec.yaml` de `src/extensions/<ext>/` y materializa:
- TypeORM EntitySchema (tabla auto-creada via migración)
- NestJS Controller (CRUD: list, read, create, update, delete)
- Zod validation
- RBAC permissions (guards por rol)
- Hooks (beforeCreate, afterCreate, beforeUpdate, afterUpdate, beforeDelete, afterDelete, beforeQuery)
- Notifications (email templates HBS)
- Jobs (BullMQ o setInterval)
- Webhooks (HMAC inbound/outbound)
- Actions (endpoints custom no-CRUD)
- Seeds (datos iniciales, auto-load al boot)

### Estructura de una extensión spec

```
src/extensions/tasks/
├── task.spec.yaml              # Resource: task (16 fields, hooks, actions, seeds)
├── task-comment.spec.yaml       # Resource: task-comment
├── task-activity.spec.yaml      # Resource: task-activity
├── task-attachment.spec.yaml    # Resource: task-attachment
├── tasks.extension.spec.yaml    # Extension-level: roles, roleSeeds
├── hooks/
│   ├── task-before-create.ts
│   ├── task-after-create.ts
│   └── task-after-update.ts
├── handlers/
│   ├── stats-handler.ts         # GET /tasks/stats
│   ├── reorder-handler.ts      # PATCH /tasks/reorder
│   └── bulk-status-handler.ts  # PATCH /tasks/bulk-status
├── templates/
│   ├── task-assigned.hbs
│   └── stale-tasks.hbs
└── seeds/                       # Seeds opcionales (auto-descubiertos)
```

### Estructura de un spec YAML

```yaml
name: task
table: ext_tasks_task
displayName: Task
fields:
  - name: title
    type: string
    required: true
    validation: { min: 2, max: 200 }
  - name: status
    type: enum
    required: true
    default: pending
    enum: [pending, in_progress, review, done, blocked]
  - name: assigneeId
    type: ref
    ref: user
    nullable: true
  - name: metadata
    type: json
    default: {}
permissions:
  list: [admin, user, manager]
  read: [admin, user, manager]
  create: [admin, manager]
  update: [admin, user, manager]
  delete: [admin]
  rowLevel:
    user:
      filter: 'assigneeId == ${user.id}'
hooks:
  beforeCreate: task-before-create
  afterCreate: task-after-create
  afterUpdate: task-after-update
actions:
  - name: stats
    method: GET
    path: /stats
    auth: { list: [admin, user, manager] }
    handler: stats-handler
notifications:
  - name: notify-assignee
    trigger: afterCreate
    channel: email
    template: ./templates/task-assigned.hbs
jobs:
  - name: stale-tasks-detector
    type: interval
    schedule: 60000
    handler: ./handlers/stale-tasks.handler.ts
seeds:
  - title: Setup project repository
    status: done
    priority: high
```

### Tipos de field soportados

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| `string` | VARCHAR | title |
| `text` | TEXT | description |
| `integer` | INTEGER | position |
| `decimal` | DECIMAL(10,2) | estimateHours |
| `boolean` | BOOLEAN | isRecurring |
| `datetime` | TIMESTAMP | dueDate |
| `enum` | VARCHAR + CHECK | status |
| `ref` | FK a otra tabla | assigneeId → user |
| `json` | JSONB | metadata |
| `file` | VARCHAR (path) | attachment |
| `password` | VARCHAR (masked) | apiKey |

## Frontend — estructura

```
apps/front/
├── modules/base/          # Capa base (auth, layout, ui-app components)
│   └── ui-app/components/ # 16 componentes: FormInput, FormSelect, DataTable, etc
├── extensions/            # Extensiones frontend (custom por app)
│   ├── tasks/             # Frontend custom de tasks
│   └── cms/               # Frontend custom de CMS
└── nuxt.config.ts         # Extiende layers: base + extensions
```

### Comandos frontend (desde apps/front/)

```bash
pnpm dev        # Levantar Nuxt dev (puerto 3000)
pnpm build      # Build producción
pnpm generate   # SSG
pnpm test       # Playwright E2E
```

## Postgres MCP — queries directas a la DB

El agente puede usar el Postgres MCP (ya configurado en opencode.jsonc) para:
- Ver tablas: `SELECT * FROM information_schema.tables WHERE table_schema = 'public'`
- Ver columnas: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ext_tasks_task'`
- Ver datos: `SELECT * FROM ext_tasks_task LIMIT 5`
- Ver migraciones: `SELECT * FROM typeorm_migrations ORDER BY timestamp DESC LIMIT 10`

## Flujo de trabajo recomendado para un agente

1. **Leer specs**: `cat apps/back/src/extensions/*/`spec.yaml` — ver qué resources existen
2. **Ver estructura**: `ls apps/back/src/extensions/` — ver extensiones
3. **Generar resource**: `pnpm generate:extension` o escribir spec YAML
4. **Generar migración**: `pnpm spec:generate-migration <ext>` (si spec-engine) o `pnpm migration:generate <Name>` (si tradicional)
5. **Correr migración**: `pnpm migration:run`
6. **Verificar**: `pnpm check-types && pnpm test`
7. **Levantar app**: `pnpm dev` (backend + frontend)
8. **Probar**: `curl http://localhost:3010/api/v1/<resource>`

## Reglas críticas

- **NUNCA** escribir entity/service/controller a mano → usar generadores
- **NUNCA** hardcodear migraciones SQL → `pnpm migration:generate` o `pnpm spec:generate-migration`
- **NUNCA** `console.log()` → usar NestJS `Logger`
- **SIEMPRE** usar path aliases: `@iam/*`, `@users/*`, `@ext/*`, `@src/*`
- **Tablas en extensiones**: prefijo `ext_<name>_` — ej: `ext_tasks_task`
- `import type` para tipos, never `any`
- Migraciones con CLI, no hand-SQL