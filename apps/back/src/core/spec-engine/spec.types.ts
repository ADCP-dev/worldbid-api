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
  | 'secret';

export interface FieldValidationSpec {
  min?: number;
  max?: number;
  pattern?: string;
  email?: boolean;
  url?: boolean;
}

/**
 * Consolidated FieldUISpec — single definition.
 *
 * Pre-change this interface was DUPLICATED (one near the field types, one near
 * ResourceUISpec). The change `spec-engine-v2-frontend-and-loader` consolidated
 * them into this single definition, which is the union of both prior field sets
 * plus new layout/visibility/file hints. All existing usages of either prior
 * definition still compile against this one.
 *
 * Prior L36 set: display, formInput, link, colors, truncateLength, labelField.
 * Prior L274 set: filterable, sortable, filterType.
 * New hints: section, showIf, cols, order, placeholder, helpText, multiple, accept.
 */
export interface FieldUISpec {
  // ─── Display (prior L36 set) ───
  display?: 'text' | 'badge' | 'date' | 'avatar' | 'truncate' | 'icon' | 'link';
  /**
   * Form input renderer hint. The backend treats this as a passthrough string
   * (it does NOT interpret the value — the frontend SpecFieldInput.vue maps it
   * to a base UI component). The full set of values recognized by the frontend
   * is listed here so spec authors get type-completion and so the canonical
   * example can use every renderer.
   *
   * Pre-change values (L36 set): text, textarea, select, datepicker,
   * file-upload, select-async.
   * spec-engine-v2 added: time, toggle-group, stepper, weekday-picker,
   * time-window, switch, radio.
   */
  formInput?:
    | 'text'
    | 'textarea'
    | 'select'
    | 'datepicker'
    | 'file-upload'
    | 'select-async'
    // ─── spec-engine-v2: frontend-renderer hints ───
    | 'time'
    | 'toggle-group'
    | 'stepper'
    | 'weekday-picker'
    | 'time-window'
    | 'switch'
    | 'radio';
  link?: boolean;
  colors?: Record<string, string>;
  truncateLength?: number;
  labelField?: string;
  // ─── Table interactions (prior L274 set) ───
  filterable?: boolean;
  sortable?: boolean;
  filterType?: 'text' | 'select' | 'dateRange' | 'boolean';
  // ─── Layout & visibility hints (new) ───
  /**
   * Logical section this field belongs to. When ResourceUISpec.sections[] is
   * set, SpecDataForm groups fields by this value; fields without a section
   * land in a default trailing group.
   */
  section?: string;
  /**
   * Conditional visibility. Boolean form hides/shows unconditionally; object
   * form references other field values (e.g. `{ hasCoupon: true }`). A hidden
   * field is excluded from the submitted payload.
   */
  showIf?: boolean | Record<string, unknown>;
  /**
   * Grid column span. Default behaviour when omitted is full width (per spec).
   */
  cols?: number;
  /**
   * Relative render position. Fields with equal or absent order preserve
   * declaration order.
   */
  order?: number;
  /** Input placeholder text. */
  placeholder?: string;
  /** Help text rendered alongside the input. */
  helpText?: string;
  // ─── File hints (new) ───
  /**
   * For `file` fields: allow multiple file selection. Coexists with
   * FieldSpec.allowedMimes — the effective mime filter is the intersection.
   */
  multiple?: boolean;
  /** For `file` fields: HTML accept attribute mime filter (e.g. `image/*`). */
  accept?: string;
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
  ui?: FieldUISpec;
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

// ─── Permission Spec ────────────────────────────────────────────────────────

// Built-in roles always available. Custom roles are defined per-extension
// in ExtensionSpec.roles and seeded via ExtensionSpec.roleSeeds.
export type BuiltinRole = 'admin' | 'user';
export type PermissionRole = BuiltinRole | string; // string allows custom roles from spec
export type PermissionAction = 'list' | 'read' | 'create' | 'update' | 'delete';

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

// ─── UI Spec additions ─────────────────────────────────────────────────────

export interface SidebarItemSpec {
  title: string;
  icon: string;
  link: string;
  roles?: PermissionRole[];
}

// NOTE: FieldUISpec used to be duplicated here (pre-change L274-L290).
// It is now defined ONCE near the top of this file (consolidated union).
// See the consolidated definition above for the full field set.

export interface ResourceUISpec {
  icon?: string;
  view?: 'table' | 'kanban' | 'list';
  kanbanColumn?: string;
  kanbanOrder?: string;
  sidebar?: {
    heading: string;
    items: SidebarItemSpec[];
  };
  // ─── spec-engine-v2: form grouping hints ───
  /**
   * Titled fieldsets. SpecDataForm groups fields by `field.ui.section` and
   * renders a titled fieldset per section (with optional icon). Fields without
   * a section land in a default trailing group.
   */
  sections?: SectionSpec[];
  /**
   * Wizard steps. When set, SpecDataForm renders a stepper with prev/next
   * navigation and per-step validation. Takes precedence over `tabs` and
   * `sections` for form rendering.
   */
  steps?: StepSpec[];
  /**
   * Tabs. SpecDataForm renders one tab per definition, validates only the
   * visible tab on local navigation, and validates ALL tabs on final submit.
   * Takes precedence over `sections` (but `steps` wins over `tabs`).
   */
  tabs?: TabSpec[];
}

/**
 * A titled fieldset within a form. Fields are grouped by `field.ui.section`.
 */
export interface SectionSpec {
  id?: string;
  title: string;
  icon?: string;
  /** Grid column count for this section (default: form-wide setting). */
  cols?: number;
  /** Field names that belong to this section. Optional — when omitted, fields
   * are auto-grouped by their `ui.section` value. */
  fields?: string[];
}

/**
 * A wizard step. `fields` lists the field names rendered in this step.
 */
export interface StepSpec {
  id?: string;
  title: string;
  icon?: string;
  fields: string[];
  /** Optional logical section this step belongs to. */
  section?: string;
}

/**
 * A tab within a tabbed form. `fields` lists the field names rendered in this
 * tab.
 */
export interface TabSpec {
  id?: string;
  title: string;
  icon?: string;
  fields: string[];
  /** Optional logical section this tab belongs to. */
  section?: string;
}

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
  ui?: ResourceUISpec;
  // ─── New features ───
  actions?: ActionSpec[];
  audit?: AuditSpec | boolean;
  scheduledActions?: ScheduledActionSpec[];
  outboundWebhooks?: OutboundWebhookSpec[];
  importConfig?: ImportSpec;
  exportConfig?: ExportSpec;
}

// ─── View / Dashboard Spec ──────────────────────────────────────────────────

/**
 * Panel chart type. Pre-change values: stat, donut, bar, line, custom.
 * spec-engine-v2 adds `table` (mini read-only SpecDataTable) and `list`
 * (compact SpecList). ECharts continues to handle bar/line/donut/stat.
 */
export type ChartType =
  | 'stat'
  | 'donut'
  | 'bar'
  | 'line'
  | 'custom'
  | 'table'
  | 'list';

export interface QuerySpec {
  resource: string;
  aggregate: 'count' | 'sum' | 'avg' | 'min' | 'max';
  aggregateField?: string;
  groupBy?: string;
  groupByInterval?: 'hour' | 'day' | 'week' | 'month';
  timeRange?: string;
  filter?: string;
  sort?: { field: string; order: 'asc' | 'desc' };
  limit?: number;
  having?: string;
}

export interface PanelSpec {
  name: string;
  chart: ChartType;
  label?: string;
  query?: QuerySpec;
  transform?: string;
  component?: string;
}

export interface ViewSpec {
  name: string;
  displayName?: string;
  type: 'dashboard' | 'custom';
  roles: PermissionRole[];
  panels?: PanelSpec[];
  handler?: string;
  component?: string;
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
  views?: ViewSpec[];
  overrides?: OverrideSpec[];
}

// ─── Loaded Spec (with filesystem paths) ────────────────────────────────────

export interface LoadedSpec {
  spec: ExtensionSpec;
  dir: string;
  specPath: string;
}

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
