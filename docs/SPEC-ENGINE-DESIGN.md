# Spec Engine — Design Document

> **Status**: Design phase. Implementation starts after validation.
> **Branch**: `feat/spec-engine`
> **Date**: 2026-07-30

## 0. Table of Contents

1. [Principles](#1-principles)
2. [Spec Format](#2-spec-format)
3. [Lifecycle Pipeline](#3-lifecycle-pipeline)
4. [HookContext — the unified interface](#4-hookcontext)
5. [Notification System](#5-notification-system)
6. [File Handling](#6-file-handling)
7. [Auth & RBAC](#7-auth--rbac)
8. [Jobs](#8-jobs)
9. [Migrations](#9-migrations)
10. [Testing](#10-testing)
11. [Frontend](#11-frontend)
12. [Plugin System](#12-plugin-system)
13. [AI Agent Integration](#13-ai-agent-integration)
14. [Module Wiring](#14-module-wiring)
15. [What the spike got wrong](#15-what-the-spike-got-wrong)

---

## 1. Principles

### 1.1 Spec is the single source of truth

The YAML spec defines the resource. The engine interprets it at runtime. No code is generated. If the spec changes, the runtime behavior changes. There is no "generated code that drifted from the generator."

### 1.2 Declarative by default, escape hatch when needed

80% of real-world resources are CRUD + validation + permissions + notifications. That's declarative. The 20% that needs custom logic (business rules, external sync, complex transformations) uses typed hooks — functions with a contract, not classes with decorators.

### 1.3 Consume Foundation, don't replace it

The engine uses MailerService, FilesService, IamModule, BullMQ, ConfigService, ErrorTrackerService — all existing modules. It does not reimplement email sending, file storage, or auth. It orchestrates them.

### 1.4 The spec is the AI's surface area

Every design decision is evaluated through this lens: "does this make it easier for an LLM to write a correct spec?" If a feature requires the LLM to understand NestJS DI, TypeORM decorators, or import paths — it's wrong. The spec should be writable by a language model with zero knowledge of the runtime.

### 1.5 Types are contracts, not suggestions

Every hook, every notification trigger, every job handler has a typed TypeScript interface. The engine validates at load time that handlers conform to their contracts. Runtime errors from contract violations are caught and reported with context.

---

## 2. Spec Format

### 2.1 Design decision: YAML, not JSON

YAML supports comments, multi-line strings, and is more readable for humans. The AI writes YAML. The engine parses it with `js-yaml` and validates against a JSON Schema before materializing anything.

### 2.2 Formal structure

```yaml
# ─── Extension metadata ──────────────────────────────
name: string                    # required, unique, kebab-case
version: string                 # semver
displayName?: string
description?: string
author?: string

# ─── Resources ───────────────────────────────────────
resources:
  - name: string                # required, unique within extension, kebab-case
    table: string               # required, must start with ext_<name>_
    displayName?: string
    description?: string
    timestamps?: boolean        # default: true (createdAt, updatedAt)
    softDelete?: boolean        # default: true (deletedAt)
    
    fields:                     # required, at least 1
      - name: string            # required, camelCase
        type: FieldType         # required (see 2.3)
        required?: boolean      # default: false
        nullable?: boolean      # default: !required
        unique?: boolean        # default: false
        default?: any           # default value
        length?: number         # string/enum: varchar length
        precision?: number      # decimal: precision
        scale?: number          # decimal: scale
        enum?: string[]         # enum: allowed values
        ref?: string            # ref: target resource name
        refOnDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT'  # default: RESTRICT
        index?: boolean         # default: false
        validation?:            # field-level validation
          min?: number
          max?: number
          pattern?: string      # regex
          email?: boolean
          url?: boolean
    
    permissions?:               # RBAC per action
      list?: Role[]
      read?: Role[]
      create?: Role[]
      update?: Role[]
      delete?: Role[]
      fields?:                  # field-level RBAC
        fieldName:
          read?: Role[]
          write?: Role[]
      rowLevel?:                # row-level security
        role:
          filter: string        # expression: 'assigneeId == ${user.id}'
    
    hooks?:                     # lifecycle hooks (escape hatch)
      beforeCreate?: string     # path to handler, relative to spec file
      afterCreate?: string
      beforeUpdate?: string
      afterUpdate?: string
      beforeDelete?: string
      afterDelete?: string
    
    notifications?:             # declarative notifications
      - name: string
        trigger: TriggerSpec    # when to fire
        channel: 'email' | 'webhook' | 'sms'
        template?: string       # path to Maizzle/Handlebars template
        to?: string             # expression or literal
        subject?: string        # expression or literal
        payload?: object        # for webhook channel
    
    jobs?:                      # scheduled jobs
      - name: string
        schedule: 'cron' | 'interval'
        value: string           # cron expr or interval (60s, 5m, 1h)
        handler: string         # path to handler
        queue?: string          # BullMQ queue name (default: 'spec-jobs')
        retries?: number        # default: 3
        backoff?: 'exponential' | 'fixed'  # default: exponential
    
    webhooks?:                  # inbound webhook endpoints
      - name: string
        path: string            # URL path
        method: 'POST'
        auth: 'none' | 'hmac' | 'jwt'
        handler: string         # path to handler
    
    seeds?:                     # seed data
      - object

# ─── Config (optional) ───────────────────────────────
config?:
  - name: string
    required: boolean
    default?: any
    description?: string

# ─── Overrides (optional) ────────────────────────────
overrides?:                     # override plugin resources
  - resource: string
    fields:
      add?: FieldSpec[]
      remove?: string[]
    permissions?: PermissionSpec
```

### 2.3 FieldType enum

```typescript
type FieldType =
  | 'string'      // varchar, default length 255
  | 'text'        // text, no length limit
  | 'integer'     // int4
  | 'decimal'     // numeric(10,2) by default
  | 'boolean'     // bool
  | 'datetime'    // timestamptz
  | 'date'        // date
  | 'json'        // jsonb
  | 'enum'        // varchar, validated against enum values
  | 'ref'         // integer FK to another resource
  | 'file'        // file reference (uses StorageModule)
```

### 2.4 Role type

```typescript
type Role = 'admin' | 'customer' | 'affiliate' | 'public'
```

The engine maps these to `RoleEnum` values from `@iam/roles/roles.enum.ts`:
- `admin` → `RoleEnum.admin` (1)
- `customer` → `RoleEnum.customer` (2)
- `affiliate` → `RoleEnum.affiliate` (3)
- `public` → no auth guard applied

### 2.5 TriggerSpec

```typescript
type TriggerSpec =
  | { on: 'beforeCreate' | 'afterCreate' | 'beforeUpdate' | 'afterUpdate' | 'beforeDelete' | 'afterDelete' }
  | { on: 'job'; jobName: string }
  | { on: 'webhook'; webhookName: string }
```

With optional `when` condition:
```yaml
trigger:
  on: afterCreate
  when: 'priority == urgent && assigneeId != null'
```

The `when` expression is evaluated against the entity data using a safe expression evaluator (not `eval`). Candidates: `expr-eval` library or a simple custom parser for `==`, `!=`, `&&`, `||`, field access, and `${var}` interpolation.

### 2.6 Validation

The engine validates every spec at load time:

1. **JSON Schema validation** — structural correctness (required fields, types, enums)
2. **Cross-reference validation** — `ref` targets exist, `refOnDelete` is valid, hook paths resolve to files, template paths resolve to files
3. **Conflict detection** — table names don't collide with existing entities, resource names are unique across all loaded specs
4. **Permission validation** — roles are valid, rowLevel filters reference real fields

If validation fails, the engine logs structured errors and does NOT materialize the resource. Other valid resources still load.

---

## 3. Lifecycle Pipeline

### 3.1 The 7-stage pipeline

Every HTTP request to a spec-driven resource passes through this pipeline:

```
Request → Auth → Validation → BeforeHook → DB → AfterHook → Notifications → Response
           │        │            │         │       │           │
           │        │            │         │       │           │
          1        2            3         4       5           6
```

Stage 7 is the HTTP response itself.

### 3.2 Stage 1: Auth Guard

```
Input:  HTTP request + spec.permissions
Output: Authenticated user or 401/403
Uses:  AuthGuard('jwt'), RolesGuard from @iam
```

The dynamic controller applies:
- `@UseGuards(AuthGuard('jwt'), RolesGuard)` if any permissions defined
- `@Roles(...roleNumbers)` per method, mapped from spec

For `public` permissions: no guard applied, `req.user` may be null.

For row-level permissions: the controller injects a WHERE clause into the repository query. Example: `customer` with `rowLevel.filter: 'assigneeId == ${user.id}'` → `WHERE "assigneeId" = 42`.

### 3.3 Stage 2: Validation

```
Input:  Request body + spec.fields
Output: Validated data or 400 with field-level errors
Uses:  Zod schema generated by ValidationFactory
```

The Zod schema is built once at materialization time and cached. Validation errors are returned as:
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "validation": [
    { "field": "title", "message": "String must contain at least 2 character(s)" },
    { "field": "priority", "message": "Invalid enum value. Expected 'low' | 'medium' | 'high' | 'urgent'" }
  ]
}
```

### 3.4 Stage 3: Before Hook

```
Input:  Validated data + HookContext
Output: { data: ModifiedData, proceed: boolean } | throws to abort
Uses:  HookContext (see section 4)
```

The hook is a function loaded via `require()`. It receives the validated data and a context object. It can:
- Modify data (add fields, transform values)
- Enrich data (fetch related records, compute defaults)
- Abort the operation (`proceed: false` or throw `HookAbortError`)
- Log via `ctx.logger`
- Access other repositories via `ctx.getRepository()`
- Access Foundation services via `ctx.getService()`

If the hook throws, the operation is aborted and the error is returned to the client as a 400 with the hook's error message. If the hook returns `{ proceed: false, error }`, same result.

### 3.5 Stage 4: DB Operation

```
Input:  Data (possibly modified by before hook)
Output: Entity instance
Uses:  TypeORM dynamic repository (EntitySchema-based)
```

Standard TypeORM operations:
- `create`: `repository.save(data)`
- `update`: `repository.findOne()` → `Object.assign(existing, data)` → `repository.save(existing)`
- `delete`: `repository.softDelete(id)` (if softDelete enabled) or `repository.delete(id)`
- `read`: `repository.findOne()` / `repository.findAndCount()`

Row-level filters from Stage 1 are applied as WHERE clauses here.

### 3.6 Stage 5: After Hook

```
Input:  Saved entity + HookContext
Output: void (side effects only)
Uses:  HookContext
```

The after hook runs after the DB operation succeeds but before the response is sent. It's for side effects:
- Send notifications
- Sync to external systems
- Update related records
- Log audit trails

If the after hook throws, the DB operation is NOT rolled back (it already succeeded). The error is logged via `ctx.logger` and reported to `ErrorTrackerService`. The HTTP response still succeeds — the client sees the created/updated entity.

This is a deliberate choice: after hooks are fire-and-forget. If you need transactional consistency, use a before hook that does everything in one operation, or use a job that retries.

### 3.7 Stage 6: Notifications

```
Input:  Entity + operation type + spec.notifications
Output: Side effects (emails, webhooks, SMS)
Uses:  NotificationDispatcher → MailerService / QueuedMailerService / fetch
```

The NotificationDispatcher evaluates all notification specs for the resource:
1. Filter by `trigger.on` matching the current operation
2. Evaluate `when` condition against entity data
3. For each matching notification:
   - `channel: email` → render template with Handlebars, send via `QueuedMailerService.sendMail(EmailJobData)`
   - `channel: webhook` → POST payload to URL via `fetch`
   - `channel: sms` → via configured SMS provider (future)

Notifications are async and non-blocking. Failures are logged to ErrorTrackerService and retried by BullMQ (if email channel).

### 3.8 Stage 7: HTTP Response

```
Output: JSON entity + pagination metadata (for list)
```

Standard response shape:
```json
// Single item
{ "id": 1, "title": "...", ... }

// Paginated list
{
  "data": [...],
  "meta": { "total": 42, "page": 1, "limit": 20, "totalPages": 3 }
}
```

Field-level RBAC is applied here: fields the user can't read are stripped from the response.

---

## 4. HookContext

### 4.1 The contract

```typescript
interface HookContext {
  // ─── Operation metadata ───────────────────────────
  operation: 'create' | 'update' | 'delete' | 'read';
  resource: string;
  user: AuthenticatedUser | null;   // from req.user (JwtPayloadType)

  // ─── Data access ──────────────────────────────────
  getRepository(name: string): Repository<any>;
  // Returns the TypeORM repository for any spec-driven resource.
  // For existing Foundation entities (User, Role, File), returns
  // the repository registered by their respective modules.

  // ─── Foundation services ──────────────────────────
  getService<T = any>(token: string): T;
  // Resolves any NestJS provider by DI token.
  // Known tokens (see 4.3):
  //   'MailerService'        → MailerService (sync email)
  //   'QueuedMailerService'  → QueuedMailerService (async email via BullMQ)
  //   'EmailService'         → EmailService (queue management)
  //   'FilesService'         → FilesService (file CRUD facade)
  //   'FilesS3PresignedService' → presigned URL generation
  //   'ErrorTrackerService'  → ErrorTrackerService (error logging)
  //   'ConfigService'        → ConfigService<AllConfigType>

  // ─── Config ───────────────────────────────────────
  config(key: string): any;
  // Shortcut for configService.get(key, { infer: true }).
  // Examples: config('app.notificationEmail'), config('mail.host')

  // ─── Email helper ─────────────────────────────────
  sendEmail(data: EmailJobData): Promise<void>;
  // Shortcut for queudMailerService.sendMail(data).
  // Uses the same EmailJobData contract as Foundation's queue.

  // ─── Logger ───────────────────────────────────────
  logger: Logger;
  // NestJS Logger scoped to the hook name.

  // ─── Abort ────────────────────────────────────────
  abort(message: string, statusCode?: number): never;
  // Throws HookAbortError, which the engine catches and
  // returns to the client as an HTTP error (default 400).
}
```

### 4.2 AuthenticatedUser

```typescript
interface AuthenticatedUser {
  id: number;
  role: {
    id: number;       // RoleEnum value
    name: string;     // 'admin' | 'customer' | 'affiliate'
    homeRoute?: string;
  };
  sessionId: string;
  language: string;
  iat: number;
  exp: number;
}
```

This matches the actual `JwtPayloadType` from `@iam/auth/strategies/types/jwt-payload.type.ts`. The `role` is an object (not just an ID), matching how `req.user` is populated after JWT validation.

### 4.3 Service token registry

The engine maintains a registry of known DI tokens that hooks can resolve:

```typescript
const SERVICE_TOKENS = {
  MailerService: MailerService,
  QueuedMailerService: QueuedMailerService,
  EmailService: EmailService,
  FilesService: FilesService,
  FilesS3Service: FilesS3Service,
  FilesS3PresignedService: FilesS3PresignedService,
  FilesLocalService: FilesLocalService,
  ErrorTrackerService: ErrorTrackerService,
  ConfigService: ConfigService,
} as const;
```

`ctx.getService('MailerService')` resolves to the actual class token and retrieves it from NestJS DI. This is NOT a service locator anti-pattern — it's a controlled bridge between the hook's pure function world and NestJS's DI world.

### 4.4 Hook signature

```typescript
// Before hook — can modify data and abort
interface BeforeHook {
  (data: Record<string, unknown>, ctx: HookContext): Promise<BeforeHookResult>;
}

interface BeforeHookResult {
  data: Record<string, unknown>;  // possibly modified
  proceed: boolean;               // false = abort
  error?: string;                 // shown to client if proceed=false
}

// After hook — side effects only
interface AfterHook {
  (entity: Record<string, unknown>, ctx: HookContext): Promise<void>;
}
```

### 4.5 Hook loading and validation

At materialization time, the engine:
1. `require(handlerPath)` — loads the handler module
2. Checks that `module.default` is a function
3. Wraps it in a typed caller that catches errors and converts them to `HookAbortError` or logs them
4. If the handler file doesn't exist or doesn't export a function, logs a structured error and skips the hook (the resource still works, just without that hook)

---

## 5. Notification System

### 5.1 Architecture

```
spec.notifications
    │
    ▼
NotificationDispatcher (provider in SpecEngineModule)
    │
    ├── evaluates trigger.on against current operation
    ├── evaluates when condition against entity data
    │
    ├── channel: email
    │   ├── resolves template path (relative to spec file)
    │   ├── renders Handlebars template with entity data as context
    │   │   └── template receives: { entity, user, app }
    │   ├── injects app_url from config (app.backendDomain)
    │   ├── calls QueuedMailerService.sendMail(EmailJobData)
    │   │   └── EmailJobData = { to, subject, html, templatePath?, context? }
    │   └── BullMQ handles retry (3 attempts, exponential backoff)
    │
    ├── channel: webhook
    │   ├── builds payload from spec.payload + entity data
    │   ├── POST to URL (expression-evaluated)
    │   ├── HMAC signature if auth specified
    │   └── logs failures to ErrorTrackerService
    │
    └── channel: sms (future)
```

### 5.2 Maizzle integration

Foundation already has Maizzle (`@maizzle/framework` in dependencies). The workflow:

1. **Source templates** live in `apps/back/emails/` as `.mjml` or `.html` files (Maizzle source)
2. **Built templates** are compiled by `pnpm maizzle:build` to `apps/back/build/` as `.hbs` files (Handlebars)
3. **Spec references** point to the built `.hbs` file:

```yaml
notifications:
  - name: task-assigned
    trigger: { on: afterCreate }
    channel: email
    template: ./templates/task-assigned.hbs   # relative to spec file
    to: '${entity.assignee.email}'
    subject: 'Nueva tarea asignada: ${entity.title}'
```

4. **At runtime**, the NotificationDispatcher:
   - Resolves the template path (relative to spec file, absolute if starts with `/`)
   - Reads the `.hbs` file
   - Compiles with Handlebars (`{ strict: true }`)
   - Passes context: `{ entity: {...}, user: {...}, app: { url, name } }`
   - Calls `QueuedMailerService.sendMail({ to, subject, html: renderedTemplate })`

This matches exactly how `MailerService.sendMail()` works today — the engine just automates the dispatch.

### 5.3 Template context

Every email template receives:

```typescript
interface EmailTemplateContext {
  entity: Record<string, unknown>;  // the full entity that triggered the notification
  user: AuthenticatedUser | null;   // the user who performed the action
  app: {
    url: string;                    // app.backendDomain from config
    name: string;                   // app.name from config
    notificationEmail: string;      // app.notificationEmail
  };
  // Any custom fields from spec.notifications.payload
}
```

Example template:
```handlebars
<!-- templates/task-assigned.hbs -->
<h1>Nueva tarea asignada</h1>
<p>Te han asignado la tarea: <strong>{{entity.title}}</strong></p>
<p>Prioridad: {{entity.priority}}</p>
<p>Fecha límite: {{entity.dueDate}}</p>
<a href="{{app.url}}/app/tasks/{{entity.id}}">Ver tarea</a>
```

### 5.4 Expression evaluation

Fields like `to`, `subject`, and `payload` support `${expression}` interpolation:

```yaml
to: '${entity.assignee.email}'
subject: 'Nueva tarea: ${entity.title}'
```

The engine evaluates `${...}` against the template context. For complex logic (conditional recipients, dynamic subjects), use a hook that calls `ctx.sendEmail()` directly.

---

## 6. File Handling

### 6.1 Spec definition

```yaml
fields:
  - name: attachment
    type: file
    storage: s3                 # 'local' | 's3' | 's3-presigned' (default: from config file.driver)
    allowedMimes:               # validated at upload time
      - 'application/pdf'
      - 'image/png'
      - 'image/jpeg'
    maxSize: 10485760           # 10MB in bytes
    isPublic: false             # default: false
    context: 'task_attachment'  # optional categorization
```

### 6.2 Upload flow (presigned S3)

```
1. Client: POST /api/v1/tasks with body:
   { "title": "...", "attachment": { "name": "doc.pdf", "type": "application/pdf", "size": 50000 } }

2. Engine validation:
   ├── Check type is in allowedMimes
   ├── Check size <= maxSize
   └── If invalid → 400 with field-level error

3. Engine calls FilesS3PresignedService.create(FileUploadDto):
   ├── Creates FileEntity in DB (path, type, size, name)
   └── Returns { file, uploadSignedUrl }

4. Engine saves task with attachment = file.id

5. Response:
   {
     "id": 1,
     "title": "...",
     "attachment": {
       "fileId": "abc-123",
       "uploadUrl": "https://s3.../presigned-put-url",
       "path": "tasks/abc-123.pdf"
     }
   }

6. Client uploads file directly to S3 via PUT to uploadUrl
```

### 6.3 Read flow

```
1. Client: GET /api/v1/tasks/1

2. Engine loads task, sees attachment field of type 'file'

3. Engine calls FilesS3Service.getPresignedUrl(file.path):
   ├── Returns GET presigned URL (expires in 3600s)
   └── Or getPublicUrl if isPublic=true

4. Response:
   {
     "id": 1,
     "title": "...",
     "attachment": {
       "fileId": "abc-123",
       "url": "https://s3.../presigned-get-url",
       "name": "doc.pdf",
       "type": "application/pdf",
       "size": 50000
     }
   }
```

### 6.4 Integration with existing StorageModule

The engine does NOT create its own file storage. It uses `FilesService`, `FilesS3PresignedService`, and `FilesS3Service` — the exact same services that Foundation extensions use today.

The `file` field type is handled specially in:
- `EntityFactory`: stored as `varchar` (file ID is a string UUID)
- `ValidationFactory`: validates against allowed MIME types and max size
- `ControllerFactory`: on create/update, calls the appropriate Files service; on read, resolves to a URL
- `HookContext`: `ctx.getService('FilesS3PresignedService')` available for custom file operations

---

## 7. Auth & RBAC

### 7.1 What the spec engine consumes from IamModule

| Component | From | Used for |
|---|---|---|
| `AuthGuard('jwt')` | `@nestjs/passport` | JWT authentication |
| `RolesGuard` | `@iam/roles/roles.guard` | Role-based authorization |
| `@Roles(...)` | `@iam/roles/roles.decorator` | Setting required roles on methods |
| `RoleEnum` | `@iam/roles/roles.enum` | Mapping role names to IDs |
| `req.user` (JwtPayloadType) | `@iam/auth/strategies/jwt.strategy` | User identity in hooks |

### 7.2 Permission resolution

Spec roles → RoleEnum → RolesGuard:

```yaml
permissions:
  create: [admin]
  update: [admin, customer]
```

```
Engine:
  create: [admin] → [RoleEnum.admin] → [1] → @Roles(1)
  update: [admin, customer] → [1, 2] → @Roles(1, 2)
```

The RolesGuard already works by comparing `String(req.user?.role?.id)` against the metadata. No changes needed.

### 7.3 Row-level security

```yaml
permissions:
  list: [admin, customer]
  read: [admin, customer]
  rowLevel:
    customer:
      filter: 'assigneeId == ${user.id}'
```

The engine translates this into a TypeORM WHERE clause:

```typescript
// For customer role:
if (user.role.id === RoleEnum.customer) {
  query.where = { ...query.where, assigneeId: user.id };
}
```

The filter expression supports:
- `field == ${user.id}` → equality
- `field != value` → inequality
- `field in [1, 2, 3]` → IN clause
- `field == ${user.role.id}` → any user property

For complex filters (joins, OR conditions), use a before hook on the `read` operation that modifies the query. (This requires extending the hook contract to support query modification — see 7.5.)

### 7.4 Field-level RBAC

```yaml
permissions:
  fields:
    assigneeId:
      read: [admin]           # customer can't see assigneeId
    position:
      read: [admin]
      write: [admin]          # customer can't set position
```

On response (Stage 7), the engine strips fields the user can't read. On validation (Stage 2), the engine rejects fields the user can't write.

### 7.5 Future: query-level hooks

For the first version, row-level filters cover the 90% case. For complex queries (join filters, geospatial, full-text), a future `beforeQuery` hook type will allow modifying the TypeORM FindOptions:

```typescript
interface BeforeQueryHook {
  (options: FindManyOptions, ctx: HookContext): Promise<FindManyOptions>;
}
```

This is not in the first implementation but the design accommodates it.

---

## 8. Jobs

### 8.1 Spec definition

```yaml
jobs:
  - name: stale-tasks-detector
    schedule: cron
    value: '*/5 * * * *'          # 5-minute cron
    handler: ./handlers/stale-tasks.handler.ts
    queue: spec-jobs               # BullMQ queue name
    retries: 3
    backoff: exponential
```

### 8.2 Architecture

```
SpecEngineModule.register()
    │
    ├── For each job in spec:
    │   ├── BullModule.registerQueue({ name: job.queue })
    │   ├── queue.add(job.name, { handlerPath, resourceSpec }, { repeat: { pattern: cron } })
    │   └── Dynamic processor registered for queue
    │
    └── DynamicProcessor extends WorkerHost
        ├── process(job): require(job.data.handlerPath).default(ctx)
        ├── ctx = HookContext (same as hooks)
        ├── retries + backoff handled by BullMQ
        └── failures logged to ErrorTrackerService
```

### 8.3 Dual mode (Redis on/off)

Following the exact pattern of `EmailQueueModule`:
- If `WORKER_HOST` is set and valid → BullMQ queue + processor
- If not → `setInterval` fallback (for dev without Redis)

The handler is the same in both cases — only the scheduler changes.

### 8.4 Job handler contract

```typescript
interface JobHandler {
  (ctx: HookContext): Promise<void>;
}
```

The job handler receives the same `HookContext` as hooks — same access to repositories, services, config, logger. This is intentional: jobs are just hooks that run on a schedule instead of on a lifecycle event.

### 8.5 Stale tasks example

```yaml
jobs:
  - name: stale-tasks-detector
    schedule: interval
    value: 60s
    handler: ./handlers/stale-tasks.handler.ts
```

```typescript
// handlers/stale-tasks.handler.ts
import type { HookContext } from '@core/spec-engine';

export default async function staleTasksDetector(ctx: HookContext): Promise<void> {
  const taskRepo = ctx.getRepository('task');
  const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago

  const staleTasks = await taskRepo.find({
    where: { status: 'pending' },
    // Note: TypeORM EntitySchema doesn't support LessThan directly,
    // so we use a query builder:
  });

  const stale = await taskRepo
    .createQueryBuilder('task')
    .where('task.status = :status', { status: 'pending' })
    .andWhere('task.createdAt < :threshold', { threshold })
    .getMany();

  if (stale.length === 0) {
    ctx.logger.log('No stale tasks found');
    return;
  }

  ctx.logger.warn(`Found ${stale.length} stale tasks`);

  // Send notification to admin
  await ctx.sendEmail({
    to: ctx.config('app.notificationEmail'),
    subject: `${stale.length} tareas pendientes sin actualizar`,
    templatePath: './templates/stale-tasks.hbs',
    context: { staleTasks, count: stale.length },
  });
}
```

---

## 9. Migrations

### 9.1 The problem

TypeORM `synchronize: true` works in dev but is dangerous in production. The spec engine needs a way to generate proper migration files from spec changes.

### 9.2 Approach: spec diffing

```
spec:generate-migration <extension-name>
    │
    ├── Load current spec from extensions/<name>/*.spec.yaml
    ├── Load previous spec snapshot from DB (table: spec_schema_version)
    │   └── stored as JSON, keyed by resource name
    │
    ├── Diff current vs previous:
    │   ├── Field added → ADD COLUMN
    │   ├── Field removed → DROP COLUMN (with --force flag, else warn)
    │   ├── Field type changed → ALTER COLUMN TYPE
    │   ├── Field nullable changed → ALTER COLUMN SET/DROP NOT NULL
    │   ├── Field default changed → ALTER COLUMN SET/DROP DEFAULT
    │   ├── Index added → CREATE INDEX
    │   ├── Index removed → DROP INDEX
    │   └── Table created (new resource) → CREATE TABLE
    │
    ├── Generate migration .ts file:
    │   ├── class: SpecMigration<timestamp><Description>
    │   ├── up(): ALTER TABLE statements
    │   ├── down(): REVERSE statements
    │   └── writes to src/infrastructure/database/migrations/
    │
    └── Update spec_schema_version in DB
```

### 9.3 Spec schema version table

```sql
CREATE TABLE spec_schema_version (
  resource_name VARCHAR(100) PRIMARY KEY,
  spec_hash VARCHAR(64) NOT NULL,        -- sha256 of spec JSON
  spec_snapshot JSONB NOT NULL,           -- full spec at last migration
  migrated_at TIMESTAMPTZ DEFAULT NOW()
);
```

The engine checks this table at startup. If a spec's hash doesn't match the stored hash, it logs a warning: "Resource 'task' spec has changed since last migration. Run `spec:generate-migration tasks`."

### 9.4 Dev mode: synchronize

In development (`nodeEnv !== 'production'`), the engine uses `synchronize: true` for spec-driven entities. This matches Foundation's current behavior — TypeORM auto-creates/alters tables.

In production, `synchronize: false` and migrations are required. The engine blocks startup if spec hashes don't match stored hashes (safety check).

### 9.5 CLI command

```bash
pnpm spec:generate-migration tasks
# → reads extensions/tasks/tasks.spec.yaml
# → diffs against stored snapshot
# → generates migrations/<timestamp>-SpecTasksAddPriorityField.ts
# → logs: "Generated migration: AddPriorityField (1 up, 1 down)"

pnpm spec:diff tasks
# → shows diff between spec and DB schema without generating migration
```

---

## 10. Testing

### 10.1 Auto-generated test scaffold

The engine generates test scaffolds from specs. Not runtime — a CLI command that reads the spec and produces a `.spec.ts` file:

```bash
pnpm spec:generate-tests tasks
# → reads extensions/tasks/tasks.spec.yaml
# → generates extensions/tasks/tasks.spec.test.ts
```

### 10.2 What gets generated

```typescript
// Auto-generated test scaffold for tasks spec
describe('Tasks extension (spec-driven)', () => {
  // ─── Field validation tests ───────────────────────
  describe('POST /api/v1/tasks - validation', () => {
    it('should reject missing title (required)', async () => { /* ... */ });
    it('should reject title < 2 chars (validation.min)', async () => { /* ... */ });
    it('should reject title > 200 chars (validation.max)', async () => { /* ... */ });
    it('should reject invalid priority (enum)', async () => { /* ... */ });
    it('should reject invalid status (enum)', async () => { /* ... */ });
    it('should accept valid payload', async () => { /* ... */ });
  });

  // ─── Permission tests ─────────────────────────────
  describe('POST /api/v1/tasks - permissions', () => {
    it('should allow admin', async () => { /* ... */ });
    it('should reject customer (create: [admin])', async () => { /* ... */ });
    it('should reject unauthenticated', async () => { /* ... */ });
  });

  // ─── CRUD tests ───────────────────────────────────
  describe('CRUD operations', () => {
    it('should create task', async () => { /* ... */ });
    it('should list tasks (paginated)', async () => { /* ... */ });
    it('should find one by id', async () => { /* ... */ });
    it('should update task', async () => { /* ... */ });
    it('should soft-delete task', async () => { /* ... */ });
  });

  // ─── Hook tests (scaffold — needs implementation) ─
  describe('Hooks', () => {
    it('beforeCreate: should auto-assign admin for urgent tasks', async () => { /* TODO */ });
  });

  // ─── Job tests (scaffold) ─────────────────────────
  describe('Jobs', () => {
    it('stale-tasks-detector: should find pending tasks > 24h', async () => { /* TODO */ });
  });

  // ─── Seed tests ───────────────────────────────────
  describe('Seeds', () => {
    it('should have 4 seed tasks', async () => { /* ... */ });
  });
});
```

### 10.3 What is NOT auto-generated

- Hook implementation tests (logic is custom — scaffold only)
- Job handler tests (logic is custom — scaffold only)
- Notification delivery tests (depends on email infrastructure)
- Frontend tests

The auto-generated tests cover: validation, permissions, CRUD mechanics, and seeds. These are the boring, repetitive tests that nobody writes but everyone needs. The custom tests (hooks, jobs) are scaffolded with TODO comments.

### 10.4 Why this matters for AI

When the AI writes a spec and runs `spec:generate-tests`, it gets a test suite that validates the spec's own constraints. If the AI writes `title: { min: 2 }`, the test checks that 1-char titles are rejected. This creates a feedback loop: AI writes spec → tests validate spec → AI runs tests → tests pass or fail with specific errors → AI fixes spec.

---

## 11. Frontend

### 11.1 Phase 1: Metadata API

The spec engine exposes a metadata endpoint:

```
GET /api/v1/_spec/resources
```

Returns all loaded specs as JSON:

```json
{
  "resources": [
    {
      "name": "task",
      "displayName": "Task",
      "fields": [
        { "name": "title", "type": "string", "required": true, "validation": { "min": 2, "max": 200 } },
        { "name": "status", "type": "enum", "enum": ["pending", "in_progress", "review", "done", "blocked"] },
        ...
      ],
      "permissions": { "list": ["admin", "customer"], ... },
      "route": "/api/v1/tasks"
    }
  ]
}
```

### 11.2 Phase 2: Generic Nuxt layer

A Nuxt layer (`modules/spec-crud/`) that reads the metadata and renders generic CRUD:

```
modules/spec-crud/
├── composables/
│   └── useSpecResource.ts     ← fetches metadata, provides CRUD composable
├── components/
│   ├── SpecDataTable.vue      ← table with columns from fields
│   ├── SpecDataForm.vue       ← form with inputs from fields
│   ├── SpecFieldRenderer.vue  ← renders field by type (string, enum, date, file, ref)
│   └── SpecKanbanBoard.vue    ← kanban view for resources with status field
└── pages/
    └── app/[resource]/
        ├── index.vue          ← list view
        ├── [id].vue           ← detail view
        └── new.vue            ← create view
```

The Nuxt layer is **one implementation** that adapts to any spec. No code generation per resource.

### 11.3 Phase 3: Override layer

For resources that need custom UI, a Nuxt layer per extension overrides the generic components:

```
extensions/tasks/
├── tasks.spec.yaml
├── frontend/                   ← Nuxt layer
│   ├── pages/
│   │   └── app/tasks/
│   │       └── kanban.vue      ← custom kanban view
│   └── components/
│       └── TaskCard.vue        ← custom card component
```

The override layer extends the generic layer. Custom pages override generic pages. Generic pages handle the rest.

---

## 12. Plugin System

### 12.1 What is a plugin

A plugin is a reusable spec package. It contains:
- `plugin.spec.yaml` — resource definitions, permissions, jobs, webhooks
- `handlers/` — hook and job handler .ts files
- `templates/` — Maizzle/Handlebars email templates
- `README.md` — documentation

### 12.2 Plugin structure

```
plugins/stripe/
├── plugin.spec.yaml
├── handlers/
│   ├── stripe-webhook.handler.ts
│   └── subscription-sync.handler.ts
├── templates/
│   ├── payment-success.hbs
│   └── subscription-canceled.hbs
└── README.md
```

### 12.3 Plugin installation

```bash
pnpm spec:add plugin:stripe
# → copies plugins/stripe/ to extensions/stripe/
# → updates spec-registry.json
# → pnpm migration:generate SpecStripeInit
# → pnpm migration:run
```

### 12.4 Plugin overrides

An app can override plugin resources:

```yaml
# extensions/app/tasks.spec.yaml
overrides:
  - resource: product           # from stripe plugin
    fields:
      add:
        - name: internalSku
          type: string
          nullable: true
    hooks:
      afterCreate: ./hooks/sync-sku.ts
```

The engine merges the plugin spec with the override spec at load time.

### 12.5 Plugin registry

```json
// spec-registry.json
{
  "plugins": [
    { "name": "stripe", "version": "1.0.0", "source": "npm:@foundation/plugin-stripe" },
    { "name": "email-templates", "version": "1.0.0", "source": "local:./plugins/email-templates" }
  ]
}
```

Future: npm packages (`@foundation/plugin-stripe`) that ship as installable spec packages.

---

## 13. AI Agent Integration

### 13.1 The spec as LLM surface area

The AI writes specs. The engine validates and materializes them. The feedback loop:

```
1. AI reads PRD (natural language)
2. AI writes spec YAML
3. Engine validates spec against JSON Schema
   ├── Valid → materialize → run tests → return results
   └── Invalid → return structured errors → AI fixes spec
4. AI runs auto-generated tests
   ├── Pass → done
   └── Fail → AI reads test output → fixes spec or hook → retest
5. AI commits spec + handlers
```

### 13.2 What the AI never touches

- NestJS module wiring
- TypeORM decorators
- Class-validator DTOs
- Controller method signatures
- DI tokens
- Import paths

### 13.3 What the AI writes

- `*.spec.yaml` — declarative resource definition
- `handlers/*.ts` — pure functions with typed contracts
- `templates/*.hbs` — Handlebars email templates

### 13.4 Hermes skill for spec-driven development

A Hermes skill (`spec-driven-development`) that:

1. Loads the spec JSON Schema
2. Reads the user's PRD
3. Generates the spec YAML
4. Validates it
5. Runs `spec:generate-tests`
6. Runs the tests
7. Iterates until green
8. Commits

This is the "máquina de hacer apps" — the AI writes specs, the engine materializes them, the tests validate them, and the loop runs until everything is green.

---

## 14. Module Wiring

### 14.1 SpecEngineModule structure

```
core/spec-engine/
├── spec-engine.module.ts          ← DynamicModule, wires everything
├── spec-loader.ts                 ← Scans + parses YAML
├── spec-validator.ts              ← JSON Schema + cross-ref validation
├── entity-factory.ts              ← ResourceSpec → TypeORM EntitySchema
├── validation-factory.ts          ← ResourceSpec → Zod schema
├── controller-factory.ts          ← ResourceSpec → NestJS controller
├── hook-executor.ts               ← Loads + executes hooks with typed contracts
├── notification-dispatcher.ts     ← Evaluates triggers + dispatches to channels
├── job-scheduler.ts               ← Registers BullMQ repeatable jobs
├── webhook-controller-factory.ts  ← Creates dynamic webhook controllers
├── spec-job-runner.ts             ← Fallback setInterval runner (no Redis)
├── migration-generator.ts         ← CLI: spec diff → migration file
├── test-generator.ts              ← CLI: spec → test scaffold
├── meta-controller.ts             ← GET /api/v1/_spec/resources endpoint
├── spec.types.ts                  ← All TypeScript types
├── hook-context.ts                ← HookContext interface + implementation
└── service-registry.ts            ← DI token registry for getService()
```

### 14.2 Dependencies on Foundation modules

```
SpecEngineModule imports:
  ├── TypeOrmModule.forFeature([...dynamicEntitySchemas])
  │   └── registers repositories for all spec-driven resources
  │
  └── Depends on (already in AppModule, not imported directly):
      ├── IamModule          → AuthGuard, RolesGuard, RoleEnum (tree-shaken at compile)
      ├── MailerModule        → MailerService (accessed via HookContext.getService)
      ├── EmailQueueModule    → QueuedMailerService, EmailService (accessed via HookContext)
      ├── StorageModule       → FilesService, FilesS3PresignedService (accessed via HookContext)
      ├── ErrorTrackerModule  → ErrorTrackerService (accessed via HookContext)
      └── ConfigModule        → ConfigService (accessed via HookContext)
```

The SpecEngineModule does NOT import these modules. It relies on them being already available in the NestJS application (they're global or part of FoundationModule). The `HookContext.getService()` implementation uses `ModuleRef` to resolve providers from the global DI container.

### 14.3 ModuleRef for service resolution

```typescript
// hook-context.ts
import { ModuleRef } from '@nestjs/core';

export class HookContextImpl implements HookContext {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly user: AuthenticatedUser | null,
    private readonly resource: string,
    private readonly operation: string,
  ) {}

  getService<T>(token: string): T {
    const serviceToken = SERVICE_TOKENS[token];
    if (!serviceToken) {
      throw new Error(`Unknown service: ${token}. Available: ${Object.keys(SERVICE_TOKENS).join(', ')}`);
    }
    return this.moduleRef.get(serviceToken, { strict: false });
  }

  getRepository(name: string): Repository<any> {
    // Spec-driven resources are registered with their resource name as token
    return this.moduleRef.get('Repository_' + name, { strict: false });
  }

  config(key: string): any {
    return this.configService.get(key as any, { infer: true });
  }

  async sendEmail(data: EmailJobData): Promise<void> {
    const queuedMailer = this.getService<QueuedMailerService>('QueuedMailerService');
    return queuedMailer.sendMail(data);
  }

  // ...
}
```

`ModuleRef.get(..., { strict: false })` resolves providers from any module in the application — not just the current module. This is how the HookContext bridges to Foundation's services without importing them all.

---

## 15. What the spike got wrong

### 15.1 Repository injection

The spike uses `@Inject(entitySchemaName)` in the dynamic controller. This works when `TypeOrmModule.forFeature([entitySchema])` registers the repository with the entity schema name as token. But `EntitySchema.name` is the entity name, and TypeORM registers repositories by entity class or entity schema name. This needs to be verified — the token might be `Repository_<entityName>` or just `<entityName>`.

**Fix**: Use `DataSource.getRepository(entitySchema)` or register repositories explicitly with `TypeOrmModule.forFeature([entitySchema], '<resourceName>')` and inject with `@Inject('<resourceName>')`.

### 15.2 No HookContext

The spike has no hooks, no notifications, no lifecycle. It's pure CRUD. The handlers (stale-tasks.handler.ts) receive a `JobContext` with just a logger — no access to repositories or services.

**Fix**: Implement the full `HookContext` with `ModuleRef` as described in section 14.3.

### 15.3 No NotificationDispatcher

The spike mentions notifications in the spec but has no implementation.

**Fix**: Implement `NotificationDispatcher` as a provider that evaluates triggers and dispatches to channels.

### 15.4 No JSON Schema validation

The spike parses YAML and does basic structural validation, but no formal JSON Schema validation.

**Fix**: Write a JSON Schema for the spec format and validate with `ajv` before materializing.

### 15.5 No webhook controller materialization

The spike defines webhooks in spec but doesn't create controllers for them.

**Fix**: Implement `WebhookControllerFactory` that creates dynamic controllers for inbound webhooks with HMAC/JWT auth.

### 15.6 No migration generation

The spike relies on `synchronize: true` only.

**Fix**: Implement `migration-generator.ts` with spec diffing (section 9).

### 15.7 No test generation

No tests at all.

**Fix**: Implement `test-generator.ts` (section 10).

### 15.8 No metadata API

No way for the frontend to discover spec-driven resources.

**Fix**: Implement `MetaController` with `GET /api/v1/_spec/resources` (section 11).

### 15.9 EntitySchema relations

The spike stores `ref` fields as integer columns, not actual FK relations. No `@ManyToOne` equivalent in EntitySchema.

**Fix**: Use `EntitySchema` relations feature:
```typescript
relations: {
  assignee: {
    type: 'many-to-one',
    target: 'user',  // or the entity name
    joinColumn: { name: 'assigneeId' },
    onDelete: 'SET NULL',
  },
}
```
This requires knowing the target entity's schema at materialization time. The engine resolves refs after loading all specs.

### 15.10 File field type

The spike doesn't handle `type: file`.

**Fix**: Implement file field handling as described in section 6.

### 15.11 Expression evaluator

The spike has no `when` condition evaluator for notifications.

**Fix**: Add `expr-eval` or a custom expression parser for `when` conditions and `${interpolation}`.

### 15.12 Row-level security

Not implemented.

**Fix**: Apply WHERE clauses in the dynamic controller based on `rowLevel` spec.

### 15.13 Field-level RBAC

Not implemented.

**Fix**: Strip fields on response based on `permissions.fields[].read`.

---

## Implementation order

Ordered by dependency and impact:

1. **HookContext + HookExecutor** — without this, the engine is just CRUD
2. **NotificationDispatcher** — the most visible feature for clients
3. **WebhookControllerFactory** — completes the tasks demo
4. **EntitySchema relations** — ref fields as real FKs
5. **JSON Schema validation** — safety net for AI-generated specs
6. **Row-level + field-level RBAC** — multi-tenant support
7. **Migration generator** — production-ready
8. **Test generator** — AI feedback loop
9. **MetaController** — frontend integration
10. **Plugin system** — reusability
11. **Frontend Nuxt layer** — full-stack

Each step builds on the previous one. Steps 1-3 make the tasks demo real. Steps 4-6 make it production-safe. Steps 7-8 make it AI-driven. Steps 9-11 make it full-stack.