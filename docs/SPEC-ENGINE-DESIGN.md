# Spec Engine — Design Document

> **Status**: Design phase. Implementation starts after validation.
> **Branch**: `feat/spec-engine`
> **Date**: 2026-07-30
> **Authors**: Adrián Colom + Hermes

---

## Table of Contents

1. [Principles](#1-principles)
2. [Architecture Model](#2-architecture-model)
3. [Spec Format](#3-spec-format)
4. [Lifecycle Pipeline](#4-lifecycle-pipeline)
5. [SpecTrace — observability and debugging](#5-spectrace)
6. [Error Reporting — ErrorTracker + GitHub Issues](#6-error-reporting)
7. [HookContext — the unified interface](#7-hookcontext)
8. [Notification System](#8-notification-system)
9. [File Handling](#9-file-handling)
10. [Auth & RBAC](#10-auth--rbac)
11. [Jobs](#11-jobs)
12. [Migrations](#12-migrations)
13. [Testing](#13-testing)
14. [Views & Dashboards](#14-views--dashboards)
15. [Frontend — Deterministic vs Custom](#15-frontend)
16. [Plugin System](#16-plugin-system)
17. [AI Agent Integration](#17-ai-agent-integration)
18. [Module Wiring](#18-module-wiring)
19. [Implementation Roadmap](#19-implementation-roadmap)

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

### 1.6 Observability is built-in, not bolted-on

Every request through the pipeline produces a structured trace. Every error is logged to ErrorTrackerService with full context. Every error opens a GitHub issue with the trace, spec, and source code — so the AI can fix it autonomously.

---

## 2. Architecture Model

### 2.1 What this is

The spec engine combines three established architectural patterns:

| Pattern | What it means | Real-world examples |
|---|---|---|
| **Metadata-driven architecture** | The app is defined by data, not by code. You define objects, fields, permissions — the platform generates API + UI. | Salesforce, Directus, Strapi |
| **Declarative framework** | You declare the desired state, the framework materializes it. You don't write the commands. | Terraform (infra), Kubernetes (orchestration), Hasura (GraphQL) |
| **Interceptor pipeline** | Each request passes through a chain of extension points defined in metadata, not in code. | NestJS interceptors, Express middleware |

### 2.2 Why this works

The 80/20 insight: 80% of APIs are CRUD with validation and permissions. That's declarable. The 20% that needs custom logic uses hooks — pure functions with typed contracts. No classes, no decorators, no DI.

### 2.3 The difference from code generation

Foundation today uses **code generation** (Hygen): it reads prompts and generates 8 `.ts` files. Those files are your code. They drift from the generator. The AI has to maintain 8 files with cross-references.

The spec engine uses **runtime interpretation**: the spec is data. The engine reads it at runtime and materializes everything dynamically. No generated files. If the spec changes, the behavior changes. It's the difference between writing SQL by hand and using an ORM — the ORM doesn't generate SQL files you maintain, it interprets your entities at runtime.

### 2.4 The AI advantage

```
Without spec engine:    AI must write 8 .ts files with correct imports,
                       decorators, DI tokens, cross-references → 30+ decisions → frequent errors

With spec engine:       AI writes 1 YAML file validated against JSON Schema → 5 sequential decisions → rare errors
                       If error: engine returns structured validation errors → AI fixes
```

### 2.5 The Hytale analogy

Hytale's mod system: everything is JSON (mobs, items, blocks, behaviors). When you need custom logic, you attach a script. The JSON says "when X happens, run this script." The script is Turing-complete.

Our model: everything is YAML (resources, fields, permissions, notifications). When you need custom logic, you attach a hook. The YAML says "before create, run this hook." The hook is a pure function with a typed contract.

---

## 3. Spec Format

### 3.1 Top-level structure

```yaml
# ─── Extension metadata ──────────────────────────────
name: string                    # required, unique, kebab-case
version: string                 # semver
displayName?: string
description?: string
author?: string

# ─── Config (optional) ───────────────────────────────
config?:
  - name: string
    required: boolean
    default?: any
    description?: string

# ─── Resources ───────────────────────────────────────
resources: ResourceSpec[]       # required, at least 1

# ─── Views / Dashboards (optional) ───────────────────
views?: ViewSpec[]

# ─── Overrides (optional) ────────────────────────────
overrides?: OverrideSpec[]
```

### 3.2 ResourceSpec

```yaml
resources:
  - name: string                # required, kebab-case, unique within extension
    table: string               # required, must start with ext_<name>_
    displayName?: string
    description?: string
    timestamps?: boolean        # default: true (createdAt, updatedAt)
    softDelete?: boolean        # default: true (deletedAt)
    
    fields: FieldSpec[]         # required, at least 1
    
    permissions?: PermissionSpec
    hooks?: HookSpec
    notifications?: NotificationSpec[]
    jobs?: JobSpec[]
    webhooks?: WebhookSpec[]
    seeds?: object[]
    
    ui?: ResourceUISpec         # frontend rendering hints
```

### 3.3 FieldSpec

```yaml
fields:
  - name: string                # required, camelCase
    type: FieldType             # required
    required?: boolean          # default: false
    nullable?: boolean          # default: !required
    unique?: boolean            # default: false
    default?: any
    length?: number             # string/enum: varchar length
    precision?: number          # decimal
    scale?: number              # decimal
    enum?: string[]             # for enum type
    ref?: string                # for ref type: target resource name
    refOnDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT'  # default: RESTRICT
    index?: boolean             # default: false
    validation?:                # field-level validation
      min?: number
      max?: number
      pattern?: string          # regex
      email?: boolean
      url?: boolean
    ui?: FieldUISpec            # frontend rendering hints for this field
```

### 3.4 FieldType

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

### 3.5 PermissionSpec

```yaml
permissions:
  list?: Role[]                  # who can list
  read?: Role[]                  # who can read single
  create?: Role[]                # who can create
  update?: Role[]                # who can update
  delete?: Role[]                # who can delete
  fields?:                       # field-level RBAC
    fieldName:
      read?: Role[]              # who can see this field in responses
      write?: Role[]             # who can set this field in requests
  rowLevel?:                     # row-level security
    role:
      filter: string             # 'assigneeId == ${user.id}'
```

Role type: `'admin' | 'user' | 'public'`

The engine maps these to `RoleEnum` from `@iam/roles/roles.enum.ts`:
- `admin` → `RoleEnum.admin` (1)
- `customer` → `RoleEnum.customer` (2)
- `public` → no auth guard applied

### 3.6 HookSpec

```yaml
hooks:
  beforeCreate?: string          # path to handler, relative to spec file
  afterCreate?: string
  beforeUpdate?: string
  afterUpdate?: string
  beforeDelete?: string
  afterDelete?: string
```

### 3.7 NotificationSpec

```yaml
notifications:
  - name: string
    trigger:                     # when to fire
      on: 'beforeCreate' | 'afterCreate' | 'beforeUpdate' | 'afterUpdate' | 'beforeDelete' | 'afterDelete' | 'job' | 'webhook'
      jobName?: string           # if on: 'job'
      webhookName?: string       # if on: 'webhook'
      when?: string              # optional condition: 'priority == urgent && assigneeId != null'
    channel: 'email' | 'webhook' | 'sms'
    template?: string            # path to .hbs template (email channel)
    to?: string                  # expression or literal (email channel)
    subject?: string             # expression or literal (email channel)
    payload?: object             # for webhook channel
    url?: string                 # for webhook channel
```

### 3.8 JobSpec

```yaml
jobs:
  - name: string
    schedule: 'cron' | 'interval'
    value: string                # cron expr or interval (60s, 5m, 1h)
    handler: string              # path to handler
    queue?: string               # BullMQ queue name (default: 'spec-jobs')
    retries?: number             # default: 3
    backoff?: 'exponential' | 'fixed'  # default: exponential
```

### 3.9 WebhookSpec

```yaml
webhooks:
  - name: string
    path: string                 # URL path
    method: 'POST'
    auth: 'none' | 'hmac' | 'jwt'
    handler: string              # path to handler
```

### 3.10 ResourceUISpec

```yaml
ui:
  icon: string                   # sidebar icon name
  view: 'table' | 'kanban' | 'list'   # admin default view
  kanbanColumn?: string          # field used as kanban column
  kanbanOrder?: string           # field used to sort cards
  sidebar:                       # navbar injection
    heading: string
    items:
      - title: string
        icon: string
        link: string
        roles?: Role[]           # visibility filter
```

### 3.11 FieldUISpec

```yaml
ui:
  display: 'text' | 'badge' | 'date' | 'avatar' | 'truncate' | 'icon' | 'link'
  formInput: 'text' | 'textarea' | 'select' | 'datepicker' | 'file-upload' | 'select-async'
  link?: boolean                 # clickable in table → detail view
  colors?: object                # for badge: { pending: '#f59e0b', done: '#22c55e' }
  truncateLength?: number        # for truncate display
  labelField?: string            # for ref select-async: which field of target to show
```

### 3.12 ViewSpec (dashboards)

```yaml
views:
  - name: string
    displayName?: string
    type: 'dashboard' | 'custom'
    roles: Role[]
    panels?: PanelSpec[]         # for type: dashboard
    
    handler?: string             # for type: custom
    component?: string           # for type: custom or custom panels
```

### 3.13 PanelSpec

```yaml
panels:
  - name: string
    chart: 'stat' | 'donut' | 'bar' | 'line' | 'custom'
    label?: string               # for stat
    query?: QuerySpec            # data source
    transform?: string           # path to transform hook (level 2)
    component?: string           # path to Vue component (custom chart)
```

### 3.14 QuerySpec

```yaml
query:
  resource: string               # 'task'
  aggregate: 'count' | 'sum' | 'avg' | 'min' | 'max'
  aggregateField?: string        # for sum/avg/min/max
  groupBy?: string               # field to group by
  groupByInterval?: 'hour' | 'day' | 'week' | 'month'  # for date fields
  timeRange?: string             # '7d', '30d', '90d', '1y'
  filter?: string                # 'priority == urgent && status != done'
  sort?: { field: string, order: 'asc' | 'desc' }
  limit?: number                 # top N
  having?: string                # 'count > 5'
```

### 3.15 Validation

The engine validates every spec at load time in 4 phases:

1. **JSON Schema validation** — structural correctness (required fields, types, enums). Uses `ajv`.
2. **Cross-reference validation** — `ref` targets exist, `refOnDelete` is valid, hook paths resolve to files, template paths resolve to files.
3. **Conflict detection** — table names don't collide with existing entities, resource names are unique across all loaded specs.
4. **Permission validation** — roles are valid, rowLevel filters reference real fields.

If validation fails, the engine logs structured errors and does NOT materialize the resource. Other valid resources still load.

---

## 4. Lifecycle Pipeline

### 4.1 The 7-stage pipeline

Every HTTP request to a spec-driven resource passes through this pipeline:

```
Request → Auth → Validation → BeforeHook → DB → AfterHook → Notifications → Response
           │        │            │         │       │           │              │
          (1)      (2)          (3)       (4)     (5)         (6)            (7)
```

Each stage is independent. Each stage uses existing Foundation modules. The engine orchestrates, never replaces.

### 4.2 Stage 1: Auth Guard

```
Input:  HTTP request + spec.permissions
Output: Authenticated user or 401/403
Uses:  AuthGuard('jwt'), RolesGuard from @iam
```

The dynamic controller applies:
- `@UseGuards(AuthGuard('jwt'), RolesGuard)` if any permissions defined
- `@Roles(...roleNumbers)` per method, mapped from spec

For `public` permissions: no guard applied, `req.user` may be null.

For row-level permissions: the controller injects a WHERE clause into the repository query.

### 4.3 Stage 2: Validation

```
Input:  Request body + spec.fields
Output: Validated data or 400 with field-level errors
Uses:  Zod schema generated by ValidationFactory
```

Validation errors are returned as:
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "validation": [
    { "field": "title", "message": "String must contain at least 2 character(s)" },
    { "field": "priority", "message": "Invalid enum value" }
  ]
}
```

Field-level RBAC write permissions are enforced here: fields the user can't write are rejected.

### 4.4 Stage 3: Before Hook

```
Input:  Validated data + HookContext
Output: { data: ModifiedData, proceed: boolean } | throws to abort
Uses:  HookContext (see section 7)
```

The hook can:
- Modify data (add fields, transform values)
- Enrich data (fetch related records, compute defaults)
- Abort the operation (`proceed: false` or `ctx.abort()`)
- Access other repositories via `ctx.getRepository()`
- Access Foundation services via `ctx.getService()`
- Write to the trace via `ctx.trace.add()`

If the hook throws `HookAbortError`, the operation is aborted and the error is returned to the client as an HTTP error (default 400). Other errors are caught, logged to ErrorTracker, and returned as 500.

### 4.5 Stage 4: DB Operation

```
Input:  Data (possibly modified by before hook)
Output: Entity instance
Uses:  TypeORM dynamic repository (EntitySchema-based)
```

Row-level filters from Stage 1 are applied as WHERE clauses here.

### 4.6 Stage 5: After Hook

```
Input:  Saved entity + HookContext
Output: void (side effects only)
Uses:  HookContext
```

The after hook runs after the DB operation succeeds but before the response is sent. It's for side effects: notifications, external sync, audit trails.

If the after hook throws, the DB operation is NOT rolled back (it already succeeded). The error is logged via `ctx.logger` and reported to `ErrorTrackerService`. The HTTP response still succeeds.

This is a deliberate choice: after hooks are fire-and-forget. If you need transactional consistency, use a before hook or a job that retries.

### 4.7 Stage 6: Notifications

```
Input:  Entity + operation type + spec.notifications
Output: Side effects (emails, webhooks, SMS)
Uses:  NotificationDispatcher → QueuedMailerService / fetch
```

The NotificationDispatcher:
1. Filters notifications by `trigger.on` matching the current operation
2. Evaluates `when` condition against entity data
3. For each matching notification, dispatches to the appropriate channel

Notifications are async and non-blocking. Failures are logged to ErrorTrackerService and retried by BullMQ.

### 4.8 Stage 7: HTTP Response

```
Output: JSON entity + pagination metadata (for list)
```

Field-level RBAC read permissions are applied here: fields the user can't read are stripped from the response.

---

## 5. SpecTrace

### 5.1 Why tracing matters

The spec engine is an interpreter. If something fails — a hook doesn't execute, a notification doesn't fire, a permission is wrong — you need to see exactly what happened at each stage. Without tracing, it's a black box.

### 5.2 SpecTrace structure

Every request builds a trace as it passes through the 7 stages:

```typescript
interface SpecTrace {
  requestId: string;              // correlation ID
  resource: string;
  operation: 'create' | 'read' | 'update' | 'delete' | 'list';
  user: { id: number; role: string } | null;
  stages: TraceStage[];
  totalDurationMs: number;
}

interface TraceStage {
  stage: 'auth' | 'validation' | 'beforeHook' | 'db' | 'afterHook' | 'notifications' | 'response';
  status: 'pass' | 'fail' | 'skip';
  durationMs: number;
  input: unknown;
  output: unknown;
  error?: { message: string; code: string };
  meta?: Record<string, unknown>;
}
```

### 5.3 Example trace

```json
{
  "requestId": "req_abc123",
  "resource": "task",
  "operation": "create",
  "user": { "id": 1, "role": "admin" },
  "totalDurationMs": 42,
  "stages": [
    { "stage": "auth", "status": "pass", "durationMs": 1, "meta": { "guard": "jwt", "rolesChecked": [1] } },
    { "stage": "validation", "status": "pass", "durationMs": 2, "meta": { "schema": "task.create", "rulesChecked": 6 } },
    { "stage": "beforeHook", "status": "pass", "durationMs": 8, "meta": { "hook": "task-before-create", "modified": ["assigneeId", "dueDate"], "proceed": true } },
    { "stage": "db", "status": "pass", "durationMs": 12, "meta": { "operation": "INSERT", "table": "ext_tasks_task" } },
    { "stage": "afterHook", "status": "skip", "durationMs": 0, "meta": { "reason": "no afterCreate hook defined" } },
    { "stage": "notifications", "status": "pass", "durationMs": 19, "meta": { "evaluated": 2, "matched": 1, "fired": [{ "name": "notify-assignee", "channel": "email", "to": "admin@..." }], "skipped": [{ "name": "task-stale", "reason": "when condition false" }] } },
    { "stage": "response", "status": "pass", "durationMs": 0, "meta": { "fieldsStripped": [], "rowLevelFilterApplied": false } }
  ]
}
```

### 5.4 Access modes

**Dev mode** (`nodeEnv !== 'production'`):
- `X-Spec-Trace` response header with trace compressed in base64
- `?_trace=true` query param → response includes `__trace` at the end
- CLI: `pnpm spec:trace task create --body '{...}' --user admin` → prints colored trace in console

**Prod mode**:
- Trace logged as structured JSON at debug level
- If request fails (status >= 400), trace sent to `ErrorTrackerService` with full context
- `GET /api/v1/_spec/trace/:requestId` — admin-only endpoint to retrieve recent traces

### 5.5 CLI trace output

```
spec:trace — task.create
──────────────────────────────────────────────────────
[1] auth           ✅  1ms   guard=jwt  roles=[admin]
[2] validation     ✅  2ms   6 rules checked  0 errors
[3] beforeHook     ✅  8ms   hook=task-before-create
                        └─ modified: assigneeId=1, dueDate=2026-08-01
[4] db             ✅ 12ms  INSERT ext_tasks_task → id=42
[5] afterHook      ⏭️  0ms  no hook defined
[6] notifications  ✅ 19ms  2 evaluated → 1 matched
                        └─ 🔥 notify-assignee (email → admin@...)
                        └─ ⏭️ task-stale (when: false)
[7] response       ✅  0ms  200 OK
──────────────────────────────────────────────────────
Total: 42ms
```

### 5.6 Trace in hooks

Hooks can write to the trace via `ctx.trace.add()`:

```typescript
export default async function beforeCreate(data, ctx) {
  ctx.trace.add('beforeCreate', {
    decision: 'auto-assign-admin',
    reason: 'priority=urgent and no assignee',
  });
  // ...
}
```

`ctx.trace` is a `TraceWriter` that only works in dev mode or tests. In prod, it's a no-op (unless the request fails, in which case the trace is captured regardless).

---

## 6. Error Reporting

### 6.1 The autonomous feedback loop

```
Spec engine fails
    │
    ├── ErrorTrackerService.logError()  ← existing Foundation module
    │   ├── stores in DB (ErrorLogEntity)
    │   ├── deduplicates by hash (sha256 of message+source+stack)
    │   └── increments occurrences if repeated
    │
    └── GitHub Issue auto-created
        ├── title: [spec-engine] Resource "task" failed
        ├── body: trace + spec + error + source code
        ├── labels: [bug, spec-engine, auto-generated]
        └── deduplicated: only 1 issue per unique error hash
```

### 6.2 What goes into the GitHub issue

```markdown
## [spec-engine] task.beforeCreate hook failed

**Error**: `TypeError: Cannot read property 'id' of null`
**Resource**: task
**Operation**: create
**Stage**: beforeHook
**Hook**: ./hooks/task-before-create.ts

### Trace
[1] auth ✅  [2] validation ✅  [3] beforeHook ❌ TypeError: ...

### Input data
{ "title": "Fix bug", "priority": "urgent", "status": "pending" }

### Spec (relevant section)
hooks:
  beforeCreate: ./hooks/task-before-create.ts

### Hook source
// ./hooks/task-before-create.ts line 12
const admin = await userRepo.findOne({ where: { role: { id: 1 } } });
data.assigneeId = admin.id;  // ← admin is null

### Environment
- Extension: tasks v1.0.0
- Foundation: 1.2.0
- Spec hash: a1b2c3...
```

### 6.3 SpecErrorReporter

```typescript
@Injectable()
export class SpecErrorReporter {
  constructor(
    private readonly errorTracker: ErrorTrackerService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async report(error: SpecError): Promise<void> {
    // 1. Always log to DB
    await this.errorTracker.logError({
      message: error.message,
      source: `spec-engine:${error.resource}:${error.stage}`,
      stack: error.stack,
      metadata: {
        requestId: error.requestId,
        resource: error.resource,
        operation: error.operation,
        stage: error.stage,
        trace: error.trace,
        specHash: error.specHash,
        hookPath: error.hookPath,
        inputData: error.inputData,
      },
    });

    // 2. Open GitHub issue (only on first occurrence, prod only)
    if (this.shouldCreateIssue(error)) {
      await this.createGitHubIssue(error);
    }
  }

  private shouldCreateIssue(error: SpecError): boolean {
    // Only on first occurrence (occurrences === 1)
    // Only in production
    // Only if GitHub token configured
    return error.occurrences === 1
      && this.configService.get('app.nodeEnv') === 'production'
      && !!this.configService.get('app.githubToken');
  }
}
```

### 6.4 Error types reported

| Error | Stage | Example |
|---|---|---|
| Spec invalid | load | `ref target "user" not found` |
| Hook crash | beforeHook/afterHook | `TypeError in hook` |
| Notification fail | notifications | `template not found` |
| Job fail | job | `handler crash` |
| Webhook handler fail | webhook | `HMAC verification failed` |
| Validation spec error | load | `field "title" has no type` |

---

## 7. HookContext

### 7.1 The contract

```typescript
interface HookContext {
  // ─── Operation metadata ───────────────────────────
  operation: 'create' | 'update' | 'delete' | 'read';
  resource: string;
  user: AuthenticatedUser | null;

  // ─── Data access ──────────────────────────────────
  getRepository(name: string): Repository<any>;

  // ─── Foundation services ──────────────────────────
  getService<T = any>(token: string): T;
  // Known tokens:
  //   'MailerService'           → MailerService (sync email)
  //   'QueuedMailerService'     → QueuedMailerService (async email via BullMQ)
  //   'EmailService'            → EmailService (queue management)
  //   'FilesService'            → FilesService (file CRUD facade)
  //   'FilesS3PresignedService' → presigned URL generation
  //   'FilesS3Service'          → S3 file operations
  //   'FilesLocalService'       → local file operations
  //   'ErrorTrackerService'     → ErrorTrackerService
  //   'ConfigService'           → ConfigService<AllConfigType>

  // ─── Config ───────────────────────────────────────
  config(key: string): any;

  // ─── Email helper ─────────────────────────────────
  sendEmail(data: EmailJobData): Promise<void>;

  // ─── Logger ───────────────────────────────────────
  logger: Logger;

  // ─── Trace ────────────────────────────────────────
  trace: TraceWriter;

  // ─── Abort ────────────────────────────────────────
  abort(message: string, statusCode?: number): never;
}
```

### 7.2 AuthenticatedUser

```typescript
interface AuthenticatedUser {
  id: number;
  role: { id: number; name: string; homeRoute?: string };
  sessionId: string;
  language: string;
  iat: number;
  exp: number;
}
```

Matches the actual `JwtPayloadType` from `@iam/auth/strategies/types/jwt-payload.type.ts`.

### 7.3 Service token registry

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

`ctx.getService('MailerService')` resolves to the actual class token and retrieves it from NestJS DI via `ModuleRef.get(..., { strict: false })`.

### 7.4 Hook signatures

```typescript
// Before hook — can modify data and abort
interface BeforeHook {
  (data: Record<string, unknown>, ctx: HookContext): Promise<BeforeHookResult>;
}

interface BeforeHookResult {
  data: Record<string, unknown>;
  proceed: boolean;
  error?: string;
}

// After hook — side effects only
interface AfterHook {
  (entity: Record<string, unknown>, ctx: HookContext): Promise<void>;
}
```

### 7.5 Hook loading

At materialization time:
1. `require(handlerPath)` — loads the handler module
2. Checks that `module.default` is a function
3. Wraps it in a typed caller that catches errors
4. If handler file doesn't exist or doesn't export a function, logs error and skips the hook

---

## 8. Notification System

### 8.1 Architecture

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
    │   ├── renders Handlebars template with context
    │   ├── calls QueuedMailerService.sendMail(EmailJobData)
    │   └── BullMQ handles retry (3 attempts, exponential backoff)
    │
    ├── channel: webhook
    │   ├── builds payload from spec.payload + entity data
    │   ├── POST to URL via fetch
    │   ├── HMAC signature if auth specified
    │   └── logs failures to ErrorTrackerService
    │
    └── channel: sms (future)
```

### 8.2 Maizzle integration

Foundation already has Maizzle (`@maizzle/framework`). Workflow:

1. Source templates live in `apps/back/emails/` as `.mjml` or `.html`
2. Built templates compiled by `pnpm maizzle:build` to `apps/back/build/` as `.hbs` files
3. Spec references the built `.hbs` file:

```yaml
notifications:
  - name: task-assigned
    trigger: { on: afterCreate }
    channel: email
    template: ./templates/task-assigned.hbs
    to: '${entity.assignee.email}'
    subject: 'Nueva tarea asignada: ${entity.title}'
```

4. At runtime, NotificationDispatcher reads the `.hbs` file, compiles with Handlebars, calls `QueuedMailerService.sendMail()`

This matches exactly how `MailerService.sendMail()` works today — the engine just automates the dispatch.

### 8.3 Template context

```typescript
interface EmailTemplateContext {
  entity: Record<string, unknown>;
  user: AuthenticatedUser | null;
  app: {
    url: string;
    name: string;
    notificationEmail: string;
  };
}
```

### 8.4 Expression evaluation

Fields like `to`, `subject`, and `payload` support `${expression}` interpolation evaluated against the template context. For complex logic, use a hook that calls `ctx.sendEmail()` directly.

---

## 9. File Handling

### 9.1 Spec definition

```yaml
fields:
  - name: attachment
    type: file
    storage: s3                 # 'local' | 's3' | 's3-presigned' (default: from config)
    allowedMimes: ['application/pdf', 'image/png', 'image/jpeg']
    maxSize: 10485760           # 10MB
    isPublic: false
    context: 'task_attachment'
```

### 9.2 Upload flow (presigned S3)

```
1. Client: POST /api/v1/tasks with { attachment: { name, type, size } }
2. Engine validates mime + size
3. Engine calls FilesS3PresignedService.create(FileUploadDto)
   → creates FileEntity in DB
   → returns { file, uploadSignedUrl }
4. Engine saves task with attachment = file.id
5. Response includes uploadUrl
6. Client uploads directly to S3 via PUT
```

### 9.3 Read flow

```
1. Client: GET /api/v1/tasks/1
2. Engine sees attachment field of type 'file'
3. Engine calls FilesS3Service.getPresignedUrl(file.path)
   → returns GET presigned URL (expires 3600s)
4. Response includes resolved URL
```

Uses `FilesService`, `FilesS3PresignedService`, `FilesS3Service` — exact same services Foundation extensions use today.

---

## 10. Auth & RBAC

### 10.1 What the engine consumes from IamModule

| Component | From | Used for |
|---|---|---|
| `AuthGuard('jwt')` | `@nestjs/passport` | JWT authentication |
| `RolesGuard` | `@iam/roles/roles.guard` | Role-based authorization |
| `@Roles(...)` | `@iam/roles/roles.decorator` | Setting required roles |
| `RoleEnum` | `@iam/roles/roles.enum` | Mapping role names to IDs |
| `req.user` (JwtPayloadType) | `@iam/auth/strategies/jwt.strategy` | User identity in hooks |

### 10.2 Permission resolution

```
Spec: permissions.create: [admin]
  → [RoleEnum.admin] → [1] → @Roles(1) on controller method
```

### 10.3 Row-level security

```yaml
permissions:
  rowLevel:
    user:
      filter: 'assigneeId == ${user.id}'
```

Engine translates to TypeORM WHERE clause:
```typescript
if (user.role.id === RoleEnum.customer) {
  query.where = { ...query.where, assigneeId: user.id };
}
```

Filter supports: `==`, `!=`, `in [a, b]`, and `${user.*}` interpolation. For complex filters, use a `beforeQuery` hook (future).

### 10.4 Field-level RBAC

```yaml
permissions:
  fields:
    assigneeId:
      read: [admin]           # customer can't see
    position:
      read: [admin]
      write: [admin]          # customer can't set
```

On response (Stage 7): fields the user can't read are stripped. On validation (Stage 2): fields the user can't write are rejected.

---

## 11. Jobs

### 11.1 Architecture

```
SpecEngineModule.register()
    │
    ├── For each job in spec:
    │   ├── BullModule.registerQueue({ name: job.queue })
    │   ├── queue.add(job.name, { handlerPath, resource }, { repeat: { pattern: cron } })
    │   └── Dynamic processor registered
    │
    └── Dual mode (like EmailQueueModule):
        ├── Redis available → BullMQ queue + processor
        └── No Redis → setInterval fallback (dev)
```

### 11.2 Job handler contract

```typescript
interface JobHandler {
  (ctx: HookContext): Promise<void>;
}
```

Same HookContext as hooks — same access to repositories, services, config, logger. Jobs are hooks that run on a schedule.

---

## 12. Migrations

### 12.1 Approach: spec diffing

```
spec:generate-migration <extension-name>
    │
    ├── Load current spec from extensions/<name>/*.spec.yaml
    ├── Load previous spec snapshot from DB (spec_schema_version table)
    ├── Diff current vs previous:
    │   ├── Field added → ADD COLUMN
    │   ├── Field removed → DROP COLUMN (with --force)
    │   ├── Field type changed → ALTER COLUMN TYPE
    │   ├── Nullable changed → SET/DROP NOT NULL
    │   ├── Default changed → SET/DROP DEFAULT
    │   ├── Index added/removed → CREATE/DROP INDEX
    │   └── Table created (new resource) → CREATE TABLE
    │
    ├── Generate migration .ts file in src/infrastructure/database/migrations/
    └── Update spec_schema_version
```

### 12.2 Spec schema version table

```sql
CREATE TABLE spec_schema_version (
  resource_name VARCHAR(100) PRIMARY KEY,
  spec_hash VARCHAR(64) NOT NULL,
  spec_snapshot JSONB NOT NULL,
  migrated_at TIMESTAMPTZ DEFAULT NOW()
);
```

At startup, if a spec's hash doesn't match the stored hash, logs: "Resource 'task' spec changed. Run `spec:generate-migration tasks`."

### 12.3 Dev vs prod

- Dev: `synchronize: true` (TypeORM auto-creates/alters)
- Prod: `synchronize: false`, migrations required. Engine blocks startup if spec hashes don't match.

---

## 13. Testing

### 13.1 Three levels

**Level 1: Unit tests per factory**

Each factory tested in isolation:
```typescript
describe('EntityFactory', () => {
  it('should create EntitySchema with all field types', () => { ... });
  it('should map ref to integer column', () => { ... });
});

describe('ValidationFactory', () => {
  it('should reject missing required field', () => { ... });
  it('should enforce enum values', () => { ... });
});
```

**Level 2: Pipeline integration tests**

Test harness that boots NestJS with SpecEngineModule + in-memory DB and exercises the full pipeline:
```typescript
describe('Spec pipeline: task.create', () => {
  it('should create task and fire notifications', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Test', priority: 'urgent', status: 'pending' });

    expect(res.status).toBe(201);
    expect(res.body.assigneeId).toBe(1);  // set by beforeHook

    // Check trace
    const trace = getTrace(res);
    expect(trace.stages[2].meta.modified).toContain('assigneeId');
    expect(trace.stages[5].meta.fired).toHaveLength(1);
  });

  it('should reject customer creating task', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ title: 'Test', priority: 'low', status: 'pending' });

    expect(res.status).toBe(403);
    const trace = getTrace(res);
    expect(trace.stages[0].status).toBe('fail');
  });
});
```

**Level 3: Auto-generated tests from spec**

`pnpm spec:generate-tests tasks` reads the spec and generates a test file covering:
- Each required field → missing field → 400 test
- Each validation rule → invalid value → 400 test
- Each permission rule → role can/cannot access → 200/403 test
- Each seed → seed exists in DB test
- Each hook → scaffold with TODO
- Each notification → scaffold with TODO
- Each job → scaffold with TODO

### 13.2 Why this matters for AI

AI writes spec → `spec:generate-tests` → tests validate spec constraints → AI runs tests → pass or fail with specific errors → AI fixes spec. The feedback loop is closed.

---

## 14. Views & Dashboards

### 14.1 Three levels

| Level | What's declarative | What's code | Coverage |
|---|---|---|---|
| 1 — Full declarative | Everything (query + chart) | Nothing | 70% of dashboards |
| 2 — Hybrid | Query + chart type | Transform hook | 20% |
| 3 — Full custom | Nothing | Handler + Vue component | 10% |

Each panel in a dashboard picks its level independently.

### 14.2 Level 1: Full declarative

```yaml
views:
  - name: task-dashboard
    type: dashboard
    roles: [admin]
    panels:
      - name: total-tasks
        chart: stat
        label: Total Tasks
        query: { resource: task, aggregate: count }

      - name: tasks-by-status
        chart: donut
        query: { resource: task, groupBy: status, aggregate: count }

      - name: tasks-over-time
        chart: line
        query:
          resource: task
          groupBy: createdAt
          groupByInterval: day
          aggregate: count
          timeRange: 30d

      - name: urgent-open
        chart: stat
        label: Urgent Open
        query:
          resource: task
          filter: 'priority == urgent && status != done'
          aggregate: count
```

Engine materializes `GET /api/v1/_spec/views/task-dashboard` that executes all queries and returns:

```json
{
  "panels": [
    { "name": "total-tasks", "chart": "stat", "data": { "value": 42 } },
    { "name": "tasks-by-status", "chart": "donut", "data": { "labels": ["pending", "done"], "values": [12, 15] } },
    { "name": "tasks-over-time", "chart": "line", "data": { "labels": ["2026-07-01", ...], "values": [3, 5, ...] } }
  ]
}
```

Frontend `SpecDashboard.vue` reads this and renders each panel with a generic component.

### 14.3 QuerySpec → SQL translation

```sql
-- tasks-by-status
SELECT status, COUNT(*) as value FROM ext_tasks_task WHERE "deletedAt" IS NULL GROUP BY status;

-- tasks-over-time (day, 30d)
SELECT DATE("createdAt") as label, COUNT(*) as value
FROM ext_tasks_task WHERE "createdAt" > NOW() - INTERVAL '30 days' AND "deletedAt" IS NULL
GROUP BY DATE("createdAt") ORDER BY "createdAt" ASC;

-- urgent-open
SELECT COUNT(*) as value FROM ext_tasks_task WHERE priority = 'urgent' AND status != 'done' AND "deletedAt" IS NULL;
```

### 14.4 Level 2: Hybrid (query + transform hook)

```yaml
panels:
  - name: burndown
    chart: custom
    component: ./frontend/components/BurndownChart.vue
    query:
      resource: task
      groupBy: createdAt
      groupByInterval: day
      aggregate: count
      timeRange: 14d
    transform: ./hooks/burndown-transform.ts
```

Engine executes the query → passes raw data to the transform hook → hook returns transformed data → frontend renders with custom component.

```typescript
// hooks/burndown-transform.ts
export default async function burndownTransform(
  rawData: { labels: string[]; values: number[] },
  ctx: ViewTransformContext,
): Promise<BurndownData> {
  const taskRepo = ctx.getRepository('task');
  const totalTasks = rawData.values.reduce((a, b) => a + b, 0);
  // ... calculate ideal vs actual
  return { labels: rawData.labels, ideal, actual, total: totalTasks };
}
```

### 14.5 Level 3: Full custom

```yaml
views:
  - name: team-analytics
    type: custom
    roles: [admin]
    handler: ./handlers/team-analytics.handler.ts
    component: ./frontend/components/TeamAnalytics.vue
```

Handler receives `HookContext` with full access to repositories and services. Returns arbitrary JSON. Frontend renders with custom component.

### 14.6 Coverage table

| Dashboard | Level | Declarative | Code |
|---|---|---|---|
| Count by status | 1 | Everything | Nothing |
| Revenue by month | 1 | Everything | Nothing |
| Tasks over time | 1 | Everything | Nothing |
| Top 10 by value | 1 | Everything | Nothing |
| Burn-down chart | 2 | Query | Transform hook |
| Conversion funnel | 2 | Query | Transform hook |
| Velocity per sprint | 2 | Query | Transform hook |
| Cohort retention | 3 | Nothing | Handler + component |
| Predictive capacity | 3 | Nothing | Handler + component |

---

## 15. Frontend

### 15.1 The separation: deterministic vs custom

| Deterministic (spec → auto-generated) | Custom (Nuxt layer override) |
|---|---|
| DataTable with pagination, sort, filter | Kanban with drag-and-drop |
| Create/edit form | Dashboard with charts |
| Detail view (read-only) | Timeline custom |
| Navbar items + role visibility | Portals with branding |
| Badges with colors | Calendar with events |
| Select, datepicker, textarea inputs | Map with markers |
| Avatar for user ref | Wizard multi-step |
| File upload widget | Custom visualizations |

Rule: **if it can be generated from field type + UI hints, it's deterministic. If it needs UI logic, it's custom.**

### 15.2 Deterministic admin UI

The spec defines UI hints. The frontend has ONE generic Nuxt layer that reads metadata and renders:

```
modules/spec-crud/              ← ONE implementation for all resources
├── composables/
│   └── useSpecResource.ts      ← fetches metadata, provides CRUD composable
├── components/
│   ├── SpecDataTable.vue       ← table: columns from fields, display from ui.display
│   ├── SpecDataForm.vue        ← form: inputs from fields, formInput from ui.formInput
│   ├── SpecDetail.vue          ← read-only detail view
│   ├── SpecFieldRenderer.vue   ← switch by ui.display (badge, date, avatar, truncate, icon)
│   ├── SpecFieldInput.vue      ← switch by ui.formInput (text, select, datepicker, textarea, file-upload)
│   └── SpecDashboard.vue       ← renders dashboard panels from view spec
└── pages/
    └── app/[resource]/
        ├── index.vue           ← list/table view (auto)
        ├── new.vue             ← create form (auto)
        └── [id].vue            ← edit form + detail (auto)
```

`SpecDataTable` reads fields from spec, renders columns according to `ui.display`. `SpecDataForm` reads fields, renders inputs according to `ui.formInput`. Uses `@base/ui-app/` components (Table, Button, Input, Select, Badge) — no custom components.

### 15.3 Navbar injection

Replaces the current `plugins/nav.ts` pattern. The spec declares sidebar items:

```yaml
ui:
  sidebar:
    heading: Tasks
    items:
      - title: Tasks
        icon: CheckSquare
        link: /app/tasks
        roles: [admin, user]
      - title: My Tasks
        icon: User
        link: /app/tasks/mine
        roles: [user]
```

Frontend reads `GET /api/v1/_spec/resources`, extracts sidebar items, filters by user role, injects into nav. Zero TS code. If spec is deleted, item disappears.

### 15.4 Custom UI override

For UI that metadata can't express, a Nuxt layer per extension overrides the generic:

```
extensions/tasks/
├── tasks.spec.yaml
├── frontend/                    ← Nuxt layer override
│   ├── pages/
│   │   └── app/tasks/
│   │       ├── index.vue        ← override: kanban instead of table
│   │       └── dashboard.vue    ← new page, not in generic
│   └── components/
│       ├── KanbanBoard.vue
│       └── TaskCard.vue
```

Override layer extends the generic. Custom pages override generic pages. The rest renders from metadata. **You can mix — not all-or-nothing.**

### 15.5 What does NOT go in the spec

- Vue components
- UI logic (complex conditionals, loops)
- CSS styles
- Composables
- Pinia state

Those go in the Nuxt layer override. The spec only says "this field is a badge with these colors" — the how is the component's job.

### 15.6 Metadata API

`GET /api/v1/_spec/resources` returns all loaded specs with UI hints:

```json
{
  "resources": [
    {
      "name": "task",
      "displayName": "Task",
      "route": "/api/v1/tasks",
      "ui": { "icon": "CheckSquare", "view": "table", "sidebar": { ... } },
      "fields": [
        { "name": "title", "type": "string", "ui": { "display": "text", "formInput": "text", "link": true } },
        { "name": "status", "type": "enum", "enum": ["pending", "done"], "ui": { "display": "badge", "formInput": "select", "colors": { ... } } }
      ],
      "permissions": { "list": ["admin", "customer"], ... }
    }
  ],
  "views": [
    { "name": "task-dashboard", "panels": [...] }
  ]
}
```

---

## 16. Plugin System

### 16.1 What is a plugin

A reusable spec package: spec YAML + handlers + templates. Like Hytale mods.

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

### 16.2 Installation

```bash
pnpm spec:add plugin:stripe
# → copies to extensions/stripe/
# → updates spec-registry.json
# → pnpm migration:generate SpecStripeInit
```

### 16.3 Overrides

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

Engine merges plugin spec with override spec at load time.

---

## 17. AI Agent Integration

### 17.1 The spec as LLM surface area

```
1. AI reads PRD (natural language)
2. AI writes spec YAML
3. Engine validates against JSON Schema
   ├── Valid → materialize → run tests → return results
   └── Invalid → structured errors → AI fixes spec
4. AI runs auto-generated tests
   ├── Pass → done
   └── Fail → AI reads test output → fixes spec or hook → retest
5. AI commits spec + handlers
```

### 17.2 What the AI never touches

- NestJS module wiring
- TypeORM decorators
- Class-validator DTOs
- Controller method signatures
- DI tokens
- Import paths

### 17.3 What the AI writes

- `*.spec.yaml` — declarative resource definition
- `handlers/*.ts` — pure functions with typed contracts
- `templates/*.hbs` — Handlebars email templates

### 17.4 Hermes skill

A `spec-driven-development` skill that:
1. Loads the spec JSON Schema
2. Reads the user's PRD
3. Generates the spec YAML
4. Validates it
5. Runs `spec:generate-tests`
6. Runs the tests
7. Iterates until green
8. Commits

### 17.5 Error → GitHub Issue → AI fix loop

When a spec-driven resource fails in production:
1. `SpecErrorReporter` logs to ErrorTracker DB (with trace + spec + input)
2. `SpecErrorReporter` opens GitHub issue (deduplicated by hash)
3. AI agent (Hermes cron job or manual trigger) reads the issue
4. AI has: error message, trace, spec section, hook source, input data
5. AI fixes the hook or spec
6. AI commits, opens PR, links PR to issue
7. Issue auto-closes on merge

This is the autonomous self-healing loop.

---

## 18. Module Wiring

### 18.1 SpecEngineModule file structure

```
core/spec-engine/
├── spec-engine.module.ts          ← DynamicModule, wires everything
├── spec-loader.ts                 ← Scans + parses YAML
├── spec-validator.ts              ← JSON Schema + cross-ref validation
├── entity-factory.ts              ← ResourceSpec → TypeORM EntitySchema
├── validation-factory.ts          ← ResourceSpec → Zod schema
├── controller-factory.ts          ← ResourceSpec → NestJS controller (CRUD)
├── webhook-controller-factory.ts  ← Creates dynamic webhook controllers
├── hook-executor.ts               ← Loads + executes hooks with typed contracts
├── hook-context.ts                ← HookContext interface + implementation
├── notification-dispatcher.ts     ← Evaluates triggers + dispatches to channels
├── job-scheduler.ts               ← Registers BullMQ repeatable jobs
├── spec-job-runner.ts             ← Fallback setInterval runner (no Redis)
├── spec-trace.ts                  ← SpecTrace builder + TraceWriter
├── spec-error-reporter.ts         ← ErrorTracker + GitHub issue creation
├── service-registry.ts            ← DI token registry for getService()
├── view-controller-factory.ts     ← Creates dynamic view/dashboard endpoints
├── query-builder.ts               ← QuerySpec → TypeORM QueryBuilder
├── meta-controller.ts             ← GET /api/v1/_spec/resources endpoint
├── migration-generator.ts         ← CLI: spec diff → migration file
├── test-generator.ts              ← CLI: spec → test scaffold
├── spec.types.ts                  ← All TypeScript types
└── README.md
```

### 18.2 Dependencies on Foundation modules

```
SpecEngineModule relies on (already in AppModule, not imported directly):
  ├── IamModule          → AuthGuard, RolesGuard, RoleEnum
  ├── MailerModule        → MailerService (via HookContext.getService)
  ├── EmailQueueModule    → QueuedMailerService, EmailService
  ├── StorageModule       → FilesService, FilesS3PresignedService
  ├── ErrorTrackerModule  → ErrorTrackerService
  └── ConfigModule        → ConfigService
```

The SpecEngineModule does NOT import these. It uses `ModuleRef.get(..., { strict: false })` to resolve providers from the global DI container.

### 18.3 ModuleRef for service resolution

```typescript
export class HookContextImpl implements HookContext {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly user: AuthenticatedUser | null,
    private readonly resource: string,
    private readonly operation: string,
    private readonly trace: TraceWriter,
  ) {}

  getService<T>(token: string): T {
    const serviceToken = SERVICE_TOKENS[token];
    if (!serviceToken) throw new Error(`Unknown service: ${token}`);
    return this.moduleRef.get(serviceToken, { strict: false });
  }

  getRepository(name: string): Repository<any> {
    return this.moduleRef.get('Repository_' + name, { strict: false });
  }

  config(key: string): any {
    return this.configService.get(key as any, { infer: true });
  }

  async sendEmail(data: EmailJobData): Promise<void> {
    return this.getService<QueuedMailerService>('QueuedMailerService').sendMail(data);
  }
}
```

---

## 19. Implementation Roadmap

Ordered by dependency and impact. Each step builds on the previous.

### Phase A — Core engine (makes the tasks demo real)

| # | Task | What it delivers |
|---|---|---|
| A1 | SpecTrace | Trace builder + TraceWriter + dev/prod modes |
| A2 | HookContext + HookExecutor | Hooks with typed contracts, ModuleRef bridge to Foundation |
| A3 | NotificationDispatcher | Maizzle templates + QueuedMailerService + expression eval |
| A4 | WebhookControllerFactory | Inbound webhook endpoints with HMAC/JWT auth |
| A5 | EntitySchema relations | ref fields as real FKs (many-to-one via EntitySchema relations) |
| A6 | Rewrite tasks spec | Full tasks.spec.yaml with hooks, notifications, jobs, UI hints, dashboard |
| A7 | SpecErrorReporter | ErrorTracker logging + GitHub issue creation |

### Phase B — Production safety

| # | Task | What it delivers |
|---|---|---|
| B1 | JSON Schema validation | ajv validation of every spec before materialization |

| B3 | Migration generator | spec:generate-migration CLI, spec diffing, ALTER TABLE |
| B4 | Test generator | spec:generate-tests CLI, auto-generated test scaffolds |
| B5 | Pipeline integration tests | Test harness with in-memory DB, trace assertions |

### Phase C — Full-stack

| # | Task | What it delivers |
|---|---|---|
| C1 | MetaController | GET /api/v1/_spec/resources with UI hints |
| C2 | Nuxt spec-crud layer | SpecDataTable, SpecDataForm, SpecFieldRenderer, SpecFieldInput |
| C3 | Navbar auto-injection | Sidebar items from spec metadata, role-filtered |
| C4 | SpecDashboard.vue | Generic dashboard renderer for level-1 panels |
| C5 | Override layer support | Nuxt layer per extension for custom UI |

### Phase D — Ecosystem

| # | Task | What it delivers |
|---|---|---|
| D1 | Plugin format | plugin.spec.yaml, spec-registry.json, spec:add CLI |
| D2 | Plugin overrides | Merge plugin spec with app overrides |
| D3 | Hermes skill | spec-driven-development skill for autonomous spec generation |
| D4 | Error → Issue → Fix loop | AI reads GitHub issues, fixes spec/hooks, opens PRs |

### Phase E — Advanced

| # | Task | What it delivers |
|---|---|---|
| E1 | View controller factory | Dynamic endpoints for dashboards (level 1 + 2) |
| E2 | QuerySpec → SQL | Declarative queries translated to TypeORM QueryBuilder |
| E3 | Transform hooks for views | Level-2 dashboards (query + transform) |
| E4 | beforeQuery hooks | Complex query modification for advanced filtering |
| E5 | SMS channel | NotificationDispatcher SMS support |
| E6 | Plugin npm packages | Installable via npm, not just copy |