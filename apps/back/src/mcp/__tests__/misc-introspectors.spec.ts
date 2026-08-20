import { describe, it, expect, beforeEach } from 'vitest';
import { JobIntrospector } from '../introspectors/job.introspector';
import { NotificationIntrospector } from '../introspectors/notification.introspector';
import { MigrationIntrospector } from '../introspectors/migration.introspector';
import { ErrorIntrospector } from '../introspectors/error.introspector';
import { ModuleIntrospector } from '../introspectors/module.introspector';
import { FrontendIntrospector } from '../introspectors/frontend.introspector';
import { IntrospectionCache } from '../introspection-cache';
import type { LoadedSpec } from '@core/spec-engine/spec-loader';
import type { ExtensionSpec, ResourceSpec } from '@core/spec-engine/spec.types';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

function makeResource(): ResourceSpec {
  return {
    name: 'task',
    table: 'ext_tasks_task',
    fields: [{ name: 'title', type: 'string', required: true }],
    jobs: [{ name: 'stale-tasks-detector', schedule: 'interval', value: '60000', handler: './jobs/d.ts', queue: 'default', retries: 3, backoff: 'exponential' }],
    notifications: [{ name: 'task-assigned', trigger: { on: 'afterCreate', when: 'input.assigneeId != null' }, channel: 'email', template: 'task-assigned', to: '${assignee.email}', subject: 'Nueva' }],
  };
}

function makeLoaded(): LoadedSpec {
  return {
    spec: { name: 'tasks', version: '2.0.0', resources: [makeResource()] } as ExtensionSpec,
    dir: '/repo/extensions/tasks',
    specPath: '/repo/extensions/tasks/tasks.extension.spec.yaml',
  };
}

describe('JobIntrospector', () => {
  let cache: IntrospectionCache;
  let intro: JobIntrospector;
  beforeEach(() => {
    cache = new IntrospectionCache();
    intro = new JobIntrospector([makeLoaded()], cache);
  });
  it('lists spec-engine job', () => {
    const jobs = intro.listJobs();
    const job = jobs.find((j) => j.name === 'stale-tasks-detector');
    expect(job?.source).toBe('spec_engine');
    expect(job?.extension).toBe('tasks');
    expect(job?.resource).toBe('task');
    expect(job?.schedule).toBe('interval');
  });
  it('includes traditional when contributor present', () => {
    const ji = new JobIntrospector([makeLoaded()], new IntrospectionCache(), {
      listTraditionalJobs: () => [{ name: 'email-queue-processor', source: 'traditional', module: 'communications', schedule: 'event-driven', handler: 'm.ts' }],
    });
    const trad = ji.listJobs().find((j) => j.name === 'email-queue-processor');
    expect(trad?.source).toBe('traditional');
  });
});

describe('NotificationIntrospector', () => {
  it('lists spec-engine notification', () => {
    const intro = new NotificationIntrospector([makeLoaded()], new IntrospectionCache());
    const n = intro.listNotifications().find((x) => x.name === 'task-assigned');
    expect(n?.triggeredFrom).toBe('spec_engine');
    expect(n?.extension).toBe('tasks');
    expect(n?.trigger.on).toBe('afterCreate');
  });
});

describe('MigrationIntrospector', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'mig-'));
  });
  it('splits applied and pending', async () => {
    writeFileSync(path.join(tmpDir, '1700000000000-InitialSchema.ts'), '');
    writeFileSync(path.join(tmpDir, '1700100000000-AddTasks.ts'), '');
    writeFileSync(path.join(tmpDir, '1700200000000-AddActionableError.ts'), '');
    const intro = new MigrationIntrospector(
      new IntrospectionCache(),
      { queryAppliedMigrations: async () => [
        { id: 1, name: 'InitialSchema', timestamp: '1700000000000', ranAt: '2026-08-01' },
        { id: 2, name: 'AddTasks', timestamp: '1700100000000', ranAt: '2026-08-05' },
      ] },
      tmpDir,
    );
    const result = await intro.listMigrations();
    expect(result.applied).toHaveLength(2);
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0].name).toBe('AddActionableError');
  });
  it('handles missing migrations dir', async () => {
    const intro = new MigrationIntrospector(new IntrospectionCache(), { queryAppliedMigrations: async () => [] }, '/nope/dir');
    const result = await intro.listMigrations();
    expect(result.pending).toHaveLength(0);
  });
});

describe('ErrorIntrospector', () => {
  it('filters by category', async () => {
    const rows = [
      { id: 1, category: 'hook_failure', extension: 'tasks', resolved: false, message: 'boom' },
      { id: 2, category: 'validation', extension: 'tasks', resolved: false, message: 'bad' },
    ];
    const intro = new ErrorIntrospector(new IntrospectionCache(), {
      queryErrors: async (f) => rows.filter((r) => r.category === f.category),
    });
    const out = await intro.getErrors({ category: 'hook_failure' });
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe('hook_failure');
  });
  it('default limit is 10', async () => {
    let receivedLimit: number | undefined;
    const intro = new ErrorIntrospector(new IntrospectionCache(), {
      queryErrors: async (f) => { receivedLimit = f.limit; return []; },
    });
    await intro.getErrors({});
    expect(receivedLimit).toBe(10);
  });
});

describe('ModuleIntrospector', () => {
  it('lists iam module with User entity', () => {
    const intro = new ModuleIntrospector(new IntrospectionCache(), '/repo');
    const iam = intro.listModules().find((m) => m.name === 'iam');
    expect(iam?.path).toBe('modules/iam/');
    expect(iam?.entities).toContain('User');
  });
  it('submodules scanned from fs', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'mod-'));
    const iamDir = path.join(tmp, 'apps/back/src/modules/iam');
    mkdirSync(iamDir, { recursive: true });
    mkdirSync(path.join(iamDir, 'auth'), { recursive: true });
    mkdirSync(path.join(iamDir, 'session'), { recursive: true });
    const intro = new ModuleIntrospector(new IntrospectionCache(), tmp);
    const iam = intro.listModules().find((m) => m.name === 'iam');
    expect(iam?.submodules).toEqual(expect.arrayContaining(['auth', 'session']));
  });
});

describe('FrontendIntrospector', () => {
  it('scans layers with page basenames', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'fe-'));
    const basePages = path.join(tmp, 'apps/front/modules/base/pages');
    mkdirSync(basePages, { recursive: true });
    writeFileSync(path.join(basePages, 'index.vue'), '<template/>');
    writeFileSync(path.join(basePages, 'about.vue'), '<template/>');
    const intro = new FrontendIntrospector(new IntrospectionCache(), tmp);
    const base = intro.listFrontendLayers().find((l) => l.name === 'base');
    expect(base?.pages).toEqual(expect.arrayContaining(['index.vue', 'about.vue']));
  });
  it('returns empty when no modules dir', () => {
    const intro = new FrontendIntrospector(new IntrospectionCache(), '/nope/repo');
    expect(intro.listFrontendLayers()).toEqual([]);
  });
});