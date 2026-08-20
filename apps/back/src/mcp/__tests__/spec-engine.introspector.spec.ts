import { describe, it, expect, beforeEach } from 'vitest';
import { SpecEngineIntrospector } from '../introspectors/spec-engine.introspector';
import { IntrospectionCache } from '../introspection-cache';
import type { LoadedSpec } from '@core/spec-engine/spec-loader';
import type { ExtensionSpec, ResourceSpec } from '@core/spec-engine/spec.types';

function makeResource(over: Partial<ResourceSpec> = {}): ResourceSpec {
  return {
    name: 'task',
    table: 'ext_tasks_task',
    fields: [
      { name: 'title', type: 'string', required: true, length: 200, validation: { min: 2, max: 200 } },
      { name: 'status', type: 'enum', required: true, default: 'pending', enum: ['pending', 'in_progress', 'review', 'done', 'blocked'], index: true },
      { name: 'assigneeId', type: 'ref', ref: 'user', refOnDelete: 'SET NULL', nullable: true, index: true },
      { name: 'apiKey', type: 'password', nullable: true, length: 255 },
    ],
    permissions: {
      list: ['admin', 'user', 'manager'],
      read: ['admin', 'user', 'manager'],
      create: ['admin', 'manager'],
      update: ['admin', 'user', 'manager'],
      delete: ['admin'],
      fields: { apiKey: { read: ['admin'], write: ['admin'] } },
      rowLevel: { user: { filter: 'assigneeId == ${user.id}' } },
      auth: ['jwt'],
    },
    hooks: { beforeCreate: './hooks/task-before-create.ts', afterCreate: './hooks/task-after-create.ts' },
    jobs: [{ name: 'stale-tasks-detector', schedule: 'interval', value: '60000', handler: './jobs/stale-tasks-detector.ts', queue: 'default', retries: 3, backoff: 'exponential' }],
    notifications: [{ name: 'task-assigned', trigger: { on: 'afterCreate', when: 'input.assigneeId != null' }, channel: 'email', template: 'task-assigned', to: '${assignee.email}', subject: 'Nueva tarea asignada: ${title}' }],
    webhooks: [{ name: 'stale', path: 'tasks/webhooks/stale', method: 'POST', auth: 'hmac', handler: './webhooks/stale.handler.ts' }],
    actions: [{ name: 'stats', method: 'GET', path: 'stats', auth: ['admin', 'user', 'manager'], handler: './actions/stats.handler.ts', ui: { label: 'Estadisticas', icon: 'BarChart', buttonLocation: 'header' } }],
    audit: { operations: ['create', 'update', 'delete'] },
    ...over,
  };
}

function makeLoadedSpec(specOver: Partial<ExtensionSpec> = {}): LoadedSpec {
  return {
    spec: {
      name: 'tasks',
      version: '2.0.0',
      displayName: 'Tasks',
      description: 'Kanban tasks',
      roles: [{ name: 'manager', description: 'Team lead' }],
      roleSeeds: [{ role: 'manager', userId: 2 }],
      resources: [makeResource()],
      ...specOver,
    },
    dir: '/repo/extensions/tasks',
    specPath: '/repo/extensions/tasks/tasks.extension.spec.yaml',
  };
}

describe('SpecEngineIntrospector', () => {
  let cache: IntrospectionCache;
  let introspector: SpecEngineIntrospector;

  beforeEach(() => {
    cache = new IntrospectionCache();
    introspector = new SpecEngineIntrospector([makeLoadedSpec()], cache, '/repo');
  });

  describe('listExtensions', () => {
    it('returns all extensions with metadata', () => {
      const exts = introspector.listExtensions();
      expect(exts).toHaveLength(1);
      expect(exts[0].name).toBe('tasks');
      expect(exts[0].version).toBe('2.0.0');
      expect(exts[0].displayName).toBe('Tasks');
      expect(exts[0].resources).toEqual(['task']);
      expect(exts[0].customRoles).toEqual(['manager']);
      expect(exts[0].seeds).toBe(true);
      expect(exts[0].enabled).toBe(true);
    });

    it('caches result', () => {
      introspector.listExtensions();
      expect(cache.size()).toBe(1);
      introspector.listExtensions();
      expect(cache.size()).toBe(1);
    });
  });

  describe('getExtension', () => {
    it('returns extension detail with handlers', () => {
      const ext = introspector.getExtension('tasks');
      expect(ext).not.toBeNull();
      expect(ext?.name).toBe('tasks');
      expect(ext?.resources[0]).toEqual({ name: 'task', table: 'ext_tasks_task' });
      const jobHandler = ext?.handlers.find((h) => h.type === 'job');
      expect(jobHandler?.name).toBe('stale-tasks-detector');
      const hookHandler = ext?.handlers.find((h) => h.type === 'hook' && h.name === 'beforeCreate');
      expect(hookHandler?.file).toBe('./hooks/task-before-create.ts');
    });

    it('returns null for unknown extension', () => {
      expect(introspector.getExtension('nope')).toBeNull();
    });
  });

  describe('getResource', () => {
    it('returns resource with typed fields', () => {
      const res = introspector.getResource('tasks', 'task');
      expect(res).not.toBeNull();
      expect(res?.table).toBe('ext_tasks_task');
      const title = res?.fields.find((f) => f.name === 'title');
      expect(title?.type).toBe('string');
      expect(title?.required).toBe(true);
      expect(title?.length).toBe(200);
      expect(title?.isFile).toBe(false);
      expect(title?.isRef).toBe(false);
      expect(title?.isEnum).toBe(false);
      const status = res?.fields.find((f) => f.name === 'status');
      expect(status?.isEnum).toBe(true);
      expect(status?.enum).toEqual(['pending', 'in_progress', 'review', 'done', 'blocked']);
      const assignee = res?.fields.find((f) => f.name === 'assigneeId');
      expect(assignee?.isRef).toBe(true);
      expect(assignee?.ref).toBe('user');
      const apiKey = res?.fields.find((f) => f.name === 'apiKey');
      expect(apiKey?.isSensitive).toBe(true);
    });

    it('includes permissions with rowLevel', () => {
      const res = introspector.getResource('tasks', 'task');
      expect(res?.permissions.create).toEqual(['admin', 'manager']);
      expect(res?.permissions.rowLevel?.user.filter).toBe('assigneeId == ${user.id}');
    });

    it('includes hooks, jobs, notifications, webhooks, actions', () => {
      const res = introspector.getResource('tasks', 'task');
      expect(res?.hooks.find((h) => h.event === 'beforeCreate')?.handler).toBe('./hooks/task-before-create.ts');
      expect(res?.jobs[0].name).toBe('stale-tasks-detector');
      expect(res?.notifications[0].name).toBe('task-assigned');
      expect(res?.webhooks[0].name).toBe('stale');
      expect(res?.actions[0].name).toBe('stats');
      expect(res?.audit?.operations).toEqual(['create', 'update', 'delete']);
    });

    it('returns null for unknown resource', () => {
      expect(introspector.getResource('tasks', 'nope')).toBeNull();
    });
  });

  describe('getAppOverview', () => {
    it('aggregates counts from loaded specs', () => {
      const overview = introspector.getAppOverview();
      expect(overview.appName).toBe('foundation');
      expect(overview.extensions).toEqual(['tasks']);
      expect(overview.totalEntities).toBe(1);
      expect(overview.totalJobs).toBe(1);
      expect(overview.totalNotifications).toBe(1);
      expect(overview.totalRoutes).toBe(7); // 5 CRUD + 1 action + 1 webhook
      expect(overview.extensionsByType.specDriven).toEqual(['tasks']);
    });
  });
});