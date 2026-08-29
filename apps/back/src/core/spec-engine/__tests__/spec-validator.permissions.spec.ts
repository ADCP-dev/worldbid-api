/**
 * SpecValidator — permissions enforcement (PRD 07: Mandatory Guards)
 *
 * Tests that the validator surfaces structured errors for resources that do
 * not declare `permissions` for every CRUD operation, and for actions that
 * do not declare `auth`. Covers both warn mode (default — issues go to
 * `warnings` so existing extensions keep loading) and strict mode (issues
 * go to `errors` and block materialization).
 */
import { SpecValidator } from '@src/core/spec-engine/spec-validator';
import type {
  ResourceSpec,
  ExtensionSpec,
  LoadedSpec,
  PermissionSpec,
} from '@src/core/spec-engine/spec.types';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const baseResource = (overrides: Partial<ResourceSpec> = {}): ResourceSpec => ({
  name: 'task',
  table: 'ext_tasks_task',
  fields: [{ name: 'title', type: 'string', required: true }],
  ...overrides,
});

const fullPermissions: PermissionSpec = {
  auth: ['jwt'],
  list: ['admin'],
  read: ['admin'],
  create: ['admin'],
  update: ['admin'],
  delete: ['admin'],
};

// Build permissions by overriding specific keys. `undefined` removes a key
// so the validator sees it as missing.
const perms = (overrides: Partial<PermissionSpec>): PermissionSpec => ({
  ...fullPermissions,
  ...overrides,
});

const emptyLoaded = (resource: ResourceSpec): LoadedSpec => ({
  spec: {
    name: 'demo',
    version: '1.0.0',
    resources: [resource],
  } as ExtensionSpec,
  dir: '/tmp/demo',
  specPath: '/tmp/demo/demo.spec.yaml',
});

const validateStrict = (resource: ResourceSpec) =>
  SpecValidator.validateAll([emptyLoaded(resource)], { strict: true });

const validateWarn = (resource: ResourceSpec) =>
  SpecValidator.validateAll([emptyLoaded(resource)], { strict: false });

// ─── MISSING_PERMISSIONS ────────────────────────────────────────────────────

describe('SpecValidator permissions — MISSING_PERMISSIONS', () => {
  it('strict: rejects a resource with no permissions block', () => {
    const result = validateStrict(baseResource());

    expect(result.valid).toBe(false);
    const err = result.errors.find(
      (e) => e.code === 'MISSING_PERMISSIONS' && e.resource === 'task',
    );
    expect(err).toBeDefined();
    expect(err?.message).toContain('task');
    expect(err?.section).toBe('permissions');
    expect(err?.fix).toBeDefined();
    expect(err?.fix?.type).toBe('spec_fix');
    expect(err?.fix?.targetSpec).toBe('/tmp/demo/demo.spec.yaml');
  });

  it('warn: reports MISSING_PERMISSIONS as a warning, not an error', () => {
    const result = validateWarn(baseResource());

    expect(result.valid).toBe(true);
    const warn = result.warnings.find(
      (w) => w.code === 'MISSING_PERMISSIONS' && w.resource === 'task',
    );
    expect(warn).toBeDefined();
  });

  it('triangulation: different resource name appears in the message', () => {
    const result = validateStrict(
      baseResource({ name: 'invoice', table: 'ext_billing_invoice' }),
    );

    const err = result.errors.find((e) => e.code === 'MISSING_PERMISSIONS');
    expect(err?.message).toContain('invoice');
    expect(err?.resource).toBe('invoice');
  });
});

// ─── MISSING_PERMISSION_ACTION ──────────────────────────────────────────────

describe('SpecValidator permissions — MISSING_PERMISSION_ACTION', () => {
  it('strict: rejects when an operation is missing from permissions', () => {
    const result = validateStrict(
      baseResource({ permissions: perms({ delete: undefined }) }),
    );

    expect(result.valid).toBe(false);
    const err = result.errors.find(
      (e) =>
        e.code === 'MISSING_PERMISSION_ACTION' &&
        e.section === 'permissions.delete',
    );
    expect(err).toBeDefined();
    expect(err?.message).toContain('delete');
    expect(err?.resource).toBe('task');
  });

  it('strict: reports each missing operation separately', () => {
    const result = validateStrict(
      baseResource({
        permissions: {
          auth: ['jwt'],
          list: ['admin'],
        },
      }),
    );

    const missingOps = result.errors
      .filter((e) => e.code === 'MISSING_PERMISSION_ACTION')
      .map((e) => e.section);
    expect(missingOps).toEqual(
      expect.arrayContaining([
        'permissions.read',
        'permissions.create',
        'permissions.update',
        'permissions.delete',
      ]),
    );
    expect(missingOps).toHaveLength(4);
  });

  it('strict: empty array is valid (deny all — not missing)', () => {
    const result = validateStrict(
      baseResource({ permissions: perms({ delete: [] }) }),
    );

    const missingDelete = result.errors.find(
      (e) =>
        e.code === 'MISSING_PERMISSION_ACTION' &&
        e.section === 'permissions.delete',
    );
    expect(missingDelete).toBeUndefined();
  });

  it('strict: all five operations declared is valid for permissions', () => {
    const result = validateStrict(
      baseResource({ permissions: fullPermissions }),
    );

    const permErrors = result.errors.filter(
      (e) =>
        e.code === 'MISSING_PERMISSIONS' ||
        e.code === 'MISSING_PERMISSION_ACTION',
    );
    expect(permErrors).toHaveLength(0);
  });
});

// ─── MISSING_ACTION_AUTH ────────────────────────────────────────────────────

describe('SpecValidator permissions — MISSING_ACTION_AUTH', () => {
  it('strict: rejects a custom action without an auth declaration', () => {
    const result = validateStrict(
      baseResource({
        permissions: fullPermissions,
        actions: [
          {
            name: 'assign',
            method: 'POST',
            path: ':id/assign',
            handler: './actions/assign.ts',
          },
        ],
      }),
    );

    expect(result.valid).toBe(false);
    const err = result.errors.find(
      (e) =>
        e.code === 'MISSING_ACTION_AUTH' && e.section === 'actions.assign.auth',
    );
    expect(err).toBeDefined();
    expect(err?.message).toContain('assign');
  });

  it('strict: action with auth: [] is valid (deny all)', () => {
    const result = validateStrict(
      baseResource({
        permissions: fullPermissions,
        actions: [
          {
            name: 'assign',
            method: 'POST',
            path: ':id/assign',
            auth: [],
            handler: './actions/assign.ts',
          },
        ],
      }),
    );

    const authErr = result.errors.find((e) => e.code === 'MISSING_ACTION_AUTH');
    expect(authErr).toBeUndefined();
  });

  it('strict: action with auth: [admin] is valid', () => {
    const result = validateStrict(
      baseResource({
        permissions: fullPermissions,
        actions: [
          {
            name: 'assign',
            method: 'POST',
            path: ':id/assign',
            auth: ['admin'],
            handler: './actions/assign.ts',
          },
        ],
      }),
    );

    const authErr = result.errors.find((e) => e.code === 'MISSING_ACTION_AUTH');
    expect(authErr).toBeUndefined();
  });
});

// ─── PUBLIC_ROWLEVEL_REQUIRES_USER ──────────────────────────────────────────

describe('SpecValidator permissions — PUBLIC_ROWLEVEL_REQUIRES_USER', () => {
  it('strict: rejects rowLevel.public that references ${user.*}', () => {
    const result = validateStrict(
      baseResource({
        permissions: perms({
          auth: ['public'],
          list: ['public'],
          read: ['public'],
          rowLevel: {
            public: { filter: 'assigneeId == ${user.id}' },
          },
        }),
      }),
    );

    expect(result.valid).toBe(false);
    const err = result.errors.find(
      (e) => e.code === 'PUBLIC_ROWLEVEL_REQUIRES_USER',
    );
    expect(err).toBeDefined();
    expect(err?.section).toBe('permissions.rowLevel.public');
  });

  it('strict: rowLevel.public using entity fields only is valid', () => {
    const result = validateStrict(
      baseResource({
        permissions: perms({
          auth: ['public'],
          list: ['public'],
          read: ['public'],
          rowLevel: {
            public: { filter: 'published == true' },
          },
        }),
      }),
    );

    const err = result.errors.find(
      (e) => e.code === 'PUBLIC_ROWLEVEL_REQUIRES_USER',
    );
    expect(err).toBeUndefined();
  });
});

// ─── Existing 'public' WARNING removed ──────────────────────────────────────

describe('SpecValidator permissions — public role no longer warns', () => {
  it('does NOT emit the legacy "Permission public requires unguarding" warning', () => {
    const result = validateWarn(
      baseResource({
        permissions: perms({
          auth: ['public'],
          list: ['public'],
          read: ['public'],
        }),
      }),
    );

    const legacyWarn = result.warnings.find((w) =>
      w.message.includes('requires the route to be unguarded'),
    );
    expect(legacyWarn).toBeUndefined();
  });
});

// ─── Default strict mode via env var ────────────────────────────────────────

describe('SpecValidator permissions — strict mode default', () => {
  const prev = process.env.SPEC_ENGINE_STRICT;

  afterEach(() => {
    if (prev === undefined) delete process.env.SPEC_ENGINE_STRICT;
    else process.env.SPEC_ENGINE_STRICT = prev;
  });

  it('defaults to warn mode when SPEC_ENGINE_STRICT is unset', () => {
    delete process.env.SPEC_ENGINE_STRICT;
    const result = SpecValidator.validateAll([emptyLoaded(baseResource())]);

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.code === 'MISSING_PERMISSIONS')).toBe(
      true,
    );
    expect(result.errors.some((e) => e.code === 'MISSING_PERMISSIONS')).toBe(
      false,
    );
  });

  it('strict mode when SPEC_ENGINE_STRICT=true produces errors', () => {
    process.env.SPEC_ENGINE_STRICT = 'true';
    const result = SpecValidator.validateAll([emptyLoaded(baseResource())]);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'MISSING_PERMISSIONS')).toBe(
      true,
    );
  });
});
