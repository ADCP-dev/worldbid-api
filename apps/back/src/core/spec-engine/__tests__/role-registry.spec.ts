/**
 * RoleRegistry — TDD tests for BUG #4 + #8.
 *
 *   - roleIdToName(customer=2) must return 'user' (not 'customer') so
 *     rowLevel['user'] matches.
 *   - Custom roles (manager) resolve via DB RoleEntity lookup.
 *   - Unknown roles fail closed to '__denied__'.
 *   - resolveId mirrors resolveName for the @Roles decorator path.
 */

import { RoleRegistry, DENIED_ROLE } from '@src/core/spec-engine/role-registry';
import type { LoadedSpec } from '@src/core/spec-engine/spec-loader';

function makeMockRoleRepo(
  roles: Array<{ id: number; name: string }>,
): import('typeorm').Repository<any> {
  return { find: jest.fn().mockResolvedValue(roles) } as unknown as import('typeorm').Repository<any>;
}

function makeLoadedSpec(roleNames: string[]): LoadedSpec[] {
  return [
    {
      spec: {
        name: 'tasks',
        version: '2.0.0',
        resources: [],
        roles: roleNames.map((name) => ({ name, description: '', permissions: [] })),
      },
      dir: '/tmp/tasks',
      specPath: '/tmp/tasks/tasks.extension.spec.yaml',
    },
  ];
}

describe('RoleRegistry — built-in resolution (BUG #4)', () => {
  beforeEach(() => RoleRegistry.reset());

  it('admin id (1) resolves to "admin"', () => {
    expect(RoleRegistry.resolveName(1)).toBe('admin');
  });

  it('customer id (2) resolves to "user" (NOT "customer")', () => {
    expect(RoleRegistry.resolveName(2)).toBe('user');
    expect(RoleRegistry.resolveName(2)).not.toBe('customer');
  });

  it('affiliate id (3) resolves to "affiliate"', () => {
    expect(RoleRegistry.resolveName(3)).toBe('affiliate');
  });

  it('unknown id fails closed to __denied__', () => {
    expect(RoleRegistry.resolveName(999)).toBe(DENIED_ROLE);
  });

  it('null/undefined id fails closed to __denied__', () => {
    expect(RoleRegistry.resolveName(undefined)).toBe(DENIED_ROLE);
    expect(RoleRegistry.resolveName(null)).toBe(DENIED_ROLE);
  });
});

describe('RoleRegistry — resolveId (mirror, for @Roles decorator)', () => {
  beforeEach(() => RoleRegistry.reset());

  it('"admin" → 1', () => {
    expect(RoleRegistry.resolveId('admin')).toBe(1);
  });

  it('"user" → 2 (the customer RoleEnum value)', () => {
    expect(RoleRegistry.resolveId('user')).toBe(2);
  });

  it('unknown name → null', () => {
    expect(RoleRegistry.resolveId('nonexistent' as any)).toBeNull();
  });
});

describe('RoleRegistry — custom roles via DB (BUG #8)', () => {
  beforeEach(() => RoleRegistry.reset());

  it('manager role resolves after build() with a RoleEntity row', async () => {
    const repo = makeMockRoleRepo([
      { id: 1, name: 'admin' },
      { id: 2, name: 'customer' },
      { id: 4, name: 'manager' },
    ]);
    await RoleRegistry.build(makeLoadedSpec(['manager']), repo);

    expect(RoleRegistry.resolveName(4)).toBe('manager');
    expect(RoleRegistry.resolveId('manager')).toBe(4);
  });

  it('custom role not yet seeded fails closed until build() sees it', async () => {
    // build() with a repo that has no manager row → warn, role unresolved.
    const repo = makeMockRoleRepo([{ id: 1, name: 'admin' }, { id: 2, name: 'customer' }]);
    await RoleRegistry.build(makeLoadedSpec(['manager']), repo);

    expect(RoleRegistry.resolveName(4)).toBe(DENIED_ROLE);
    expect(RoleRegistry.resolveId('manager')).toBeNull();
  });

  it('null roleRepo is a no-op (built-ins still work, custom roles denied)', async () => {
    await RoleRegistry.build(makeLoadedSpec(['manager']), null);

    expect(RoleRegistry.resolveName(1)).toBe('admin');
    expect(RoleRegistry.resolveName(2)).toBe('user');
    expect(RoleRegistry.resolveName(4)).toBe(DENIED_ROLE);
  });

  it('build() is idempotent — calling twice does not corrupt the maps', async () => {
    const repo = makeMockRoleRepo([
      { id: 1, name: 'admin' },
      { id: 2, name: 'customer' },
      { id: 4, name: 'manager' },
    ]);
    await RoleRegistry.build(makeLoadedSpec(['manager']), repo);
    await RoleRegistry.build(makeLoadedSpec(['manager']), repo);

    expect(RoleRegistry.resolveName(4)).toBe('manager');
    expect(RoleRegistry.resolveId('manager')).toBe(4);
  });
});