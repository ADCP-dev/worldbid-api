/**
 * RouteIntrospector — derives HTTP route views from loaded specs.
 *
 * Spec-engine routes: for each resource, build list/read/create/update/delete
 * + each action + each webhook. guard.auth/roles/rowLevel/rateLimit are derived
 * from PermissionSpec. Traditional routes: optional DiscoveryService (Mode B);
 * when absent, returns only spec-engine routes.
 */

import { specLoaderEvents } from '@core/spec-engine/spec-loader';
import type { LoadedSpec } from '@core/spec-engine/spec-loader';
import type {
  ResourceSpec,
  PermissionSpec,
  ActionSpec,
  WebhookSpec,
} from '@core/spec-engine/spec.types';
import { IntrospectionCache } from '../introspection-cache';
import type { RouteView } from '../types';

export interface RouteFilter {
  extension?: string;
  method?: string;
}

export interface TraditionalRouteContributor {
  listTraditionalRoutes(): RouteView[];
}

export class RouteIntrospector {
  constructor(
    private readonly loadedSpecs: LoadedSpec[],
    private readonly cache: IntrospectionCache,
    private readonly traditional?: TraditionalRouteContributor,
  ) {
    specLoaderEvents.on('reload', () => this.cache.clearAll());
  }

  listRoutes(filter?: RouteFilter): RouteView[] {
    const cacheKey = `route:list:${filter?.extension ?? ''}:${filter?.method ?? ''}`;
    const cached = this.cache.get<RouteView[]>(cacheKey);
    if (cached) return cached;
    const all = this.allRoutes();
    const filtered = all.filter((r) => {
      if (filter?.extension && r.extension !== filter.extension) return false;
      if (filter?.method && r.method !== filter.method.toUpperCase()) return false;
      return true;
    });
    this.cache.set(cacheKey, filtered);
    return filtered;
  }

  getRoute(method: string, path: string): RouteView | null {
    const upper = method.toUpperCase();
    const key = `route:get:${upper}:${path}`;
    const cached = this.cache.get<RouteView | null>(key);
    if (cached !== undefined) return cached;
    const found = this.allRoutes().find(
      (r) => r.method === upper && r.path === path,
    ) ?? null;
    this.cache.set(key, found);
    return found;
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  private allRoutes(): RouteView[] {
    const routes: RouteView[] = [];
    for (const loaded of this.loadedSpecs) {
      for (const res of loaded.spec.resources) {
        routes.push(...this.resourceRoutes(loaded.spec.name, res));
      }
    }
    if (this.traditional) {
      routes.push(...this.traditional.listTraditionalRoutes());
    }
    return routes;
  }

  private resourceRoutes(ext: string, res: ResourceSpec): RouteView[] {
    const base = `/api/v1/${res.table.replace(/^ext_\w+_/, '')}`;
    const perm = res.permissions;
    const roles = perm?.list ?? perm?.read ?? [];
    const rateLimit = { enabled: true, strategy: 'user-or-ip' };
    const publicRate = { enabled: true, strategy: 'ip' };
    const guard = (opRoles: string[]): RouteView['guard'] => ({
      auth: this.authMethods(perm),
      roles: opRoles,
      rowLevel: perm?.rowLevel
        ? Object.fromEntries(
            Object.entries(perm.rowLevel).map(([k, v]) => [k, v.filter]),
          )
        : undefined,
      rateLimit: this.isPublic(perm) ? publicRate : rateLimit,
    });

    const routes: RouteView[] = [
      {
        method: 'GET', path: base, extension: ext, resource: res.name, operation: 'list',
        guard: guard(perm?.list ?? []), permissions: perm?.list,
        validation: { query: ['filter', 'sort', 'page', 'limit', 'include'] },
      },
      {
        method: 'GET', path: `${base}/:id`, extension: ext, resource: res.name, operation: 'read',
        guard: guard(perm?.read ?? []), permissions: perm?.read,
      },
      {
        method: 'POST', path: base, extension: ext, resource: res.name, operation: 'create',
        guard: guard(perm?.create ?? []), permissions: perm?.create,
        validation: { body: this.bodyValidation(res) },
        hooks: this.hookNames(res, ['beforeCreate', 'afterCreate']),
      },
      {
        method: 'PATCH', path: `${base}/:id`, extension: ext, resource: res.name, operation: 'update',
        guard: guard(perm?.update ?? []), permissions: perm?.update,
        hooks: this.hookNames(res, ['beforeUpdate', 'afterUpdate']),
      },
      {
        method: 'DELETE', path: `${base}/:id`, extension: ext, resource: res.name, operation: 'delete',
        guard: guard(perm?.delete ?? []), permissions: perm?.delete,
        hooks: this.hookNames(res, ['beforeDelete', 'afterDelete']),
      },
    ];

    for (const action of res.actions ?? []) {
      routes.push(this.actionRoute(ext, res, action));
    }
    for (const wh of res.webhooks ?? []) {
      routes.push(this.webhookRoute(ext, res, wh));
    }
    return routes;
  }

  private actionRoute(ext: string, res: ResourceSpec, a: ActionSpec): RouteView {
    const base = `/api/v1/${res.table.replace(/^ext_\w+_/, '')}`;
    return {
      method: a.method,
      path: a.path.startsWith(':') ? `${base}/${a.path}` : `${base}/${a.path}`,
      extension: ext,
      resource: res.name,
      operation: `action:${a.name}`,
      guard: { auth: this.authMethods(res.permissions), roles: a.auth ?? [], rateLimit: { enabled: true, strategy: 'user-or-ip' } },
      input: a.input ? Object.fromEntries(a.input.map((i) => [i.name, { type: i.type, ref: i.ref, required: i.required }])) : undefined,
      handler: a.handler,
    };
  }

  private webhookRoute(ext: string, res: ResourceSpec, w: WebhookSpec): RouteView {
    return {
      method: w.method,
      path: `/api/v1/${w.path}`,
      extension: ext,
      resource: res.name,
      operation: `webhook:${w.name}`,
      guard: { auth: w.auth === 'jwt' ? ['jwt'] : ['public'], roles: [], rateLimit: { enabled: true, strategy: 'ip' } },
      handler: w.handler,
    };
  }

  private authMethods(p?: PermissionSpec): string[] {
    if (!p?.auth || p.auth.length === 0) return ['jwt'];
    return p.auth;
  }

  private isPublic(p?: PermissionSpec): boolean {
    return (p?.auth ?? []).includes('public') || (p?.list ?? []).includes('public');
  }

  private bodyValidation(res: ResourceSpec): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    for (const f of res.fields) {
      body[f.name] = {
        type: f.type,
        required: f.required ?? false,
        nullable: f.nullable,
        length: f.length,
        enum: f.enum,
        ref: f.ref,
        default: f.default,
        min: f.validation?.min,
        max: f.validation?.max,
      };
    }
    return body;
  }

  private hookNames(res: ResourceSpec, events: string[]): string[] {
    if (!res.hooks) return [];
    const map: Record<string, string | undefined> = {
      beforeCreate: res.hooks.beforeCreate,
      afterCreate: res.hooks.afterCreate,
      beforeUpdate: res.hooks.beforeUpdate,
      afterUpdate: res.hooks.afterUpdate,
      beforeDelete: res.hooks.beforeDelete,
      afterDelete: res.hooks.afterDelete,
    };
    return events.filter((e) => map[e]);
  }
}