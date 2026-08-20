import { describe, it, expect, beforeEach } from 'vitest';
import { RouteIntrospector } from '../introspectors/route.introspector';
import { IntrospectionCache } from '../introspection-cache';
import type { LoadedSpec } from '@core/spec-engine/spec-loader';
import type { ExtensionSpec, ResourceSpec } from '@core/spec-engine/spec.types';

function makeResource(over: Partial<ResourceSpec> = {}): ResourceSpec {
  return {
    name: 'task',
    table: 'ext_tasks_task',
    fields: [
      { name: 'title', type: 'string', required: true, length: 200, validation: { min: 2, max: 200 } },
      { name: 'status', type: 'enum', required: true, enum: ['pending', 'in_progress'], default: 'pending' },
    ],
    permissions: {
      list: ['admin', 'user', 'manager'],
      read: ['admin', 'user', 'manager'],
      create: ['admin', 'manager'],
      update: ['admin', 'user', 'manager'],
      delete: ['admin'],
      rowLevel: { user: { filter: 'assigneeId == ${user.id}' } },
      auth: ['jwt'],
    },
    hooks: { beforeCreate: './h.ts', afterCreate: './h2.ts' },
    actions: [{ name: 'assign', method: 'POST', path: ':id/assign', auth: ['admin', 'manager'], handler: './a.ts', input: [{ name: 'assigneeId', type: 'ref', ref: 'user', required: true }] }],
    webhooks: [{ name: 'stale', path: 'tasks/webhooks/stale', method: 'POST', auth: 'hmac', handler: './w.ts' }],
    ...over,
  };
}

function makeLoaded(over: Partial<ExtensionSpec> = {}): LoadedSpec {
  return {
    spec: { name: 'tasks', version: '2.0.0', resources: [makeResource()], ...over },
    dir: '/repo/extensions/tasks',
    specPath: '/repo/extensions/tasks/tasks.extension.spec.yaml',
  };
}

describe('RouteIntrospector', () => {
  let cache: IntrospectionCache;
  let introspector: RouteIntrospector;

  beforeEach(() => {
    cache = new IntrospectionCache();
    introspector = new RouteIntrospector([makeLoaded()], cache);
  });

  it('lists CRUD + action + webhook routes', () => {
    const routes = introspector.listRoutes();
    expect(routes.length).toBe(7);
    expect(routes.map((r) => r.operation)).toEqual(
      expect.arrayContaining(['list', 'read', 'create', 'update', 'delete', 'action:assign', 'webhook:stale']),
    );
  });

  it('derives guard.auth as jwt array', () => {
    const routes = introspector.listRoutes();
    const create = routes.find((r) => r.operation === 'create');
    expect(create?.guard.auth).toEqual(['jwt']);
  });

  it('includes roles in guard', () => {
    const routes = introspector.listRoutes();
    const create = routes.find((r) => r.operation === 'create');
    expect(create?.guard.roles).toEqual(['admin', 'manager']);
  });

  it('includes rowLevel filter', () => {
    const routes = introspector.listRoutes();
    const list = routes.find((r) => r.operation === 'list');
    expect(list?.guard.rowLevel?.user).toBe('assigneeId == ${user.id}');
  });

  it('public endpoint has auth=["public"] and ip rateLimit', () => {
    const pub = new RouteIntrospector(
      [makeLoaded({ resources: [makeResource({ permissions: { list: ['public'], auth: ['public'] } })] })],
      new IntrospectionCache(),
    );
    const list = pub.listRoutes().find((r) => r.operation === 'list');
    expect(list?.guard.auth).toEqual(['public']);
    expect(list?.guard.rateLimit?.strategy).toBe('ip');
  });

  it('filters by extension', () => {
    const routes = introspector.listRoutes({ extension: 'tasks' });
    expect(routes.every((r) => r.extension === 'tasks')).toBe(true);
    const none = introspector.listRoutes({ extension: 'other' });
    expect(none).toHaveLength(0);
  });

  it('filters by method', () => {
    const routes = introspector.listRoutes({ method: 'get' });
    expect(routes.every((r) => r.method === 'GET')).toBe(true);
  });

  it('getRoute by method+path', () => {
    const route = introspector.getRoute('POST', '/api/v1/task');
    expect(route).not.toBeNull();
    expect(route?.operation).toBe('create');
  });

  it('getRoute returns null for unknown', () => {
    expect(introspector.getRoute('GET', '/nope')).toBeNull();
  });

  it('action route has input', () => {
    const action = introspector.listRoutes().find((r) => r.operation === 'action:assign');
    expect(action?.input?.assigneeId).toEqual({ type: 'ref', ref: 'user', required: true });
  });

  it('create route includes body validation and hooks', () => {
    const create = introspector.listRoutes().find((r) => r.operation === 'create');
    expect(create?.validation?.body?.title).toBeDefined();
    expect(create?.hooks).toEqual(expect.arrayContaining(['beforeCreate', 'afterCreate']));
  });

  it('includes traditional routes when contributor present', () => {
    const trad = { listTraditionalRoutes: () => [{ method: 'POST', path: '/api/v1/auth/login', module: 'iam', operation: 'login', guard: { auth: ['public'], roles: [], rateLimit: { enabled: true, strategy: 'ip' } } }] };
    const ri = new RouteIntrospector([makeLoaded()], new IntrospectionCache(), trad);
    const login = ri.listRoutes().find((r) => r.operation === 'login');
    expect(login).toBeDefined();
    expect(login?.module).toBe('iam');
  });
});