import { describe, it, expect, beforeEach } from 'vitest';
import { EntityIntrospector } from '../introspectors/entity.introspector';
import { IntrospectionCache } from '../introspection-cache';
import type { LoadedSpec } from '@core/spec-engine/spec-loader';
import type { ExtensionSpec, ResourceSpec } from '@core/spec-engine/spec.types';

function makeResource(over: Partial<ResourceSpec> = {}): ResourceSpec {
  return {
    name: 'task',
    table: 'ext_tasks_task',
    timestamps: true,
    softDelete: true,
    fields: [
      { name: 'title', type: 'string', required: true, length: 200 },
      { name: 'status', type: 'enum', required: true, enum: ['pending'], index: true },
      { name: 'assigneeId', type: 'ref', ref: 'user', refOnDelete: 'SET NULL', nullable: true, index: true },
    ],
    ...over,
  };
}

function makeLoaded(): LoadedSpec {
  return {
    spec: { name: 'tasks', version: '2.0.0', resources: [makeResource()] } as ExtensionSpec,
    dir: '/repo/extensions/tasks',
    specPath: '/repo/extensions/tasks/tasks.extension.spec.yaml',
  };
}

describe('EntityIntrospector', () => {
  let cache: IntrospectionCache;
  let introspector: EntityIntrospector;

  beforeEach(() => {
    cache = new IntrospectionCache();
    introspector = new EntityIntrospector([makeLoaded()], cache);
  });

  it('returns spec-engine entity with ext_ prefix', () => {
    const entities = introspector.listEntities();
    const task = entities.find((e) => e.name === 'task');
    expect(task?.table).toBe('ext_tasks_task');
    expect(task?.source).toBe('spec_engine');
    expect(task?.extension).toBe('tasks');
  });

  it('id column is primary and generated', () => {
    const id = introspector.listEntities()[0].columns.find((c) => c.name === 'id');
    expect(id?.primary).toBe(true);
    expect(id?.generated).toBe(true);
    expect(id?.type).toBe('uuid');
  });

  it('title column varchar length 200', () => {
    const title = introspector.listEntities()[0].columns.find((c) => c.name === 'title');
    expect(title?.type).toBe('varchar');
    expect(title?.length).toBe(200);
    expect(title?.nullable).toBe(false);
  });

  it('assigneeId references user with onDelete SET NULL', () => {
    const a = introspector.listEntities()[0].columns.find((c) => c.name === 'assigneeId');
    expect(a?.references?.table).toBe('user');
    expect(a?.references?.onDelete).toBe('SET NULL');
    expect(a?.nullable).toBe(true);
  });

  it('timestamps add createdAt and updatedAt', () => {
    const cols = introspector.listEntities()[0].columns;
    expect(cols.find((c) => c.name === 'createdAt')).toBeDefined();
    expect(cols.find((c) => c.name === 'updatedAt')).toBeDefined();
  });

  it('softDelete adds deletedAt nullable', () => {
    const deleted = introspector.listEntities()[0].columns.find((c) => c.name === 'deletedAt');
    expect(deleted?.nullable).toBe(true);
  });

  it('indexes from field.index flag', () => {
    const indexes = introspector.listEntities()[0].indexes;
    expect(indexes.find((i) => i.columns.includes('status'))).toBeDefined();
    expect(indexes.find((i) => i.columns.includes('assigneeId'))).toBeDefined();
  });

  it('includes traditional entities when contributor present', () => {
    const trad = { listTraditionalEntities: () => [{ name: 'user', table: 'user', source: 'traditional' as const, module: 'users', columns: [], indexes: [] }] };
    const ei = new EntityIntrospector([makeLoaded()], new IntrospectionCache(), trad);
    const user = ei.listEntities().find((e) => e.name === 'user');
    expect(user?.source).toBe('traditional');
  });
});