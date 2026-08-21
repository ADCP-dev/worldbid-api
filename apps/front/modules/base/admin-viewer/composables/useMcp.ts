/**
 * useMcp — typed wrapper around MCP HTTP Mode B endpoints.
 *
 * Reuses useApi() (authenticated transport). MCP endpoint is
 * POST /api/v1/_mcp/tools/:name which useApi prefixes with /api/v1.
 *
 * Returns typed methods mapping 1:1 to the 17 MCP tools. Response shape
 * is { result: T } per the MCP controller.
 */
import type {
  AppOverviewView,
  EntityView,
  ErrorView,
  ExtensionDetailView,
  ExtensionView,
  FrontendLayerView,
  MigrationView,
  ModuleView,
  NotificationView,
  ResourceDetailView,
  RouteView,
  SearchResultView,
} from '@base/admin-viewer/utils/mcp-types';

interface ToolResponse<T> {
  result: T;
}

export function useMcp() {
  const api = useApi();

  async function call<T>(toolName: string, args?: Record<string, unknown>): Promise<T> {
    const res = await api.post<ToolResponse<T>>(`/_mcp/tools/${toolName}`, args ?? {});
    return res.result;
  }

  return {
    getAppOverview: () => call<AppOverviewView>('foundation.get_app_overview'),

    listExtensions: () => call<ExtensionView[]>('foundation.list_extensions'),
    getExtension: (name: string) =>
      call<ExtensionDetailView>('foundation.get_extension', { name }),
    getResource: (extension: string, resource: string) =>
      call<ResourceDetailView>('foundation.get_resource', { extension, resource }),
    getSpecYaml: (extension: string, resource: string) =>
      call<string>('foundation.get_spec_yaml', { extension, resource }),

    listRoutes: (params?: { extension?: string; method?: string }) =>
      call<RouteView[]>('foundation.list_routes', params ?? {}),

    getRoute: (method: string, path: string) =>
      call<RouteView>('foundation.get_route', { method, path }),

    listEntities: () => call<EntityView[]>('foundation.list_entities'),
    listJobs: () => call<unknown[]>('foundation.list_jobs'),
    listNotifications: () => call<NotificationView[]>('foundation.list_notifications'),
    listMigrations: () => call<MigrationView[]>('foundation.list_migrations'),
    listModules: () => call<ModuleView[]>('foundation.list_modules'),

    getErrors: (filter?: {
      category?: string;
      extension?: string;
      resolved?: boolean;
      limit?: number;
    }) => call<ErrorView[]>('foundation.get_errors', filter ?? {}),

    searchCode: (query: string, limit?: number) =>
      call<SearchResultView[]>('foundation.search_code', { query, ...(limit !== undefined ? { limit } : {}) }),

    getHandlerCode: (extension: string, handler: string) =>
      call<string>('foundation.get_handler_code', { extension, handler }),

    listFrontendLayers: () => call<FrontendLayerView[]>('foundation.list_frontend_layers'),

  };
}