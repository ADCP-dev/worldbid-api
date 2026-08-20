/**
 * MCP Introspection — shared response view types.
 *
 * All views are JSON-serializable shapes returned by the 16 tools.
 * Pure types only — no runtime values here.
 */

export interface ExtensionView {
  name: string;
  version: string;
  displayName: string;
  description: string;
  dependencies: string[];
  resources: string[];
  routes: RouteView[];
  customRoles: string[];
  seeds: boolean;
  enabled: boolean;
}

export interface ExtensionDetailView {
  name: string;
  version: string;
  specFiles: string[];
  resources: ResourceSummaryView[];
  handlers: HandlerRefView[];
  manifest: Record<string, unknown> | null;
}

export interface ResourceSummaryView {
  name: string;
  table: string;
}

export interface HandlerRefView {
  type: 'hook' | 'action' | 'job' | 'webhook';
  name: string;
  file: string;
}

export interface ResourceDetailView {
  name: string;
  table: string;
  displayName?: string;
  description?: string;
  timestamps?: boolean;
  softDelete?: boolean;
  transactional?: boolean;
  fields: FieldView[];
  permissions: PermissionsView;
  hooks: HookView[];
  jobs: JobView[];
  notifications: NotificationView[];
  webhooks: WebhookView[];
  actions: ActionView[];
  audit?: { operations: string[] };
  seeds: unknown[];
}

export interface FieldView {
  name: string;
  type: string;
  required?: boolean;
  nullable?: boolean;
  unique?: boolean;
  default?: unknown;
  length?: number;
  precision?: number;
  scale?: number;
  enum?: string[];
  ref?: string;
  refOnDelete?: string;
  index?: boolean;
  validation?: { min?: number; max?: number; pattern?: string; email?: boolean; url?: boolean };
  isFile: boolean;
  isRef: boolean;
  isEnum: boolean;
  isComputed: boolean;
  isSensitive: boolean;
  storage?: string;
  allowedMimes?: string[];
  maxSize?: number;
}

export interface PermissionsView {
  list?: string[];
  read?: string[];
  create?: string[];
  update?: string[];
  delete?: string[];
  fields?: Record<string, { read?: string[]; write?: string[] }>;
  rowLevel?: Record<string, { filter: string }>;
}

export interface HookView {
  event: string;
  handler: string;
}

export interface JobView {
  name: string;
  source: 'spec_engine' | 'traditional';
  extension?: string;
  module?: string;
  resource?: string;
  schedule: string;
  value?: string;
  handler: string;
  queue?: string;
  retries?: number;
  backoff?: string;
  lastRun?: string;
  lastStatus?: string;
  lastError?: string | null;
}

export interface NotificationView {
  name: string;
  extension?: string;
  module?: string;
  resource?: string;
  trigger: { on: string; when: string };
  channel: string;
  template: string;
  templateFile?: string;
  to: string;
  subject: string;
  triggeredFrom: 'spec_engine' | 'traditional';
}

export interface WebhookView {
  name: string;
  path: string;
  method: string;
  auth: string;
  handler: string;
}

export interface ActionView {
  name: string;
  method: string;
  path: string;
  auth: string[];
  handler: string;
  input?: { name: string; type: string; ref?: string; required?: boolean }[];
  ui?: { label?: string; icon?: string; buttonLocation?: string };
}

export interface RouteView {
  method: string;
  path: string;
  extension?: string;
  module?: string;
  resource?: string;
  operation: string;
  guard: {
    auth: string[];
    roles: string[];
    rowLevel?: Record<string, string>;
    rateLimit?: { enabled: boolean; strategy: string };
  };
  permissions?: string[];
  validation?: {
    query?: string[];
    filterableFields?: string[];
    sortableFields?: string[];
    body?: Record<string, unknown>;
  };
  hooks?: string[];
  input?: Record<string, unknown>;
  handler?: string;
}

export interface EntityView {
  name: string;
  table: string;
  source: 'spec_engine' | 'traditional';
  extension?: string;
  module?: string;
  columns: ColumnView[];
  indexes: IndexView[];
}

export interface ColumnView {
  name: string;
  type: string;
  primary?: boolean;
  generated?: boolean;
  nullable?: boolean;
  length?: number;
  references?: { table: string; column: string; onDelete?: string };
}

export interface IndexView {
  name: string;
  columns: string[];
}

export interface MigrationView {
  id?: number;
  name: string;
  timestamp?: string | number;
  ranAt?: string;
  file?: string;
}

export interface ErrorView {
  id: number | string;
  category?: string;
  extension?: string;
  severity?: string;
  resolved?: boolean;
  message: string;
  stack?: string;
  createdAt?: string;
  suggestedFixes?: unknown[];
}

export interface ModuleView {
  name: string;
  path: string;
  submodules: string[];
  routes: { method: string; path: string; guard: string }[];
  entities: string[];
}

export interface FrontendLayerView {
  name: string;
  path: string;
  pages: string[];
  components: string[];
  composables: string[];
  stores: string[];
}

export interface AppOverviewView {
  appName: string;
  version: string;
  extensions: string[];
  modules: string[];
  totalRoutes: number;
  totalEntities: number;
  totalJobs: number;
  totalNotifications: number;
  totalMigrations: number;
  pendingMigrations: number;
  unresolvedErrors: number;
  specEngineVersion: string;
  extensionsByType: {
    specDriven: string[];
    traditional: string[];
  };
}

export interface SearchResultView {
  file: string;
  line: number;
  snippet: string;
  relevance: number;
}

export interface ToolContext {
  introspectors: unknown;
  cache: unknown;
}