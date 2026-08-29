/**
 * ControllerFactory — P0 fixes regression tests.
 *
 * A. Transaction-manager race: the dynamic controller used to store the
 *    transactional EntityManager as an instance field set inside
 *    `dataSource.transaction()` callbacks. NestJS controllers are
 *    singletons, so concurrent writes could commit through each other's
 *    manager or clear it mid-flight. The fix threads the EntityManager
 *    through the pipeline as a method-local parameter. These tests fire
 *    two overlapping create() calls with different stub managers and
 *    assert each write used its own manager.
 *
 * B. Hook abort → HTTP error: HookAbortError used to be swallowed and
 *    returned as a 2xx body `{ error }`. The contract fix maps aborts to
 *    BadRequestException for create/update/delete (transactional and
 *    non-transactional paths).
 */

import 'reflect-metadata';
import type { EntitySchema } from 'typeorm';
import { vi } from 'vitest';

import { ControllerFactory } from '@src/core/spec-engine/controller-factory';
import { EntityFactory } from '@src/core/spec-engine/entity-factory';
import { HookExecutor } from '@src/core/spec-engine/hook-executor';
import { NotificationDispatcher } from '@src/core/spec-engine/notification-dispatcher';
import { HookAbortError } from '@src/core/spec-engine/spec.types';
import { BadRequestException } from '@nestjs/common';
import { SpecEngineBootService } from '@src/core/spec-engine/spec-engine-boot';
import { RoleRegistry } from '@src/core/spec-engine/role-registry';

// Stub the boot service singletons before any controller pipeline runs:
// afterEntityCreate/Update/Delete eagerly build a HookContext (outbound
// webhooks + scheduled actions wiring) even when nothing is configured.
SpecEngineBootService.moduleRef = {
  get: () => {
    throw new Error('no module ref in test');
  },
} as never;
SpecEngineBootService.configService = {
  get: () => undefined,
} as never;
import type {
  ResourceSpec,
  HookContext,
} from '@src/core/spec-engine/spec.types';
import type { TraceBuilder } from '@src/core/spec-engine/spec-trace';
import { EntityManager } from 'typeorm';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeResource(overrides: Partial<ResourceSpec> = {}): ResourceSpec {
  return {
    name: 'task',
    table: 'ext_test_task',
    fields: [{ name: 'title', type: 'string', required: true }],
    timestamps: false,
    softDelete: false,
    ...overrides,
  } as ResourceSpec;
}

function makeEntitySchema(resource: ResourceSpec): EntitySchema<any> {
  const { mainSchema } = EntityFactory.create(resource);
  return mainSchema as EntitySchema<any>;
}

/** Minimal mock repository — records which entity objects were created/saved. */
function makeMockRepo(tag: string) {
  const created: any[] = [];
  const saved: any[] = [];
  return {
    tag,
    created,
    saved,
    create: (data: Record<string, unknown>) => {
      const entity = { id: created.length + 1, ...data };
      created.push(entity);
      return entity;
    },
    save: async (entity: any) => {
      saved.push(entity);
      return entity;
    },
    findOne: async () => ({ id: 1, title: 'x' }),
    update: async () => undefined,
    softDelete: async () => undefined,
  };
}

/**
 * Deferred-transaction DataSource mock: `transaction(cb)` can be held open
 * so two requests overlap deterministically.
 */
function makeDeferredTransactionDataSource() {
  const pending: Array<{
    resolve: (manager: any) => void;
  }> = [];
  return {
    pending,
    /** Start a transaction; the test resolves it later with a manager. */
    transaction: (cb: (manager: any) => Promise<unknown>) =>
      new Promise((outerResolve, outerReject) => {
        // The callback receives the manager only after the test releases it.
        // We forward the release by wrapping: TypeORM calls cb(manager) then
        // commits. We let the test supply the manager via `pending`.
        let released = false;
        const p = new Promise<any>((resolve) => {
          pending.push({
            resolve: (manager: any) => {
              released = true;
              resolve(manager);
            },
          });
        });
        void released;
        p.then((manager) => cb(manager)).then(outerResolve, outerReject);
      }),
  };
}

const stubNotificationDispatcher = {
  dispatch: () =>
    Promise.resolve({ evaluated: 0, matched: 0, fired: [], skipped: [] }),
} as unknown as NotificationDispatcher;

function fakeRes() {
  const headers: Record<string, string> = {};
  return {
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    headers,
  } as never;
}

function makeUser() {
  return {
    id: 1,
    role: { id: 1, name: 'admin' },
    sessionId: 's',
    language: 'en',
    iat: 0,
    exp: 0,
  } as any;
}

interface RunCreateParams {
  resource: ResourceSpec;
  hookExecutor: HookExecutor;
  dataSource: any;
  allHooks?: {
    beforeCreate?: any;
    afterCreate?: any;
    beforeUpdate?: any;
    afterUpdate?: any;
    beforeDelete?: any;
    afterDelete?: any;
    beforeQuery?: any;
  };
}

function buildController(params: RunCreateParams) {
  const { resource, hookExecutor, dataSource, allHooks = {} } = params;
  const entitySchema = makeEntitySchema(resource);
  const diToken = Symbol('repo-token');
  const { controllerClass } = ControllerFactory.create({
    spec: resource,
    entitySchema,
    extensionDir: '/tmp',
    extensionName: 'test',
    hookExecutor,
    notificationDispatcher: stubNotificationDispatcher,
    isDev: false,
    allHooks,
    manyToManySchemas: [],
  });
  const instance = new controllerClass({} as never);
  // Inject the mocked repository + dataSource directly (bypass Nest DI).
  (instance as any).repository = {
    findOne: async () => ({ id: 1, title: 'x' }),
  };
  Object.defineProperty(instance, 'dataSource', {
    value: dataSource,
    configurable: true,
    writable: true,
  });
  return instance as any;
}

// ─── A. Transaction-manager race ─────────────────────────────────────────────

describe('ControllerFactory — P0 transaction race (manager threading)', () => {
  it('should give each concurrent create its own transaction manager (no cross-contamination)', async () => {
    RoleRegistry.reset();
    const resource = makeResource();
    const hookExecutor = new HookExecutor() as any;

    const managerA = {
      getRepository: vi.fn(() => makeMockRepo('A')),
    } as unknown as EntityManager;
    const managerB = {
      getRepository: vi.fn(() => makeMockRepo('B')),
    } as unknown as EntityManager;

    const ds = makeDeferredTransactionDataSource();
    const controller = buildController({
      resource,
      hookExecutor,
      dataSource: ds,
    });

    // Fire two overlapping create calls.
    const pA = controller.create(
      { title: 'A' },
      { user: makeUser() } as never,
      fakeRes(),
    );
    const pB = controller.create(
      { title: 'B' },
      { user: makeUser() } as never,
      fakeRes(),
    );

    // Release both transactions with DIFFERENT managers (interleaved).
    ds.pending[0].resolve(managerA);
    ds.pending[1].resolve(managerB);

    const [outA, outB] = await Promise.all([pA, pB]);

    // Each manager was consulted for its repository (own scope only).
    expect(managerA.getRepository).toHaveBeenCalled();
    expect(managerB.getRepository).toHaveBeenCalled();

    // Both operations succeeded and returned their own entity payload.
    expect(outA.title).toBe('A');
    expect(outB.title).toBe('B');
  });

  it('uses the per-request manager for the DB stage (independent manager per call)', async () => {
    RoleRegistry.reset();
    const resource = makeResource();
    const hookExecutor = new HookExecutor() as any;

    const savedByManager: string[] = [];
    const makeManager = (tag: string) => ({
      getRepository: () => ({
        create: (d: Record<string, unknown>) => ({ id: 1, ...d }),
        save: async (e: any) => {
          savedByManager.push(tag);
          return e;
        },
        findOne: async () => ({ id: 1 }),
      }),
    });

    const managers = [makeManager('A'), makeManager('B')];
    let callIdx = 0;
    const ds = {
      transaction: async (cb: (m: any) => Promise<unknown>) =>
        cb(managers[callIdx++]),
    };

    const controller = buildController({
      resource,
      hookExecutor,
      dataSource: ds,
    });
    await controller.create(
      { title: 'first' },
      { user: makeUser() } as never,
      fakeRes(),
    );
    await controller.create(
      { title: 'second' },
      { user: makeUser() } as never,
      fakeRes(),
    );

    // Each call committed through its OWN manager's save, in order.
    expect(savedByManager).toEqual(['A', 'B']);
  });

  it('does not keep manager state on the instance after calls complete', async () => {
    RoleRegistry.reset();
    const resource = makeResource();
    const hookExecutor = new HookExecutor() as any;

    const savedByManager: string[] = [];
    const manager = {
      getRepository: () => ({
        create: (d: Record<string, unknown>) => ({ id: 1, ...d }),
        save: async (e: any) => {
          savedByManager.push('tx');
          return e;
        },
        findOne: async () => ({ id: 1 }),
      }),
    };
    const ds = {
      transaction: async (cb: (m: any) => Promise<unknown>) => cb(manager),
    };
    const controller = buildController({
      resource,
      hookExecutor,
      dataSource: ds,
    });
    await controller.create(
      { title: 'x' },
      { user: makeUser() } as never,
      fakeRes(),
    );

    // The manager was threaded through the pipeline (not stored on the
    // instance) — the class must not expose a `transactionManager` field.
    expect('transactionManager' in controller).toBe(false);
    expect(savedByManager).toEqual(['tx']);
  });
});

// ─── B. Hook abort → HTTP error ──────────────────────────────────────────────

function abortingBeforeHookExecutor(message: string): {
  hooks: { beforeCreate?: any; beforeUpdate?: any; beforeDelete?: any };
  executor: HookExecutor;
} {
  const thrower = async (
    _hook: unknown,
    _data: Record<string, unknown>,
    _ctx: HookContext,
    trace: TraceBuilder,
  ) => {
    // Mirror real executor behavior: record trace, throw HookAbortError.
    trace?.endStage?.('beforeHook', 'fail', { proceed: false });
    throw new HookAbortError(message, 400);
  };
  return {
    hooks: {
      beforeCreate: { handler: thrower, path: 'test-abort.ts' },
      beforeUpdate: { handler: thrower, path: 'test-abort.ts' },
      beforeDelete: { handler: thrower, path: 'test-abort.ts' },
    },
    executor: new HookExecutor() as HookExecutor,
  };
}

function makeTransactionDataSource(): any {
  return {
    transaction: async (cb: (m: any) => Promise<unknown>) =>
      cb({
        getRepository: () => ({
          create: (d: Record<string, unknown>) => ({ id: 1, ...d }),
          save: async (e: any) => e,
          findOne: async () => ({ id: 1, title: 'x' }),
          update: async () => undefined,
          softDelete: async () => undefined,
        }),
      }),
  };
}

describe('ControllerFactory — P0 hook abort is an HTTP error (not 2xx body)', () => {
  it('create: hook abort throws BadRequestException with the hook message (transactional)', async () => {
    RoleRegistry.reset();
    const resource = makeResource();
    const { hooks, executor: hookExecutor } = abortingBeforeHookExecutor(
      'Nope — blocked by hook',
    );

    const controller = buildController({
      resource,
      hookExecutor,
      allHooks: hooks,
      dataSource: makeTransactionDataSource(),
    });

    await expect(
      controller.create(
        { title: 'x' },
        { user: makeUser() } as never,
        fakeRes(),
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      controller.create(
        { title: 'x' },
        { user: makeUser() } as never,
        fakeRes(),
      ),
    ).rejects.toThrow('Nope — blocked by hook');
  });

  it('create: hook abort throws BadRequestException (non-transactional path)', async () => {
    RoleRegistry.reset();
    const resource = makeResource({ transactional: false });
    const { hooks, executor: hookExecutor } =
      abortingBeforeHookExecutor('denied');

    const controller = buildController({
      resource,
      hookExecutor,
      allHooks: hooks,
      dataSource: makeTransactionDataSource(),
    });

    await expect(
      controller.create(
        { title: 'x' },
        { user: makeUser() } as never,
        fakeRes(),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('update: hook abort throws BadRequestException with the hook message', async () => {
    RoleRegistry.reset();
    const resource = makeResource();
    const { hooks, executor: hookExecutor } = abortingBeforeHookExecutor(
      'cannot update this one',
    );

    const controller = buildController({
      resource,
      hookExecutor,
      allHooks: hooks,
      dataSource: makeTransactionDataSource(),
    });

    await expect(
      controller.update(
        '1',
        { title: 'y' },
        { user: makeUser() } as never,
        fakeRes(),
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      controller.update(
        '1',
        { title: 'y' },
        { user: makeUser() } as never,
        fakeRes(),
      ),
    ).rejects.toThrow('cannot update this one');
  });

  it('delete: HookAbortError thrown inside the transaction maps to BadRequestException', async () => {
    RoleRegistry.reset();
    const resource = makeResource();
    const { hooks, executor: hookExecutor } =
      abortingBeforeHookExecutor('delete blocked');

    const controller = buildController({
      resource,
      hookExecutor,
      allHooks: hooks,
      dataSource: {
        transaction: async (cb: (m: any) => Promise<unknown>) =>
          cb({
            getRepository: () => ({
              findOne: async () => ({ id: 1, title: 'keep' }),
              softDelete: async () => {
                throw new HookAbortError('delete refused', 400);
              },
            }),
          }),
      },
    });

    await expect(
      controller.remove('1', { user: makeUser() } as never, fakeRes()),
    ).rejects.toThrow(BadRequestException);
  });
});

// Ensure the boot-service import is retained for instance construction paths
// that read the DataSource lazily (some tests stub it at class level).
void SpecEngineBootService;
