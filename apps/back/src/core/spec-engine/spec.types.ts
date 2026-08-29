/**
 * Spec Engine — Type Definitions
 *
 * The spec format is the single source of truth for a resource.
 * The engine reads it and materializes: entity, controller, validation,
 * auth, hooks, notifications, jobs, webhooks, views — all at runtime.
 */

import type { FindManyOptions } from 'typeorm';

// ─── Field Types ────────────────────────────────────────────────────────────

export type FieldType =
  | 'string'
  | 'text'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'datetime'
  | 'date'
  | 'json'
  | 'enum'
  | 'ref'
  | 'file'
  | 'computed'
  | 'many-to-many'
  // ─── spec-engine-v2: password / secret are aliases of the same input kind.
  // Both are plain string columns at the entity level; hashing is the auth
  // module's downstream concern (entity-factory does NOT hash).
  | 'password'
  | 'secret'
  // ─── PRD 06: pgvector integration. Vector columns store embeddings as
  // pgvector `vector(N)` type. Auto-embed hooks generate them at runtime.
  | 'vector';

export interface FieldValidationSpec {
  min?: number;
  max?: number;
  pattern?: string;
  email?: boolean;
  url?: boolean;
}

export interface FieldSpec {
  name: string;
  type: FieldType;
  required?: boolean;
  nullable?: boolean;
  unique?: boolean;
  default?: unknown;
  length?: number;
  precision?: number;
  scale?: number;
  enum?: string[];
  ref?: string;
  refOnDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
  index?: boolean;
  validation?: FieldValidationSpec;
  // ─── New features ───
  compute?: ComputeSpec;
  stateMachine?: StateMachineSpec;
  includeable?: boolean;
  // File-specific
  storage?: 'local' | 's3' | 's3-presigned'; // B2 uses s3/s3-presigned with custom endpoint
  allowedMimes?: string[];
  maxSize?: number;
  isPublic?: boolean;
  context?: string;
  // Many-to-many-specific
  joinTable?: string;
  throughFields?: { from: string; to: string };
}

// ─── Vector Field Spec (PRD 06 — pgvector) ───────────────────────────────────

export interface AutoEmbedSpec {
  /** Name of the source field to generate the embedding from (e.g. "content"). */
  source: string;
  /** Embedding model identifier (e.g. "text-embedding-3-small"). */
  model: string;
  /** Embedding provider. */
  provider: 'openai' | 'ollama' | 'local';
}

export interface VectorFieldSpec extends FieldSpec {
  type: 'vector';
  /** Vector dimensionality (e.g. 1536 for OpenAI text-embedding-3-small). */
  dimensions: number;
  /** When true, create an HNSW or IVFFlat index. Default false. */
  index?: boolean;
  /** Index type. Default 'hnsw'. */
  indexType?: 'hnsw' | 'ivfflat';
  /** Index build parameters (m/efConstruction for HNSW, lists for IVFFlat). */
  indexParams?: {
    /** HNSW: connections per layer (default 16). */
    m?: number;
    /** HNSW: build-time search width (default 64). */
    efConstruction?: number;
    /** IVFFlat: number of clusters (default 100). */
    lists?: number;
  };
  /** Auto-embed configuration. When set, the hook executor generates
   *  embeddings automatically after create/update of the source field. */
  autoEmbed?: AutoEmbedSpec;
}

// ─── Permission Spec ────────────────────────────────────────────────────────

// Built-in roles always available. Custom roles are defined per-extension
// in ExtensionSpec.roles and seeded via ExtensionSpec.roleSeeds.
// `public` is a special pseudo-role: when a permission list includes it,
// the controller factory applies the PublicGuard instead of requiring JWT.
export type BuiltinRole = 'admin' | 'user' | 'public';
export type PermissionRole = BuiltinRole | string; // string allows custom roles from spec
export type PermissionAction = 'list' | 'read' | 'create' | 'update' | 'delete';

/**
 * Authentication methods a resource accepts. Declared via
 * `permissions.auth`. Defaults to `['jwt']` when absent (the
 * pre-existing ControllerFactory behavior).
 *
 * - `jwt`    → AuthGuard('jwt')
 * - `api-key`→ ApiKeyAuthGuard
 * - `public` → PublicGuard (no authentication required; a fictitious
 *              `{ id: null, roles: ['public'] }` user is injected so the
 *              existing rowLevel evaluator contract is preserved).
 */
export type AuthMethod = 'jwt' | 'api-key' | 'public';

export interface FieldPermissionSpec {
  read?: PermissionRole[];
  write?: PermissionRole[];
}

export interface RowLevelSpec {
  filter: string; // 'assigneeId == ${user.id}'
}

export interface PermissionSpec {
  list?: PermissionRole[];
  read?: PermissionRole[];
  create?: PermissionRole[];
  update?: PermissionRole[];
  delete?: PermissionRole[];
  fields?: Record<string, FieldPermissionSpec>;
  rowLevel?: Record<string, RowLevelSpec>; // keyed by role name
  /**
   * Authentication methods accepted for this resource. Default `['jwt']`
   * when omitted. See `AuthMethod` for the semantics of each value.
   */
  auth?: AuthMethod[];
}

export interface HookSpec {
  beforeCreate?: string;
  afterCreate?: string;
  beforeUpdate?: string;
  afterUpdate?: string;
  beforeDelete?: string;
  afterDelete?: string;
  beforeQuery?: string;
}

// ─── Notification Spec ──────────────────────────────────────────────────────

export type NotificationTriggerOn =
  | 'beforeCreate'
  | 'afterCreate'
  | 'beforeUpdate'
  | 'afterUpdate'
  | 'beforeDelete'
  | 'afterDelete'
  | 'job'
  | 'webhook';

export interface NotificationTriggerSpec {
  on: NotificationTriggerOn;
  jobName?: string;
  webhookName?: string;
  when?: string;
}

export type NotificationChannel = 'email' | 'webhook' | 'sms';

export interface NotificationSpec {
  name: string;
  trigger: NotificationTriggerSpec;
  channel: NotificationChannel;
  template?: string;
  to?: string;
  subject?: string;
  payload?: Record<string, unknown>;
  url?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

// ─── Job Spec ───────────────────────────────────────────────────────────────

export interface JobSpec {
  name: string;
  schedule: 'cron' | 'interval';
  value: string;
  handler: string;
  queue?: string;
  retries?: number;
  backoff?: 'exponential' | 'fixed';
}

// ─── Webhook Spec ───────────────────────────────────────────────────────────

export interface WebhookSpec {
  name: string;
  path: string;
  method: 'POST';
  auth: 'none' | 'hmac' | 'jwt';
  handler: string;
}

// ─── Outbound Webhook (subscriptions) ───────────────────────────────────────

export interface OutboundWebhookSpec {
  name: string;
  events: string[]; // ej: ['task.created', 'task.updated']
  subscriptionModel: 'static' | 'dynamic';
  url?: string; // static: URL fija. dynamic: via POST subscribe
  handler?: string; // optional transform before sending
  /**
   * Per-webhook HMAC secret (outbound payload signing). Resolution order:
   * dynamic subscription row secret → this spec field → WEBHOOK_HMAC_SECRET
   * env fallback → unsigned delivery (with a one-time loud warning).
   */
  hmacSecret?: string;
}

// ─── Custom Action Spec ────────────────────────────────────────────────────

export interface ActionInputSpec {
  name: string;
  type: FieldType;
  required?: boolean;
  ref?: string;
}

export interface ActionSpec {
  name: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string; // ej: ':id/assign' or 'bulk/assign'
  auth?: PermissionRole[]; // default: resource create permissions
  input?: ActionInputSpec[];
  handler: string; // path to handler, relative to spec
  ui?: {
    label?: string;
    icon?: string;
    buttonLocation?: 'row' | 'bulk' | 'header';
    confirm?: string; // confirm dialog message
  };
}

// ─── State Machine Spec ────────────────────────────────────────────────────

export interface StateTransitionSpec {
  from: string;
  to: string;
  roles?: PermissionRole[];
}

export interface StateMachineSpec {
  transitions: StateTransitionSpec[];
  ui?: {
    showTransitionButtons?: boolean;
  };
}

// ─── Audit Spec ────────────────────────────────────────────────────────────

export interface AuditSpec {
  operations?: ('create' | 'update' | 'delete')[];
  fields?: string[]; // only audit these fields (default: all)
  exclude?: string[]; // don't audit these fields
}

// ─── Scheduled Action Spec (entity-level) ─────────────────────────────────

export interface ScheduledActionSpec {
  name: string;
  trigger: string; // field name (ej: 'dueDate')
  offset: string; // ej: '-3d', '+1h', '+7d'
  handler: string; // path to handler
  cancelOnUpdate?: boolean; // reprogram if entity changes
}

// ─── Computed Field Spec ──────────────────────────────────────────────────

export interface ComputeSpec {
  type: 'count' | 'expression' | 'template';
  relation?: string; // for count: related resource name
  foreignKey?: string; // for count: FK field in related resource
  expression?: string; // for expression: 'dueDate != null && dueDate < now()'
  template?: string; // for template: '${firstName} ${lastName}'
}

// ─── Import/Export Spec ────────────────────────────────────────────────────

export interface ImportSpec {
  format: 'csv' | 'json';
  mapping?: Record<string, string>;
  uniqueKey?: string; // if exists, update instead of duplicate
  handler?: string;
}

export interface ExportSpec {
  format: 'csv' | 'json';
  fields?: string[];
  handler?: string;
}

// ─── Realtime Spec (PRD 05) ──────────────────────────────────────────────────

export interface RealtimeSpec {
  events: ('insert' | 'update' | 'delete')[];
  channel?: string;
  payload?: 'id' | 'full' | 'diff';
  rowLevelFiltering?: 'client' | 'server';
}

// ─── UI Spec additions ─────────────────────────────────────────────────────

// ─── Resource Spec ──────────────────────────────────────────────────────────

export interface ResourceSpec {
  name: string;
  table: string;
  displayName?: string;
  description?: string;
  timestamps?: boolean;
  softDelete?: boolean;
  /**
   * When true (default), create/update/delete operations run inside a
   * `dataSource.transaction()` and after hooks execute within the transaction.
   * Notifications are always dispatched outside the transaction.
   */
  transactional?: boolean;
  fields: FieldSpec[];
  permissions?: PermissionSpec;
  hooks?: HookSpec;
  notifications?: NotificationSpec[];
  jobs?: JobSpec[];
  webhooks?: WebhookSpec[];
  seeds?: Record<string, unknown>[];
  // ─── New features ───
  actions?: ActionSpec[];
  audit?: AuditSpec | boolean;
  scheduledActions?: ScheduledActionSpec[];
  outboundWebhooks?: OutboundWebhookSpec[];
  importConfig?: ImportSpec;
  exportConfig?: ExportSpec;
  realtime?: RealtimeSpec;
}

// ─── Extension Spec ─────────────────────────────────────────────────────────

export interface ConfigItemSpec {
  name: string;
  required: boolean;
  default?: unknown;
  description?: string;
}

export interface OverrideFieldSpec {
  add?: FieldSpec[];
  remove?: string[];
}

export interface OverrideSpec {
  resource: string;
  fields?: OverrideFieldSpec;
  permissions?: PermissionSpec;
  hooks?: HookSpec;
}

export interface RoleDefSpec {
  name: string; // unique within extension, kebab-case
  description?: string;
  permissions?: string[]; // hint for admin UI (not enforced by engine)
}

export interface ExtensionSpec {
  name: string;
  version: string;
  displayName?: string;
  description?: string;
  author?: string;
  config?: ConfigItemSpec[];
  roles?: RoleDefSpec[]; // custom roles defined by this extension
  roleSeeds?: Record<string, unknown>[]; // seed role assignments
  resources: ResourceSpec[];
  overrides?: OverrideSpec[];
}

// ─── Loaded Spec (with filesystem paths) ────────────────────────────────────
// Single definition lives in spec-loader.ts. Re-exported here only for
// import convenience within spec.types consumers — do NOT redeclare.

export type { LoadedSpec } from './spec-loader';

// ─── Trace Types ────────────────────────────────────────────────────────────

export type TraceStageName =
  | 'auth'
  | 'validation'
  | 'beforeHook'
  | 'db'
  | 'afterHook'
  | 'notifications'
  | 'response';

export type TraceStageStatus = 'pass' | 'fail' | 'skip';

export interface TraceStage {
  stage: TraceStageName;
  status: TraceStageStatus;
  durationMs: number;
  input?: unknown;
  output?: unknown;
  error?: { message: string; code: string };
  meta?: Record<string, unknown>;
}

export interface SpecTrace {
  requestId: string;
  resource: string;
  operation:
    | 'create'
    | 'read'
    | 'update'
    | 'delete'
    | 'list'
    | 'webhook'
    | 'job';
  user: { id: number; role: string } | null;
  stages: TraceStage[];
  totalDurationMs: number;
  // ─── Extended fields (PRD 01: Actionable Errors) ───────────────────────
  // These feed ActionableError localization + diagnosis. All optional so
  // existing trace construction (which only sets the fields above) keeps
  // compiling without changes; the trace-enrichment pass populates them.
  /** Extension name the trace originated from (e.g. "tasks"). */
  extension?: string;
  /** Path to the spec YAML file (e.g. "extensions/tasks/task.spec.yaml"). */
  specFile?: string;
  /** Pipeline layer that produced the trace. See FailurePoint.layer. */
  layer?:
    | 'spec_loader'
    | 'entity_factory'
    | 'validation_factory'
    | 'controller_factory'
    | 'hook_executor'
    | 'job_runner'
    | 'webhook_controller'
    | 'action_factory'
    | 'permission_guard'
    | 'notification_dispatcher'
    | 'spec_engine_boot';
  /** Human-readable step within the layer (e.g. "executing beforeCreate hook"). */
  step?: string;
  /** Payload that triggered the operation (sensitive keys scrubbed). */
  input?: Record<string, unknown>;
  /** Authenticated user id (null for system/public). */
  userId?: number | null;
  /** Authenticated user role name (null for public). */
  userRole?: string | null;
  /** Path to the .ts handler that failed (e.g. "extensions/tasks/hooks/x.ts"). */
  handlerFile?: string | null;
  /** Handler function name (e.g. "default" or "beforeCreate"). */
  handlerFunction?: string | null;
}

// ─── Hook Context Types ─────────────────────────────────────────────────────

export interface AuthenticatedUser {
  id: number;
  role: { id: number; name: string; homeRoute?: string };
  sessionId: string;
  language: string;
  iat: number;
  exp: number;
}

export interface BeforeHookResult {
  data: Record<string, unknown>;
  proceed: boolean;
  error?: string;
}

export type BeforeHook = (
  data: Record<string, unknown>,
  ctx: HookContext,
) => Promise<BeforeHookResult>;

export type AfterHook = (
  entity: Record<string, unknown>,
  ctx: HookContext,
) => Promise<void>;

export type BeforeQueryHook = (
  options: FindManyOptions,
  ctx: HookContext,
) => Promise<FindManyOptions>;

export type JobHandler = (ctx: HookContext) => Promise<void>;

// HookContext is defined in hook-context.ts via interface merging
// but we declare the minimal interface here for import convenience
export interface HookContext {
  operation: string;
  resource: string;
  user: AuthenticatedUser | null;
  getRepository(
    name: string,
    manager?: import('typeorm').EntityManager,
  ): import('typeorm').Repository<any>;
  getService<T = any>(token: string): T;
  config(key: string): any;
  sendEmail(data: import('./email-job-data').EmailJobDataLike): Promise<void>;
  logError(
    message: string,
    source?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  logger: import('@nestjs/common').Logger;
  trace: TraceWriter;
  abort(message: string, statusCode?: number): never;
  transaction<T>(fn: (txContext: HookContext) => Promise<T>): Promise<T>;
  // ─── PRD 06: pgvector auto-embed support ─────────────────────────────
  /** Generate an embedding vector for the given text. */
  embed(text: string, model: string, provider?: string): Promise<number[]>;
  /** Optional queue for async embed retries (BullMQ). Absent in tests. */
  queue?: {
    add(name: string, data: unknown, opts?: unknown): Promise<void>;
  };
}

export interface TraceWriter {
  add(stage: string, meta: Record<string, unknown>): void;
  isActive(): boolean;
}

// ─── Error Types ────────────────────────────────────────────────────────────

export class HookAbortError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'HookAbortError';
    this.statusCode = statusCode;
  }
}

export interface SpecError {
  message: string;
  source: string;
  stack?: string;
  resource?: string;
  operation?: string;
  stage?: string;
  requestId?: string;
  trace?: SpecTrace;
  specHash?: string;
  hookPath?: string;
  inputData?: unknown;
  hash: string;
  occurrences: number;
}

// ─── Actionable Errors (PRD 01) ─────────────────────────────────────────────

/**
 * Pipeline layer that produced an error. Mirrors `SpecTrace.layer` but
 * kept here as a standalone union so `FailurePoint` is self-contained.
 */
export type FailurePointLayer =
  | 'spec_loader'
  | 'entity_factory'
  | 'validation_factory'
  | 'controller_factory'
  | 'hook_executor'
  | 'job_runner'
  | 'webhook_controller'
  | 'action_factory'
  | 'permission_guard'
  | 'notification_dispatcher'
  | 'spec_engine_boot';

/**
 * Taxonomy of spec-engine errors. Drives routing in the error tracker UI
 * and the `shouldTrackAsError` decision (permission_denied + client
 * validation are not persisted as bugs).
 */
export type ErrorCategory =
  | 'validation'
  | 'hook_failure'
  | 'job_failure'
  | 'webhook_failure'
  | 'action_failure'
  | 'permission_denied'
  | 'not_found'
  | 'rate_limit'
  | 'database'
  | 'notification'
  | 'spec_invalid'
  | 'extension_load'
  | 'unknown';

export type ErrorSeverity = 'critical' | 'error' | 'warning';

export interface FailurePoint {
  layer: FailurePointLayer;
  /** Human-readable step within the layer (e.g. "executing beforeCreate hook"). */
  step: string;
  /** The original error message, unprocessed. */
  rawError: string;
}

export interface SuggestedFix {
  type: 'code_fix' | 'data_fix' | 'spec_fix' | 'config_fix' | 'manual';
  description: string;
  targetFile: string | null;
  targetSpec: string | null;
  targetField: string | null;
  suggestedCode: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface RelatedSpecRef {
  specFile: string;
  resource: string;
  field: string | null;
  section:
    | 'fields'
    | 'permissions'
    | 'hooks'
    | 'jobs'
    | 'notifications'
    | 'webhooks'
    | 'actions'
    | 'seeds';
  lineHint: number | null;
}

/**
 * Structured, agent-actionable error shape (PRD 01). Every spec-engine
 * error is enriched into this shape before persistence and HTTP response.
 */
export interface ActionableError {
  // ─── Identification ───
  id: string;
  hash: string;
  timestamp: string;

  // ─── Taxonomy ───
  category: ErrorCategory;
  severity: ErrorSeverity;

  // ─── Localization ───
  extension: string | null;
  resource: string | null;
  specFile: string | null;
  operation: string;

  // ─── Context ───
  input: Record<string, unknown>;
  userId: number | null;
  requestId: string;

  // ─── Diagnosis ───
  message: string;
  technicalMessage: string;
  stack: string;
  handlerFile: string | null;
  handlerFunction: string | null;
  failurePoint: FailurePoint;

  // ─── Corrective action ───
  suggestedFix: SuggestedFix | null;
  relatedSpec: RelatedSpecRef | null;

  // ─── State ───
  occurrences: number;
  firstOccurredAt: string;
  lastOccurredAt: string;
  resolved: boolean;
}
