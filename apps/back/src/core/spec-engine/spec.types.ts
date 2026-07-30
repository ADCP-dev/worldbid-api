/**
 * Spec Engine — Type Definitions
 *
 * The spec format is the single source of truth for a resource.
 * The engine reads it and materializes: entity, controller, validation, auth, jobs, webhooks.
 * No code generation. Runtime interpretation.
 */

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
  | 'ref'; // reference to another resource

export interface FieldSpec {
  name: string;
  type: FieldType;
  required?: boolean;
  nullable?: boolean;
  unique?: boolean;
  default?: unknown;
  length?: number; // for string/varchar
  precision?: number; // for decimal
  scale?: number; // for decimal
  enum?: string[]; // for enum type
  ref?: string; // resource name being referenced (for ref type)
  refOnDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT'; // for ref type
  index?: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string; // regex
    email?: boolean;
    url?: boolean;
  };
}

// ─── Permission Spec ────────────────────────────────────────────────────────

export type PermissionRole = 'admin' | 'customer' | 'affiliate' | 'public';
export type PermissionAction = 'list' | 'read' | 'create' | 'update' | 'delete';

export interface PermissionSpec {
  list?: PermissionRole[];
  read?: PermissionRole[];
  create?: PermissionRole[];
  update?: PermissionRole[];
  delete?: PermissionRole[];
}

// ─── Job Spec ───────────────────────────────────────────────────────────────

export interface JobSpec {
  name: string;
  schedule: 'cron' | 'interval';
  value: string; // cron expression or interval (e.g. "*/5 * * * *", "60s")
  handler: string; // path to handler function relative to spec file
  description?: string;
}

// ─── Webhook Spec ───────────────────────────────────────────────────────────

export interface WebhookSpec {
  path: string; // URL path (e.g. "tasks/webhooks/stale")
  method: 'POST';
  auth: 'none' | 'hmac' | 'jwt';
  handler: string; // path to handler function relative to spec file
  description?: string;
}

// ─── Resource Spec ──────────────────────────────────────────────────────────

export interface ResourceSpec {
  name: string; // resource name (e.g. "task")
  table: string; // DB table name (e.g. "ext_tasks_task")
  displayName?: string;
  description?: string;
  fields: FieldSpec[];
  permissions?: PermissionSpec;
  timestamps?: boolean; // auto createdAt, updatedAt (default: true)
  softDelete?: boolean; // auto deletedAt (default: true)
  seeds?: Record<string, unknown>[]; // seed data
  jobs?: JobSpec[];
  webhooks?: WebhookSpec[];
}

// ─── Extension Spec (collection of resources) ───────────────────────────────

export interface ExtensionSpec {
  name: string;
  version: string;
  displayName?: string;
  description?: string;
  resources: ResourceSpec[];
}