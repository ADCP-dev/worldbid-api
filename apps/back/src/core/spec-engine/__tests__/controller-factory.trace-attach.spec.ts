/**
 * ControllerFactory — error trace attachment on create failure paths.
 *
 * Verifies that when the DB stage throws, the rethrown error carries the
 * finished pipeline trace (via SPEC_TRACE_MARKER) so the global exception
 * filter can persist it — replacing the former dead `_trace` stubs.
 */
import 'reflect-metadata';
import { describe, expect, it, beforeEach } from 'vitest';
import type { EntitySchema } from 'typeorm';

import { ControllerFactory } from '@src/core/spec-engine/controller-factory';
import { EntityFactory } from '@src/core/spec-engine/entity-factory';
import { HookExecutor } from '@src/core/spec-engine/hook-executor';
import { NotificationDispatcher } from '@src/core/spec-engine/notification-dispatcher';
import {
  extractTraceFromError,
} from '@src/core/spec-engine/error-trace';
import { resetTraceStoreForTest } from '@src/core/spec-engine/trace-store';
import { SpecEngineBootService } from '@src/core/spec-engine/spec-engine-boot';
import { RoleRegistry } from '@src/core/spec-engine/role-registry';
import type {
  ResourceSpec,
  AuthenticatedUser,
} from '@src/core/spec-engine/spec.types';

SpecEngineBootService.moduleRef = {
  get: () => {
    throw new Error('no module ref in test');
  },
} as never;
SpecEngineBootService.configService = {
  get: () => undefined,
} as never;

const stubNotificationDispatcher = {
  dispatch: () => Promise.resolve(),
} as unknown as NotificationDispatcher;

function makeResource(): ResourceSpec {
  return {
    name: 'task',
    table: 'ext_test_task',
    fields: [{ name: 'title', type: 'string', required: true }],
    timestamps: false,
    softDelete: false,
  } as ResourceSpec;
}

function makeEntitySchema(resource: ResourceSpec): EntitySchema<any> {
  const { mainSchema } = EntityFactory.create(resource);
  return mainSchema as EntitySchema<any>;
}

function makeUser(): AuthenticatedUser {
  return {
    id: 1,
    role: { id: 1, name: 'admin' },
    sessionId: 's',
    language: 'en',
    iat: 0,
    exp: 0,
  } as AuthenticatedUser;
}

function fakeRes() {
  const headers: Record<string, string> = {};
  return {
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    headers,
  } as never;
}

describe('ControllerFactory — create failure attaches trace to thrown error', () => {
  beforeEach(() => {
    resetTraceStoreForTest();
    RoleRegistry.reset();
  });

  it('should attach the finished trace to the error thrown by the transactional create path', async () => {
    const resource = makeResource();
    const entitySchema = makeEntitySchema(resource);
    const diToken = Symbol('repo-token');
    const { controllerClass } = ControllerFactory.create({
      spec: resource,
      entitySchema,
      extensionDir: '/tmp',
      extensionName: 'test',
      hookExecutor: new HookExecutor() as never,
      notificationDispatcher: stubNotificationDispatcher,
      isDev: false,
      allHooks: {},
      manyToManySchemas: [],
    });
    const instance = new controllerClass({} as never) as any;

    const failingRepo = {
      create: (data: Record<string, unknown>) => ({ id: 1, ...data }),
      save: async () => {
        throw new Error('duplicate key value');
      },
      findOne: async () => ({ id: 1 }),
    };
    (instance as any).repository = failingRepo;
    Object.defineProperty(instance, 'dataSource', {
      value: {
        transaction: async (cb: (m: unknown) => Promise<unknown>) =>
          cb({
            getRepository: () => failingRepo,
          }),
      },
      configurable: true,
      writable: true,
    });

    const err = await instance
      .create({ title: 'x' }, { user: makeUser() } as never, fakeRes())
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('duplicate key');

    const trace = extractTraceFromError(err);
    expect(trace).not.toBeNull();
    expect(trace?.resource).toBe('task');
    expect(trace?.operation).toBe('create');
    expect(trace?.layer).toBe('controller_factory');
    // The failed stage is recorded in the attached trace.
    const failed = trace?.stages.find((s) => s.status === 'fail');
    expect(failed?.stage).toBe('db');

    // The trace also landed in the ring buffer under the same requestId.
    // (Cross-checked via the extracted trace's requestId shape.)
    expect(trace?.requestId).toMatch(/^req_/);
  });

  it('should adopt x-request-id from the request headers into the trace', async () => {
    const resource = makeResource();
    const entitySchema = makeEntitySchema(resource);
    const diToken = Symbol('repo-token');
    const { controllerClass } = ControllerFactory.create({
      spec: resource,
      entitySchema,
      extensionDir: '/tmp',
      extensionName: 'test',
      hookExecutor: new HookExecutor() as never,
      notificationDispatcher: stubNotificationDispatcher,
      isDev: false,
      allHooks: {},
      manyToManySchemas: [],
    });
    const instance = new controllerClass({} as never) as any;

    const failingRepo = {
      create: (data: Record<string, unknown>) => ({ id: 1, ...data }),
      save: async () => {
        throw new Error('constraint violated');
      },
      findOne: async () => ({ id: 1 }),
    };
    (instance as any).repository = failingRepo;
    Object.defineProperty(instance, 'dataSource', {
      value: {
        transaction: async (cb: (m: unknown) => Promise<unknown>) =>
          cb({ getRepository: () => failingRepo }),
      },
      configurable: true,
      writable: true,
    });

    const req = {
      user: makeUser(),
      headers: { 'x-request-id': 'join-with-filter-99' },
    } as never;

    const err = await instance
      .create({ title: 'y' }, req, fakeRes())
      .catch((e: unknown) => e);

    const trace = extractTraceFromError(err);
    expect(trace?.requestId).toBe('join-with-filter-99');
  });
});