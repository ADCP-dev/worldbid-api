/**
 * ControllerFactory — TDD tests for CRUD generation + role resolution.
 *
 * Covers:
 *   - ControllerFactory.create returns a class with the 5 CRUD methods
 *   - Pluralization rule matches the route used by the materialized controller
 *   - resolveRoles honors custom roles via RoleRegistry (BUG #8 regression)
 *   - parseId accepts numeric strings and rejects non-numeric input
 *
 * The dynamic controller class is inspected via Reflect.metadata without
 * instantiating it (which would require a NestJS DI container). We assert the
 * class shape: methods exist and the @Controller path is the pluralized name.
 */

import 'reflect-metadata';
import type { EntitySchema } from 'typeorm';
import { ControllerFactory, parseId } from '@src/core/spec-engine/controller-factory';
import { RoleRegistry } from '@src/core/spec-engine/role-registry';
import { EntityFactory } from '@src/core/spec-engine/entity-factory';
import { HookExecutor } from '@src/core/spec-engine/hook-executor';
import { NotificationDispatcher } from '@src/core/spec-engine/notification-dispatcher';
import type {
  ResourceSpec,
  ExtensionSpec,
  PermissionRole,
  LoadedSpec,
} from '@src/core/spec-engine/spec.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeResource(name: string, opts: Partial<ResourceSpec> = {}): ResourceSpec {
  return {
    name,
    table: `ext_test_${name}`,
    fields: opts.fields ?? [
      { name: 'title', type: 'string' as const, required: true, length: 200 },
    ],
    permissions: opts.permissions,
    ...opts,
  } as ResourceSpec;
}

function makeEntitySchema(resource: ResourceSpec): EntitySchema<unknown> {
  const { mainSchema } = EntityFactory.create(resource);
  return mainSchema as EntitySchema<unknown>;
}

// Minimal stubs — create() does not invoke these at build time.
const stubHookExecutor = { load: () => undefined } as unknown as HookExecutor;
const stubNotificationDispatcher = {
  dispatch: () => Promise.resolve(),
} as unknown as NotificationDispatcher;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ControllerFactory — CRUD generation', () => {
  it('create() returns a controller class with the 5 CRUD methods', () => {
    const resource = makeResource('task');
    const entitySchema = makeEntitySchema(resource);
    const result = ControllerFactory.create({
      spec: resource,
      entitySchema,
      extensionDir: '/tmp',
      hookExecutor: stubHookExecutor,
      notificationDispatcher: stubNotificationDispatcher,
      isDev: false,
      allHooks: {},
      manyToManySchemas: [],
    });

    expect(result.controllerClass).toBeDefined();
    expect(result.entitySchemaName).toBe('task');
    const proto = result.controllerClass.prototype;
    expect(typeof proto.findAll).toBe('function');
    expect(typeof proto.findOne).toBe('function');
    expect(typeof proto.create).toBe('function');
    expect(typeof proto.update).toBe('function');
    expect(typeof proto.remove).toBe('function');
  });

  it('pluralizes the controller route (task → tasks, activity → activities)', () => {
    const cases: Array<[string, string]> = [
      ['task', 'tasks'],
      ['activity', 'activities'],
      ['box', 'boxes'],
      ['status', 'status'],
    ];
    for (const [singular, plural] of cases) {
      const resource = makeResource(singular);
      const entitySchema = makeEntitySchema(resource);
      const result = ControllerFactory.create({
        spec: resource,
        entitySchema,
        extensionDir: '/tmp',
        hookExecutor: stubHookExecutor,
        notificationDispatcher: stubNotificationDispatcher,
        isDev: false,
        allHooks: {},
        manyToManySchemas: [],
      });
      // Read the @Controller(path) metadata that NestJS stores on the class.
      const path = Reflect.getMetadata('path', result.controllerClass);
      expect(path).toBe(plural);
    }
  });
});

describe('ControllerFactory — role resolution (BUG #8 regression)', () => {
  // Access the private static helper via the class to test the pure logic.
  const resolveRoles = (roles: PermissionRole[]): number[] =>
    (ControllerFactory as unknown as {
      resolveRoles: (r: PermissionRole[]) => number[];
    }).resolveRoles(roles);

  it('resolves built-in admin role to its numeric id', () => {
    RoleRegistry.reset();
    const ids = resolveRoles(['admin']);
    expect(ids).toContain(1); // admin is RoleEnum.admin = 1
  });

  it('resolves custom roles declared via ExtensionSpec.roles', async () => {
    RoleRegistry.reset();
    const extSpec: ExtensionSpec = {
      name: 'test',
      version: '1.0.0',
      resources: [],
      roles: [
        { name: 'manager', description: 'Team lead', permissions: ['*'] },
      ],
    } as ExtensionSpec;
    const loaded: LoadedSpec = {
      spec: extSpec,
      dir: '/tmp',
      specPath: '/tmp/test.spec.yaml',
    };
    // Mock roleRepo.find() returns manager with id 5.
    const roleRepo = {
      find: async () => [{ name: 'manager', id: 5 }],
    };
    await RoleRegistry.build([loaded], roleRepo as never);
    const ids = resolveRoles(['manager']);
    expect(ids).toContain(5);
  });

  it('drops unknown roles (fail-closed) instead of pushing null', () => {
    RoleRegistry.reset();
    const ids = resolveRoles(['nonexistent' as PermissionRole]);
    expect(ids).toEqual([]);
  });
});

describe('ControllerFactory — parseId', () => {
  it('accepts numeric strings', () => {
    expect(parseId('42')).toBe(42);
    expect(parseId('0')).toBe(0);
  });

  it('rejects non-numeric input with NaN', () => {
    expect(Number.isNaN(parseId('abc'))).toBe(true);
    expect(Number.isNaN(parseId('1.5.2'))).toBe(true);
    expect(Number.isNaN(parseId('NaN'))).toBe(true);
  });

  it('accepts numeric edge cases (0, negative, decimal)', () => {
    expect(parseId('0')).toBe(0);
    expect(parseId('-5')).toBe(-5);
    expect(parseId('1.5')).toBe(1.5);
  });
});