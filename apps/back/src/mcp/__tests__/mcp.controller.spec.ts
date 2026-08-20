import { describe, it, expect, beforeEach } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { McpController } from '../mcp.controller';
import { ToolRegistry, type IntrospectorBundle } from '../tool-registry';
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

function makeBundle(cache: IntrospectionCache): IntrospectorBundle {
  const res: ResourceSpec = {
    name: 'task', table: 'ext_tasks_task',
    fields: [{ name: 'title', type: 'string', required: true }],
    permissions: { list: ['admin'], auth: ['jwt'] },
  };
  const specs: LoadedSpec[] = [{
    spec: { name: 'tasks', version: '2.0.0', resources: [res] } as ExtensionSpec,
    dir: '/repo/extensions/tasks', specPath: '/repo/extensions/tasks/tasks.extension.spec.yaml',
  }];
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

describe('McpController', () => {
  let controller: McpController;

  beforeEach(() => {
    // McpController builds its own registry in onModuleInit via ModuleRef.
    // For unit tests we bypass onModuleInit and set the registry directly.
    const cache = new IntrospectionCache();
    const bundle = makeBundle(cache);
    controller = new McpController({ get: () => undefined } as never);
    // Trigger onModuleInit-like wiring with our bundle by calling the method.
    // We expose a small test hook: override registry via onModuleInit run.
    (controller as unknown as { registry: ToolRegistry }).registry = new ToolRegistry(bundle, cache);
  });

  it('GET tools returns 17 tools', () => {
    const res = controller.listTools();
    expect(res.tools).toHaveLength(17);
    expect(res.tools[0].name).toMatch(/^foundation\./);
  });

  it('POST known tool returns result', async () => {
    const res = await controller.executeTool('foundation.list_modules', {});
    expect(res.result).toBeDefined();
  });

  it('POST unknown tool throws 404', async () => {
    await expect(controller.executeTool('foundation.nope', {})).rejects.toThrow(NotFoundException);
  });

  it('POST invalid input throws 400', async () => {
    await expect(controller.executeTool('foundation.get_resource', {})).rejects.toThrow(BadRequestException);
  });

  it('POST get_resource with valid args returns resource', async () => {
    const res = await controller.executeTool('foundation.get_resource', { extension: 'tasks', resource: 'task' });
    expect((res.result as { name: string }).name).toBe('task');
  });
});