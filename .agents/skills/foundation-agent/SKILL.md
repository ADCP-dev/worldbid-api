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

## Crear spec YAML desde cero

Para crear un resource nuevo con spec-engine, escribir el YAML en
`apps/back/src/extensions/<extension>/<resource>.spec.yaml`:

```yaml
name: <resource>                    # Requerido: nombre del resource (singular)
table: ext_<ext>_<resource>         # Requerido: nombre de tabla (prefijo ext_)
displayName: <Display>              # Opcional: nombre para UI
fields:
  - name: <field>                   # Requerido
    type: <string|text|integer|decimal|boolean|datetime|enum|ref|json|file|password>
    required: <true|false>          # Default: false
    nullable: <true|false>          # Default: true (si no required)
    default: <value>                # Opcional
    length: <number>                # Opcional (string/text: default 255)
    precision: <number>             # Opcional (decimal: default 10)
    scale: <number>                  # Opcional (decimal: default 2)
    enum: [a, b, c]                  # Requerido si type=enum
    ref: <resource>                  # Requerido si type=ref (a qué resource apunta)
    refOnDelete: CASCADE|SET NULL|RESTRICT  # Default: RESTRICT
    validation:
      min: <number>                  # Mínimo (string: chars, number: valor)
      max: <number>                  # Máximo
      pattern: <regex>               # Regex
permissions:
  list: [admin, user]                # Roles que pueden listar
  read: [admin, user]                # Roles que pueden leer
  create: [admin]                    # Roles que pueden crear
  update: [admin, user]              # Roles que pueden updatear
  delete: [admin]                    # Roles que pueden borrar
  rowLevel:                          # Opcional: filtro por rol
    user:
      filter: 'assigneeId == ${user.id}'  # SQL-like filter
hooks:
  beforeCreate: <hook-file>         # Nombre del archivo en hooks/
  afterCreate: <hook-file>
  afterUpdate: <hook-file>
actions:                             # Opcional: endpoints custom no-CRUD
  - name: <action>
    method: GET|POST|PATCH|DELETE
    path: /<path>
    auth: { list: [admin, user] }
    handler: <handler-file>
notifications:                       # Opcional: notificaciones
  - name: <notification>
    trigger: afterCreate|afterUpdate|afterDelete
    channel: email
    template: ./templates/<template>.hbs
jobs:                                # Opcional: jobs programados
  - name: <job>
    type: interval|cron
    schedule: 60000                # ms (interval) o '0 8 * * *' (cron)
    handler: ./handlers/<handler>.ts
seeds:                               # Opcional: datos iniciales
  - <field1>: <value1>
    <field2>: <value2>
```

### Verificar spec YAML antes de cargar

```bash
# Validar que el YAML es parseable
python3 -c "import yaml; yaml.safe_load(open('apps/back/src/extensions/tasks/task.spec.yaml'))"

# Verificar campos requeridos
python3 -c "
import yaml
spec = yaml.safe_load(open('apps/back/src/extensions/tasks/task.spec.yaml'))
assert 'name' in spec, 'Missing name'
assert 'table' in spec, 'Missing table'
assert 'fields' in spec, 'Missing fields'
for f in spec['fields']:
    assert 'name' in f, f'Field missing name: {f}'
    assert 'type' in f, f'Field {f[\"name\"]} missing type'
print(f'OK: {spec[\"name\"]} — {len(spec[\"fields\"])} fields')
"

# Verificar que permissions están completos
python3 -c "
import yaml
spec = yaml.safe_load(open('apps/back/src/extensions/tasks/task.spec.yaml'))
for f in spec['fields']:
    if f.get('required') and f.get('type') == 'string':
        print(f'  Required string: {f[\"name\"]}')
"
```

### Listar endpoints existentes

```bash
# Todos los endpoints (NestJS + spec-engine)
grep -rn "@Get\|@Post\|@Patch\|@Delete\|@Put" apps/back/src/ --include="*.ts" \
  | grep -v node_modules \
  | grep -v __tests__ \
  | sed 's/.*@\(Get\|Post\|Patch\|Delete\|Put\)(.*)/\1/' \
  | sort | uniq -c | sort -rn

# Endpoints de spec-engine (auto-generados)
grep -rn "@Get\|@Post\|@Patch\|@Delete" apps/back/src/core/spec-engine/ --include="*.ts" \
  | grep -v __tests__ \
  | head -20

# Endpoints con info de roles
grep -B1 -A1 "@Roles\|@UseGuards" apps/back/src/core/spec-engine/controller-factory.ts \
  | grep -E "@Get|@Post|@Patch|@Delete|@Roles|@UseGuards" | head -20
```

### Listar jobs existentes

```bash
# Jobs de spec-engine (BullMQ + setInterval)
grep -rn "type: interval\|type: cron\|schedule:" apps/back/src/extensions/*/`*.spec.yaml \
  | grep -v node_modules | head -10

# Jobs de NestJS tradicional (BullMQ processors)
grep -rn "@Processor\|@Interval\|@Cron" apps/back/src/ --include="*.ts" \
  | grep -v node_modules | grep -v __tests__ | head -10

# Ver queues de BullMQ
docker exec vps-dev-arch-redis-1 redis-cli KEYS "bull:*" 2>/dev/null | head -10
```

### Listar validaciones de campos

```bash
# Validaciones de spec-engine
grep -rn "validation:" apps/back/src/extensions/*/*.spec.yaml \
  | head -10

# Validaciones de NestJS tradicional (class-validator)
grep -rn "@IsString\|@IsEmail\|@IsNumber\|@IsBoolean\|@IsEnum\|@IsOptional\|@Min\|@Max\|@Length" \
  apps/back/src/ --include="*.ts" | grep -v node_modules | grep -v __tests__ | head -15

# DTOs con validaciones
find apps/back/src/ -name "*.dto.ts" -not -path "*node_modules*" -not -path "*__tests__*" \
  | head -10
```

### Listar migraciones aplicadas

```bash
# Migraciones aplicadas (vía DB)
docker exec vps-dev-arch-postgres-1 psql -U dev -d foundation -c \
  "SELECT id, name, timestamp FROM typeorm_migrations ORDER BY timestamp DESC LIMIT 20"

# Migraciones pendientes (archivos sin entry en DB)
ls apps/back/src/infrastructure/database/migrations/*.ts \
  | grep -v __tests__ | wc -l

# Migraciones de spec-engine (archivos generados)
ls apps/back/src/infrastructure/database/migrations/*Spec*.ts 2>/dev/null | head -10
```

### Listar rutas con guards y roles

```bash
# Mapeo completo: ruta → método → guards → roles
grep -B5 "@Get\|@Post\|@Patch\|@Delete" apps/back/src/core/spec-engine/controller-factory.ts \
  | grep -E "@Get|@Post|@Patch|@Delete|@UseGuards|@Roles" \
  | head -30

# Controllers tradicionales con sus rutas
grep -rn "@Controller" apps/back/src/ --include="*.ts" \
  | grep -v node_modules | grep -v __tests__ | head -15
```

### Listar estructura de extensiones

```bash
# Extensiones spec-engine
ls apps/back/src/extensions/

# Resources por extensión
for ext in apps/back/src/extensions/*/; do
  name=$(basename "$ext")
  count=$(ls "$ext"*.spec.yaml 2>/dev/null | wc -l)
  echo "$name: $count resources"
done

# Hooks por extensión
for ext in apps/back/src/extensions/*/; do
  name=$(basename "$ext")
  hooks=$(ls "$ext"hooks/*.ts 2>/dev/null | wc -l)
  handlers=$(ls "$ext"handlers/*.ts 2>/dev/null | wc -l)
  echo "$name: $hooks hooks, $handlers handlers"
done
```

### Ver datos seed

```bash
# Seeds de spec-engine (auto-cargados al boot)
grep -A5 "seeds:" apps/back/src/extensions/tasks/task.spec.yaml | head -10

# Seeds tradicionales
ls apps/back/src/infrastructure/database/seeds/ | head -10

# Ver datos actuales en DB
docker exec vps-dev-arch-postgres-1 psql -U dev -d foundation -c \
  "SELECT COUNT(*) FROM ext_tasks_task"
```