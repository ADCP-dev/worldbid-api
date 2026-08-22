# Spec YAML Template

Complete template for a spec-engine resource. Copy this and fill in your values.

```yaml
name: <resource>                    # Required: singular name
table: ext_<ext>_<resource>         # Required: table name with ext_ prefix
displayName: <Display Name>          # Optional: for UI
description: <what this resource is> # Optional
timestamps: true                     # Optional: adds createdAt, updatedAt
softDelete: true                     # Optional: adds deletedAt

fields:
  # ─── String ────────────────────────────────────────────
  - name: title
    type: string
    required: true
    length: 200                      # Optional: default 255
    validation:
      min: 2
      max: 200

  # ─── Text (long string) ────────────────────────────────
  - name: description
    type: text
    nullable: true

  # ─── Integer ───────────────────────────────────────────
  - name: position
    type: integer
    default: 0

  # ─── Decimal ───────────────────────────────────────────
  - name: price
    type: decimal
    precision: 10
    scale: 2
    nullable: true

  # ─── Boolean ───────────────────────────────────────────
  - name: isActive
    type: boolean
    default: false

  # ─── Datetime ──────────────────────────────────────────
  - name: dueDate
    type: datetime
    nullable: true

  # ─── Enum ──────────────────────────────────────────────
  - name: status
    type: enum
    required: true
    default: pending
    enum: [pending, in_progress, review, done, blocked]

  # ─── Ref (foreign key) ─────────────────────────────────
  - name: assigneeId
    type: ref
    ref: user                        # Target: 'user', 'role', 'file', or another resource name
    nullable: true
    refOnDelete: SET NULL            # CASCADE | SET NULL | RESTRICT (default: RESTRICT)

  # ─── JSON ──────────────────────────────────────────────
  - name: metadata
    type: json
    default: {}

  # ─── File ──────────────────────────────────────────────
  - name: attachment
    type: file
    nullable: true

  # ─── Password (masked) ─────────────────────────────────
  - name: apiKey
    type: password
    nullable: true

  # ─── Vector (pgvector, requires extension) ────────────
  - name: embedding
    type: vector
    dimensions: 1536
    nullable: true
    index:
      type: hnsw                     # hnsw | ivfflat
      params:
        m: 16
        efConstruction: 64
    autoEmbed:
      source: description             # Field to embed
      model: text-embedding-3-small
      provider: openai

permissions:
  list: [admin, user, manager]        # Who can list
  read: [admin, user, manager]        # Who can read one
  create: [admin, manager]            # Who can create
  update: [admin, user, manager]      # Who can update
  delete: [admin]                     # Who can delete
  rowLevel:                           # Optional: per-role row filter
    user:
      filter: 'assigneeId == ${user.id}'
  fields:                             # Optional: per-field RBAC
    apiKey:
      read: [admin]                   # Only admin can read apiKey
      write: [admin]                  # Only admin can write apiKey

hooks:
  beforeCreate: <hook-name>           # File in hooks/<hook-name>.ts
  afterCreate: <hook-name>
  beforeUpdate: <hook-name>
  afterUpdate: <hook-name>
  beforeDelete: <hook-name>
  afterDelete: <hook-name>
  beforeQuery: <hook-name>

actions:                              # Optional: custom non-CRUD endpoints
  - name: stats
    method: GET
    path: /stats
    auth:
      list: [admin, user, manager]
    handler: stats-handler            # File in handlers/<handler>.ts
  - name: reorder
    method: PATCH
    path: /reorder
    auth:
      update: [admin, user, manager]
    handler: reorder-handler
  - name: bulk-status
    method: PATCH
    path: /bulk-status
    auth:
      update: [admin, manager]
    handler: bulk-status-handler

notifications:                        # Optional: email notifications
  - name: notify-assignee
    trigger: afterCreate             # afterCreate | afterUpdate | afterDelete
    channel: email
    template: ./templates/task-assigned.hbs
    to: '${assigneeId.email}'         # Optional: dynamic recipient
  - name: notify-overdue
    trigger: job
    channel: email
    template: ./templates/overdue.hbs

jobs:                                 # Optional: scheduled jobs
  - name: stale-detector
    type: interval
    schedule: 60000                  # milliseconds
    handler: ./handlers/stale.handler.ts
  - name: daily-report
    type: cron
    schedule: '0 8 * * *'            # cron expression
    handler: ./handlers/daily.handler.ts

webhooks:                             # Optional: inbound webhooks
  - name: external-sync
    path: /sync
    auth: hmac                        # hmac | jwt | none
    handler: sync-handler

seeds:                                # Optional: initial data (auto-loaded on boot)
  - title: First task
    status: pending
    priority: high
  - title: Second task
    status: done
    priority: low
```

## Extension-level spec

The extension-level file (`<ext>.extension.spec.yaml`) defines roles and role seeds:

```yaml
name: tasks
version: 2.0.0
displayName: Tasks

roles:
  - name: manager
    description: Can manage all tasks
    permissions: [list, read, create, update, delete]

roleSeeds:
  - name: manager
    description: Manager role
```

## Hook structure

Hooks live in `hooks/<hook-name>.ts`:

```typescript
export default async function(entity: any, ctx: HookContext) {
  // entity: the created/updated/deleted record
  // ctx.user: the authenticated user (or null)
  // ctx.dataSource: TypeORM DataSource
  // ctx.getRepository(name): get a repository by resource name
  // ctx.getService(token): get a Foundation service
  // ctx.sendEmail(opts): send email via MailerService
  // ctx.logger: NestJS Logger
  // ctx.operation: 'create' | 'update' | 'delete' | 'list'
  // Fire-and-forget: try/catch, never throw
}
```

## Handler structure

Action handlers live in `handlers/<handler-name>.ts`:

```typescript
export default async function(req: any, ctx: HookContext) {
  // req: the HTTP request (body, query, params)
  // ctx: same as hooks
  // Return value becomes the HTTP response body
  const repo = ctx.getRepository('task');
  const stats = { total: await repo.count() };
  return stats;
}
```