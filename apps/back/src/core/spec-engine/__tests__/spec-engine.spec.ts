/**
 * Spec Engine — Unit tests
 *
 * Tests core spec-engine mechanics without a real database:
 *   - HookContext transactions
 *   - many-to-many join table generation
 *   - many-to-many validation
 *   - spec validator field-type fixes
 */

import type {
  DataSource,
  EntityManager,
  QueryRunner,
  Repository,
} from 'typeorm';
import type { ModuleRef } from '@nestjs/core';
import type { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

import { HookContextImpl } from '@src/core/spec-engine/hook-context';
import { EntityFactory } from '@src/core/spec-engine/entity-factory';
import { ValidationFactory } from '@src/core/spec-engine/validation-factory';
import { SpecValidator } from '@src/core/spec-engine/spec-validator';
import type {
  AuthenticatedUser,
  ResourceSpec,
  TraceWriter,
} from '@src/core/spec-engine/spec.types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

function createMockRepository(): Repository<any> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    create: jest.fn((data: unknown) => data),
  } as unknown as Repository<any>;
}

function createMockManager(repo: Repository<any>): EntityManager {
  return {
    getRepository: jest.fn().mockReturnValue(repo),
  } as unknown as EntityManager;
}

function createMockQueryRunner(manager: EntityManager): QueryRunner {
  return {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager,
  } as unknown as QueryRunner;
}

function createMockDataSource(queryRunner: QueryRunner): DataSource {
  return {
    createQueryRunner: jest.fn().mockReturnValue(queryRunner),
  } as unknown as DataSource;
}

function createMockModuleRef(): ModuleRef {
  return {
    get: jest.fn(),
  } as unknown as ModuleRef;
}

function createMockConfigService(): ConfigService<any> {
  return {
    get: jest.fn(),
  } as unknown as ConfigService<any>;
}

function createMockTrace(): TraceWriter {
  return {
    add: jest.fn(),
    isActive: jest.fn().mockReturnValue(false),
  };
}

function createAuthenticatedUser(): AuthenticatedUser {
  return {
    id: 1,
    role: { id: 1, name: 'admin' },
    sessionId: 'session-1',
    language: 'en',
    iat: Date.now(),
    exp: Date.now() + 3600_000,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('HookContext transactions', () => {
  let moduleRef: ModuleRef;
  let configService: ConfigService<any>;
  let trace: TraceWriter;
  let user: AuthenticatedUser;
  let repo: Repository<any>;
  let manager: EntityManager;
  let queryRunner: QueryRunner;
  let dataSource: DataSource;

  beforeEach(() => {
    moduleRef = createMockModuleRef();
    configService = createMockConfigService();
    trace = createMockTrace();
    user = createAuthenticatedUser();
    repo = createMockRepository();
    manager = createMockManager(repo);
    queryRunner = createMockQueryRunner(manager);
    dataSource = createMockDataSource(queryRunner);
  });

  it('should commit when all operations succeed', async () => {
    const ctx = new HookContextImpl(
      moduleRef,
      configService,
      user,
      'task',
      'create',
      trace,
      dataSource,
    );

    const result = await ctx.transaction(async (txContext) => {
      const txRepo = txContext.getRepository('task');
      return { ok: true, repo: txRepo };
    });

    expect(result.ok).toBe(true);
    expect(result.repo).toBe(repo);
    expect(queryRunner.connect).toHaveBeenCalled();
    expect(queryRunner.startTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('should rollback when transaction function throws', async () => {
    const ctx = new HookContextImpl(
      moduleRef,
      configService,
      user,
      'task',
      'create',
      trace,
      dataSource,
    );

    await expect(
      ctx.transaction(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it('should release query runner even on error', async () => {
    const ctx = new HookContextImpl(
      moduleRef,
      configService,
      user,
      'task',
      'create',
      trace,
      dataSource,
    );

    await expect(
      ctx.transaction(async () => {
        throw new Error('release me');
      }),
    ).rejects.toThrow('release me');

    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('should share manager with getRepository inside transaction', async () => {
    const ctx = new HookContextImpl(
      moduleRef,
      configService,
      user,
      'task',
      'create',
      trace,
      dataSource,
    );

    const collected: Repository<any>[] = [];

    await ctx.transaction(async (txContext) => {
      collected.push(txContext.getRepository('task'));
      collected.push(txContext.getRepository('task'));
      return 'done';
    });

    expect(collected.length).toBe(2);
    expect(collected[0]).toBe(repo);
    expect(collected[1]).toBe(repo);
    expect(manager.getRepository).toHaveBeenCalledWith('task');
  });
});

describe('Many-to-many field', () => {
  const baseSpec = (fields: ResourceSpec['fields']): ResourceSpec => ({
    name: 'Project',
    table: 'ext_demo_projects',
    fields,
    timestamps: false,
    softDelete: false,
  });

  it('should create join table entity schema with composite PK', () => {
    const spec = baseSpec([
      { name: 'title', type: 'string' },
      { name: 'tags', type: 'many-to-many', ref: 'tag' },
    ]);

    const result = EntityFactory.create(spec, new Map(), 'demo');

    expect(result.joinTableSchemas.length).toBe(1);
    const joinSchema = result.joinTableSchemas[0];
    const options = joinSchema.options as any;

    expect(options.tableName).toBe('ext_demo_Project_tags');
    expect(options.columns.ProjectId.primary).toBe(true);
    expect(options.columns.tagId.primary).toBe(true);
  });

  it('should accept array of IDs in validation', () => {
    const spec = baseSpec([{ name: 'tags', type: 'many-to-many', ref: 'tag' }]);

    const schema = ValidationFactory.createCreateSchema(spec);
    const parsed = schema.safeParse({ tags: [1, 2, 3] });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tags).toEqual([1, 2, 3]);
    }
  });

  it('should reject non-array value in validation', () => {
    const spec = baseSpec([{ name: 'tags', type: 'many-to-many', ref: 'tag' }]);

    const schema = ValidationFactory.createCreateSchema(spec);
    const parsed = schema.safeParse({ tags: 'not-an-array' });

    expect(parsed.success).toBe(false);
  });

  it('should generate join table in migration', () => {
    const spec = baseSpec([
      { name: 'title', type: 'string' },
      { name: 'tags', type: 'many-to-many', ref: 'tag' },
    ]);

    const result = EntityFactory.create(spec, new Map(), 'demo');

    expect(result.joinTableSchemas.length).toBe(1);
    const joinSchema = result.joinTableSchemas[0];
    const options = joinSchema.options as any;

    expect(options.columns).toHaveProperty('ProjectId');
    expect(options.columns).toHaveProperty('tagId');
    expect(options.relations).toHaveProperty('Project');
    expect(options.relations).toHaveProperty('tag');
  });
});

describe('SpecValidator fixes', () => {
  const baseResource = (fields: ResourceSpec['fields']): ResourceSpec => ({
    name: 'Issue',
    table: 'ext_demo_issues',
    fields,
  });

  const emptyLoaded = (resource: ResourceSpec) => ({
    spec: {
      name: 'demo',
      version: '1.0.0',
      resources: [resource],
    },
    dir: '/tmp/demo',
    specPath: '/tmp/demo/demo.spec.yaml',
  });

  it('should accept computed field type', () => {
    const resource = baseResource([
      { name: 'computedField', type: 'computed' },
    ]);

    const result = SpecValidator.validateAll([emptyLoaded(resource)]);

    expect(result.valid).toBe(true);
    expect(result.errors.some((e) => e.field === 'computedField')).toBe(false);
  });

  it('should accept beforeQuery hook type', () => {
    const resource: ResourceSpec = {
      ...baseResource([{ name: 'title', type: 'string' }]),
      hooks: {
        beforeQuery: './hooks/before-query.ts',
      },
    };
    const loaded = emptyLoaded(resource);

    const result = SpecValidator.validateResource(
      resource,
      new Map([[resource.name, { spec: resource, loaded }]]),
      loaded.dir,
    );

    expect(
      result.errors.some((e) =>
        e.message.toLowerCase().includes('beforequery'),
      ),
    ).toBe(false);
  });

  it('should accept many-to-many field type', () => {
    const resource = baseResource([
      { name: 'tags', type: 'many-to-many', ref: 'tag' },
    ]);

    const result = SpecValidator.validateAll([emptyLoaded(resource)]);

    expect(result.valid).toBe(true);
    expect(
      result.errors.some(
        (e) => e.field === 'tags' && e.message.includes('Invalid field type'),
      ),
    ).toBe(false);
  });

  it('should reject many-to-many without ref', () => {
    const resource = baseResource([{ name: 'tags', type: 'many-to-many' }]);

    const result = SpecValidator.validateAll([emptyLoaded(resource)]);

    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) =>
          e.field === 'tags' &&
          e.message.includes('many-to-many field has no ref target'),
      ),
    ).toBe(true);
  });
});

// Silences unused-import lint for Logger if not otherwise referenced in a type-only way.
// Logger is used as a type through the spec.types import, but keep the symbol alive here.
const _loggerTypeCheck: typeof Logger = Logger;
void _loggerTypeCheck;
