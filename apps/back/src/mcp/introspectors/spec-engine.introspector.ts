/**
 * SpecEngineIntrospector — reads loaded ExtensionSpec[] to answer:
 *   - list_extensions
 *   - get_extension
 *   - get_resource
 *   - get_spec_yaml (delegates fs read to caller via repoRoot)
 *   - get_app_overview (spec-driven portion)
 *
 * Pure class: deps injected via constructor. Cache wrapped on every method.
 * Subscribes to specLoaderEvents 'reload' to clear cache.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { specLoaderEvents } from '@core/spec-engine/spec-loader';
import type { LoadedSpec } from '@core/spec-engine/spec-loader';
import type {
  ExtensionSpec,
  ResourceSpec,
  FieldSpec,
  PermissionSpec,
  HookSpec,
  JobSpec,
  NotificationSpec,
  WebhookSpec,
  ActionSpec,
  AuditSpec,
} from '@core/spec-engine/spec.types';
import { IntrospectionCache } from '../introspection-cache';
import type {
  ExtensionView,
  ExtensionDetailView,
  ResourceDetailView,
  FieldView,
  PermissionsView,
  HookView,
  JobView,
  NotificationView,
  WebhookView,
  ActionView,
  AppOverviewView,
} from '../types';

const SENSITIVE_FIELD_TYPES = new Set(['password', 'secret']);

export class SpecEngineIntrospector {
  constructor(
    private readonly loadedSpecs: LoadedSpec[],
    private readonly cache: IntrospectionCache,
    private readonly repoRoot: string = process.cwd(),
  ) {
    specLoaderEvents.on('reload', () => this.cache.clearAll());
  }

  listExtensions(): ExtensionView[] {
    const cached = this.cache.get<ExtensionView[]>('spec:listExtensions');
    if (cached) return cached;
    const views = this.loadedSpecs.map((l) => this.toExtensionView(l.spec, l.dir));
    this.cache.set('spec:listExtensions', views);
    return views;
  }

  getExtension(name: string): ExtensionDetailView | null {
    const key = `spec:getExtension:${name}`;
    const cached = this.cache.get<ExtensionDetailView | null>(key);
    if (cached !== undefined) return cached;
    const loaded = this.findLoaded(name);
    if (!loaded) {
      this.cache.set(key, null);
      return null;
    }
    const view = this.toExtensionDetailView(loaded);
    this.cache.set(key, view);
    return view;
  }

  getResource(ext: string, res: string): ResourceDetailView | null {
    const key = `spec:getResource:${ext}:${res}`;
    const cached = this.cache.get<ResourceDetailView | null>(key);
    if (cached !== undefined) return cached;
    const resource = this.findResource(ext, res);
    if (!resource) {
      this.cache.set(key, null);
      return null;
    }
    const view = this.toResourceDetailView(resource);
    this.cache.set(key, view);
    return view;
  }

  getSpecYaml(ext: string, res: string): string | null {
    const key = `spec:getSpecYaml:${ext}:${res}`;
    const cached = this.cache.get<string | null>(key);
    if (cached !== undefined) return cached;
    const loaded = this.findLoaded(ext);
    if (!loaded) {
      this.cache.set(key, null);
      return null;
    }
    // Find the spec file that declares this resource.
    const specFile = this.findSpecFileForResource(loaded, res);
    if (!specFile) {
      this.cache.set(key, null);
      return null;
    }
    try {
      const raw = readFileSync(specFile, 'utf8');
      this.cache.set(key, raw);
      return raw;
    } catch {
      this.cache.set(key, null);
      return null;
    }
  }

  getAppOverview(): AppOverviewView {
    const cached = this.cache.get<AppOverviewView>('spec:getAppOverview');
    if (cached) return cached;
    const specDriven = this.loadedSpecs.map((l) => l.spec.name);
    const resources = this.loadedSpecs.flatMap((l) => l.spec.resources);
    const totalRoutes = this.countSpecRoutes(resources);
    const totalJobs = resources.reduce((n, r) => n + (r.jobs?.length ?? 0), 0);
    const totalNotifications = resources.reduce(
      (n, r) => n + (r.notifications?.length ?? 0),
      0,
    );
    const overview: AppOverviewView = {
      appName: 'foundation',
      version: this.loadedSpecs[0]?.spec.version ?? '1.0.0',
      extensions: specDriven,
      modules: [],
      totalRoutes,
      totalEntities: resources.length,
      totalJobs,
      totalNotifications,
      totalMigrations: 0,
      pendingMigrations: 0,
      unresolvedErrors: 0,
      specEngineVersion: '2.0.0',
      extensionsByType: {
        specDriven,
        traditional: [],
      },
    };
    this.cache.set('spec:getAppOverview', overview);
    return overview;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private findLoaded(name: string): LoadedSpec | undefined {
    return this.loadedSpecs.find((l) => l.spec.name === name);
  }

  private findResource(ext: string, res: string): ResourceSpec | undefined {
    const loaded = this.findLoaded(ext);
    return loaded?.spec.resources.find((r) => r.name === res);
  }

  private findSpecFileForResource(loaded: LoadedSpec, res: string): string | null {
    const dir = loaded.dir;
    // Split-spec convention: <resource>.spec.yaml
    const candidate = path.join(dir, `${res}.spec.yaml`);
    try {
      readFileSync(candidate, 'utf8');
      return candidate;
    } catch {
      // Fallback: extension-level spec (monolith)
      return loaded.specPath;
    }
  }

  private toExtensionView(spec: ExtensionSpec, _dir: string): ExtensionView {
    return {
      name: spec.name,
      version: spec.version,
      displayName: spec.displayName ?? spec.name,
      description: spec.description ?? '',
      dependencies: [],
      resources: spec.resources.map((r) => r.name),
      routes: [],
      customRoles: (spec.roles ?? []).map((r) => r.name),
      seeds: (spec.roleSeeds?.length ?? 0) > 0,
      enabled: true,
    };
  }

  private toExtensionDetailView(loaded: LoadedSpec): ExtensionDetailView {
    const spec = loaded.spec;
    return {
      name: spec.name,
      version: spec.version,
      specFiles: [loaded.specPath],
      resources: spec.resources.map((r) => ({ name: r.name, table: r.table })),
      handlers: this.collectHandlers(spec),
      manifest: null,
    };
  }

  private collectHandlers(spec: ExtensionSpec): ExtensionDetailView['handlers'] {
    const handlers: ExtensionDetailView['handlers'] = [];
    for (const res of spec.resources) {
      if (res.hooks) this.pushHooks(handlers, res.hooks);
      for (const job of res.jobs ?? []) {
        handlers.push({ type: 'job', name: job.name, file: job.handler });
      }
      for (const wh of res.webhooks ?? []) {
        handlers.push({ type: 'webhook', name: wh.name, file: wh.handler });
      }
      for (const action of res.actions ?? []) {
        handlers.push({ type: 'action', name: action.name, file: action.handler });
      }
    }
    return handlers;
  }

  private pushHooks(
    handlers: ExtensionDetailView['handlers'],
    hooks: HookSpec,
  ): void {
    const entries: [string, string | undefined][] = [
      ['beforeCreate', hooks.beforeCreate],
      ['afterCreate', hooks.afterCreate],
      ['beforeUpdate', hooks.beforeUpdate],
      ['afterUpdate', hooks.afterUpdate],
      ['beforeDelete', hooks.beforeDelete],
      ['afterDelete', hooks.afterDelete],
      ['beforeQuery', hooks.beforeQuery],
    ];
    for (const [name, file] of entries) {
      if (file) handlers.push({ type: 'hook', name, file });
    }
  }

  private toResourceDetailView(res: ResourceSpec): ResourceDetailView {
    return {
      name: res.name,
      table: res.table,
      displayName: res.displayName,
      description: res.description,
      timestamps: res.timestamps,
      softDelete: res.softDelete,
      transactional: res.transactional,
      fields: res.fields.map((f) => this.toFieldView(f)),
      permissions: this.toPermissionsView(res.permissions),
      hooks: this.toHookViews(res.hooks),
      jobs: (res.jobs ?? []).map((j) => this.toJobView(j, res.name)),
      notifications: (res.notifications ?? []).map((n) =>
        this.toNotificationView(n, res.name),
      ),
      webhooks: (res.webhooks ?? []).map((w) => this.toWebhookView(w)),
      actions: (res.actions ?? []).map((a) => this.toActionView(a)),
      audit: this.toAuditView(res.audit),
      seeds: res.seeds ?? [],
    };
  }

  private toFieldView(f: FieldSpec): FieldView {
    return {
      name: f.name,
      type: f.type,
      required: f.required,
      nullable: f.nullable,
      unique: f.unique,
      default: f.default,
      length: f.length,
      precision: f.precision,
      scale: f.scale,
      enum: f.enum,
      ref: f.ref,
      refOnDelete: f.refOnDelete,
      index: f.index,
      validation: f.validation,
      isFile: f.type === 'file',
      isRef: f.type === 'ref',
      isEnum: f.type === 'enum',
      isComputed: f.type === 'computed' || f.type === 'many-to-many',
      isSensitive: SENSITIVE_FIELD_TYPES.has(f.type),
      storage: f.storage,
      allowedMimes: f.allowedMimes,
      maxSize: f.maxSize,
    };
  }

  private toPermissionsView(p?: PermissionSpec): PermissionsView {
    if (!p) return {};
    return {
      list: p.list,
      read: p.read,
      create: p.create,
      update: p.update,
      delete: p.delete,
      fields: p.fields,
      rowLevel: p.rowLevel
        ? Object.fromEntries(
            Object.entries(p.rowLevel).map(([k, v]) => [k, { filter: v.filter }]),
          )
        : undefined,
    };
  }

  private toHookViews(h?: HookSpec): HookView[] {
    if (!h) return [];
    const out: HookView[] = [];
    const entries: [string, string | undefined][] = [
      ['beforeCreate', h.beforeCreate],
      ['afterCreate', h.afterCreate],
      ['beforeUpdate', h.beforeUpdate],
      ['afterUpdate', h.afterUpdate],
      ['beforeDelete', h.beforeDelete],
      ['afterDelete', h.afterDelete],
      ['beforeQuery', h.beforeQuery],
    ];
    for (const [event, handler] of entries) {
      if (handler) out.push({ event, handler });
    }
    return out;
  }

  private toJobView(j: JobSpec, resource: string): JobView {
    return {
      name: j.name,
      source: 'spec_engine',
      resource,
      schedule: j.schedule,
      value: j.value,
      handler: j.handler,
      queue: j.queue,
      retries: j.retries,
      backoff: j.backoff,
      lastError: null,
    };
  }

  private toNotificationView(n: NotificationSpec, resource: string): NotificationView {
    return {
      name: n.name,
      resource,
      trigger: { on: n.trigger.on, when: n.trigger.when ?? 'always' },
      channel: n.channel,
      template: n.template ?? '',
      to: n.to ?? '',
      subject: n.subject ?? '',
      triggeredFrom: 'spec_engine',
    };
  }

  private toWebhookView(w: WebhookSpec): WebhookView {
    return {
      name: w.name,
      path: w.path,
      method: w.method,
      auth: w.auth,
      handler: w.handler,
    };
  }

  private toActionView(a: ActionSpec): ActionView {
    return {
      name: a.name,
      method: a.method,
      path: a.path,
      auth: a.auth ?? [],
      handler: a.handler,
      input: a.input,
      ui: a.ui,
    };
  }

  private toAuditView(audit: ResourceSpec['audit']): { operations: string[] } | undefined {
    if (!audit) return undefined;
    if (audit === true) return { operations: ['create', 'update', 'delete'] };
    const a = audit as AuditSpec;
    if (!a.operations) return { operations: ['create', 'update', 'delete'] };
    return { operations: a.operations };
  }

  private countSpecRoutes(resources: ResourceSpec[]): number {
    // CRUD: list, read, create, update, delete = 5 per resource + actions + webhooks
    let count = 0;
    for (const r of resources) {
      count += 5; // list/read/create/update/delete
      count += r.actions?.length ?? 0;
      count += r.webhooks?.length ?? 0;
    }
    return count;
  }
}