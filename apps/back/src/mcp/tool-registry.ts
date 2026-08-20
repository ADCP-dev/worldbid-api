/**
 * ToolRegistry — 16 MCP tools with JSON schemas and handler dispatch.
 *
 * Each handler is a thin wrapper over the corresponding introspector method.
 * The registry is constructed once with an IntrospectorBundle and cache.
 */

import type { IntrospectionCache } from './introspection-cache';
import type { SpecEngineIntrospector } from './introspectors/spec-engine.introspector';
import type { RouteIntrospector } from './introspectors/route.introspector';
import type { EntityIntrospector } from './introspectors/entity.introspector';
import type { JobIntrospector } from './introspectors/job.introspector';
import type { NotificationIntrospector } from './introspectors/notification.introspector';
import type { MigrationIntrospector } from './introspectors/migration.introspector';
import type { ErrorIntrospector } from './introspectors/error.introspector';
import type { ModuleIntrospector } from './introspectors/module.introspector';
import type { SearchCodeIntrospector } from './introspectors/search-code.introspector';
import type { FrontendIntrospector } from './introspectors/frontend.introspector';

export interface IntrospectorBundle {
  specEngine: SpecEngineIntrospector;
  route: RouteIntrospector;
  entity: EntityIntrospector;
  job: JobIntrospector;
  notification: NotificationIntrospector;
  migration: MigrationIntrospector;
  error: ErrorIntrospector;
  module: ModuleIntrospector;
  searchCode: SearchCodeIntrospector;
  frontend: FrontendIntrospector;
}

export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  handler: (args: Record<string, unknown>, bundle: IntrospectorBundle) => Promise<unknown> | unknown;
}

const objNoProps = (): ToolInputSchema => ({ type: 'object', properties: {}, additionalProperties: false });

function schema(props: Record<string, unknown>, required: string[] = [], additionalProperties = false): ToolInputSchema {
  return { type: 'object', properties: props, required, additionalProperties };
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'foundation.list_extensions',
    description: 'List all loaded extensions (spec-engine + traditional) with metadata.',
    inputSchema: objNoProps(),
    handler: (_a, b) => b.specEngine.listExtensions(),
  },
  {
    name: 'foundation.get_extension',
    description: 'Get a single extension with specFiles, resources, handlers, manifest.',
    inputSchema: schema({ name: { type: 'string' } }, ['name']),
    handler: (a, b) => b.specEngine.getExtension(String(a.name)),
  },
  {
    name: 'foundation.get_resource',
    description: 'Get a resource with fields, permissions, hooks, jobs, notifications, webhooks, actions.',
    inputSchema: schema({ extension: { type: 'string' }, resource: { type: 'string' } }, ['extension', 'resource']),
    handler: (a, b) => b.specEngine.getResource(String(a.extension), String(a.resource)),
  },
  {
    name: 'foundation.list_routes',
    description: 'List all HTTP routes with guards, permissions, validation. Optional filters: extension, method.',
    inputSchema: schema({ extension: { type: 'string' }, method: { type: 'string' } }, [], true),
    handler: (a, b) => b.route.listRoutes(a.extension ? { extension: String(a.extension), method: a.method ? String(a.method) : undefined } : undefined),
  },
  {
    name: 'foundation.get_route',
    description: 'Get a single route by method and path.',
    inputSchema: schema({ method: { type: 'string' }, path: { type: 'string' } }, ['method', 'path']),
    handler: (a, b) => b.route.getRoute(String(a.method), String(a.path)),
  },
  {
    name: 'foundation.list_entities',
    description: 'List all DB entities (spec-engine + traditional) with columns and indexes.',
    inputSchema: objNoProps(),
    handler: (_a, b) => b.entity.listEntities(),
  },
  {
    name: 'foundation.list_jobs',
    description: 'List all jobs (spec-engine + BullMQ) with schedule, handler, queue, retries.',
    inputSchema: objNoProps(),
    handler: (_a, b) => b.job.listJobs(),
  },
  {
    name: 'foundation.list_notifications',
    description: 'List all notifications (spec-engine + traditional) with trigger, channel, template.',
    inputSchema: objNoProps(),
    handler: (_a, b) => b.notification.listNotifications(),
  },
  {
    name: 'foundation.list_migrations',
    description: 'List applied and pending migrations.',
    inputSchema: objNoProps(),
    handler: (_a, b) => b.migration.listMigrations(),
  },
  {
    name: 'foundation.get_errors',
    description: 'Get recent errors from error_logs with ActionableError fields. Filters: category, extension, resolved, limit.',
    inputSchema: schema({ category: { type: 'string' }, extension: { type: 'string' }, resolved: { type: 'boolean' }, limit: { type: 'number' } }, [], true),
    handler: (a, b) => b.error.getErrors(a),
  },
  {
    name: 'foundation.list_modules',
    description: 'List base NestJS modules (not extensions) with routes and entities.',
    inputSchema: objNoProps(),
    handler: (_a, b) => b.module.listModules(),
  },
  {
    name: 'foundation.search_code',
    description: 'Literal keyword search via ripgrep in apps/back/src and apps/front.',
    inputSchema: schema({ query: { type: 'string' }, limit: { type: 'number' } }, ['query'], true),
    handler: (a, b) => b.searchCode.searchCode(String(a.query), a.limit ? Number(a.limit) : 5),
  },
  {
    name: 'foundation.get_spec_yaml',
    description: 'Get raw YAML spec content for an extension+resource.',
    inputSchema: schema({ extension: { type: 'string' }, resource: { type: 'string' } }, ['extension', 'resource']),
    handler: (a, b) => b.specEngine.getSpecYaml(String(a.extension), String(a.resource)),
  },
  {
    name: 'foundation.get_handler_code',
    description: 'Get handler file source code (scrubbed of secrets).',
    inputSchema: schema({ extension: { type: 'string' }, handler: { type: 'string' } }, ['extension', 'handler']),
    handler: (a, b) => b.searchCode.getHandlerCode(String(a.extension), String(a.handler)),
  },
  {
    name: 'foundation.list_frontend_layers',
    description: 'List Nuxt layers with pages, components, composables, stores.',
    inputSchema: objNoProps(),
    handler: (_a, b) => b.frontend.listFrontendLayers(),
  },
  {
    name: 'foundation.get_app_overview',
    description: 'Get a full app overview (extensions, modules, counts). Call this first.',
    inputSchema: objNoProps(),
    handler: (_a, b) => b.specEngine.getAppOverview(),
  },
  {
    description: 'List auto-fix log entries (applied, pr_created, skipped, failed). Optional filters: errorId, limit.',
    inputSchema: schema({ errorId: { type: 'string' }, limit: { type: 'number' } }, [], true),
  },
];

export class ToolRegistry {
  private readonly byName: Map<string, ToolDefinition>;

  constructor(
    private readonly bundle: IntrospectorBundle,
    private readonly cache: IntrospectionCache,
  ) {
    this.byName = new Map(TOOL_DEFINITIONS.map((t) => [t.name, t]));
  }

  list(): ToolDefinition[] {
    return TOOL_DEFINITIONS;
  }

  get(name: string): ToolDefinition | undefined {
    return this.byName.get(name);
  }

  async execute(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.byName.get(name);
    if (!tool) return undefined;
    return tool.handler(args, this.bundle);
  }
}

export function validateToolInput(tool: ToolDefinition, args: Record<string, unknown>): string | null {
  const required = tool.inputSchema.required ?? [];
  for (const r of required) {
    if (args[r] === undefined || args[r] === null) {
      return `Missing required field: ${r}`;
    }
  }
  if (!tool.inputSchema.additionalProperties) {
    const allowed = new Set(Object.keys(tool.inputSchema.properties));
    for (const k of Object.keys(args)) {
      if (!allowed.has(k)) return `Unknown field: ${k}`;
    }
  }
  return null;
}