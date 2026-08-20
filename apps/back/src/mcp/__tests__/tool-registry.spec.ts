import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolRegistry, TOOL_DEFINITIONS, validateToolInput, type IntrospectorBundle } from '../tool-registry';
import { IntrospectionCache } from '../introspection-cache';
import { SpecEngineIntrospector } from '../introspectors/spec-engine.introspector';
import { RouteIntrospector } from '../introspectors/route.introspector';
import { EntityIntrospector } from '../introspectors/entity.introspector';
import { JobIntrospector } from '../introspectors/job.introspector';
import { NotificationIntrospector } from '../introspectors/notification.introspector';
import { MigrationIntrospector } from '../introspectors/migration.introspector';
import { ErrorIntrospector } from '../introspectors/error.introspector';
import { ModuleIntrospector } from '../introspectors/module.introspector';
import { SearchCodeIntrospector } from '../introspectors/search-code.introspector';
import { FrontendIntrospector } from '../introspectors/frontend.introspector';
import { AutoFixIntrospector } from '../introspectors/auto-fix.introspector';
import type { LoadedSpec } from '@core/spec-engine/spec-loader';
import type { ExtensionSpec, ResourceSpec } from '@core/spec-engine/spec.types';

function makeLoaded(): LoadedSpec {
  const res: ResourceSpec = {
    name: 'task', table: 'ext_tasks_task',
    fields: [{ name: 'title', type: 'string', required: true }],
    permissions: { list: ['admin'], auth: ['jwt'] },
  };
  return {
    spec: { name: 'tasks', version: '2.0.0', resources: [res] } as ExtensionSpec,
    dir: '/repo/extensions/tasks', specPath: '/repo/extensions/tasks/tasks.extension.spec.yaml',
  };
}

function makeBundle(cache: IntrospectionCache): IntrospectorBundle {
  const specs = [makeLoaded()];
  return {
    specEngine: new SpecEngineIntrospector(specs, cache, '/repo'),
    route: new RouteIntrospector(specs, cache),
    entity: new EntityIntrospector(specs, cache),
    job: new JobIntrospector(specs, cache),
    notification: new NotificationIntrospector(specs, cache),
    migration: new MigrationIntrospector(cache, { queryAppliedMigrations: async () => [] }, '/nope'),
    error: new ErrorIntrospector(cache, { queryErrors: async () => [] }),
    module: new ModuleIntrospector(cache, '/repo'),
    searchCode: new SearchCodeIntrospector(cache, '/repo'),
    frontend: new FrontendIntrospector(cache, '/repo'),
    autoFix: new AutoFixIntrospector(cache, { queryFixes: async () => [] }),
  };
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  beforeEach(() => {
    const cache = new IntrospectionCache();
    registry = new ToolRegistry(makeBundle(cache), cache);
  });

  it('registers exactly 17 tools', () => {
    expect(registry.list()).toHaveLength(17);
  });

  it('every tool name starts with foundation.', () => {
    for (const t of registry.list()) {
      expect(t.name.startsWith('foundation.')).toBe(true);
    }
  });

  it('get returns undefined for unknown tool', () => {
    expect(registry.get('foundation.does_not_exist')).toBeUndefined();
  });

  it('execute returns undefined for unknown tool', async () => {
    expect(await registry.execute('nope', {})).toBeUndefined();
  });

  it('execute list_extensions returns array', async () => {
    const res = await registry.execute('foundation.list_extensions', {});
    expect(Array.isArray(res)).toBe(true);
    expect((res as Array<{ name: string }>)[0].name).toBe('tasks');
  });

  it('execute get_resource with args', async () => {
    const res = await registry.execute('foundation.get_resource', { extension: 'tasks', resource: 'task' });
    expect((res as { name: string }).name).toBe('task');
  });

  it('execute get_app_overview', async () => {
    const res = await registry.execute('foundation.get_app_overview', {});
    expect((res as { appName: string }).appName).toBe('foundation');
  });

  it('execute list_auto_fixes returns array', async () => {
    const res = await registry.execute('foundation.list_auto_fixes', {});
    expect(Array.isArray(res)).toBe(true);
  });

  it('execute list_auto_fixes forwards errorId', async () => {
    const spy = vi.fn(async () => []);
    const customRegistry = new ToolRegistry(
      { ...makeBundle(new IntrospectionCache()), autoFix: new AutoFixIntrospector(new IntrospectionCache(), { queryFixes: spy }) },
      new IntrospectionCache(),
    );
    await customRegistry.execute('foundation.list_auto_fixes', { errorId: 'err-1' });
    expect(spy).toHaveBeenCalledWith({ errorId: 'err-1', limit: 25 });
  });
});

describe('validateToolInput', () => {
  it('returns null for valid input', () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === 'foundation.get_resource')!;
    expect(validateToolInput(tool, { extension: 'tasks', resource: 'task' })).toBeNull();
  });
  it('returns error for missing required field', () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === 'foundation.get_resource')!;
    expect(validateToolInput(tool, { extension: 'tasks' })).toContain('resource');
  });
  it('returns error for unknown field when additionalProperties false', () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === 'foundation.get_resource')!;
    expect(validateToolInput(tool, { extension: 'tasks', resource: 'task', extra: 1 })).toContain('extra');
  });
  it('allows extra fields when additionalProperties true', () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === 'foundation.list_routes')!;
    expect(validateToolInput(tool, { extension: 'tasks', extra: 1 })).toBeNull();
  });
});