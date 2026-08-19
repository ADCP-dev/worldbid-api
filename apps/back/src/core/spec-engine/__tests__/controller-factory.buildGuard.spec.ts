/**
 * ControllerFactory.buildGuard — per-operation guard resolution (PRD 07).
 *
 * Tests that the controller factory resolves the correct guard stack for
 * each CRUD operation given a resource's `permissions` block. Covers:
 *   - default `auth: [jwt]` when `auth` absent
 *   - `auth: [public]` + operation roles include `public` → PublicGuard
 *   - `auth: [public]` + operation roles do NOT include public (e.g.
 *     create: [admin]) → JWT fallback (you can't be admin anonymously)
 *   - `auth: [jwt, api-key]` → JwtOrApiKey (FlexibleAuthGuard)
 *   - `auth: [api-key]` → ApiKeyGuard
 *   - operation roles `[]` and no public → DenyAllGuard
 */
import { resolveGuardStack } from '@src/core/spec-engine/controller-factory';
import { DenyAllGuard } from '@src/core/spec-engine/deny-all.guard';
import { PublicGuard } from '@src/core/spec-engine/public.guard';
import type {
  PermissionSpec,
  PermissionAction,
} from '@src/core/spec-engine/spec.types';

const authJwt = (overrides: Partial<PermissionSpec> = {}): PermissionSpec => ({
  auth: ['jwt'],
  list: ['admin'],
  read: ['admin'],
  create: ['admin'],
  update: ['admin'],
  delete: ['admin'],
  ...overrides,
});

describe('ControllerFactory.resolveGuardStack', () => {
  describe('default auth (jwt when auth absent)', () => {
    it('uses JWT guard when auth is not declared', () => {
      const perms: PermissionSpec = {
        list: ['admin'],
        read: ['admin'],
        create: ['admin'],
        update: ['admin'],
        delete: ['admin'],
      };
      const stack = resolveGuardStack(perms, 'list');
      expect(stack.guardKind).toBe('jwt');
      expect(stack.isPublic).toBe(false);
      expect(stack.denyAll).toBe(false);
      expect(stack.effectiveRoles).toEqual(['admin']);
    });
  });

  describe('auth: [public]', () => {
    it('uses PublicGuard when the operation roles include public', () => {
      const perms = authJwt({
        auth: ['public'],
        list: ['public'],
        read: ['public'],
      });
      const stack = resolveGuardStack(perms, 'list');
      expect(stack.guardKind).toBe('public');
      expect(stack.isPublic).toBe(true);
      expect(stack.denyAll).toBe(false);
      // public operations do not need RolesGuard; effectiveRoles empty
      expect(stack.effectiveRoles).toEqual([]);
    });

    it('falls back to JWT when auth is [public] but the operation is admin-only', () => {
      const perms = authJwt({
        auth: ['public'],
        list: ['public'],
        create: ['admin'],
      });
      const stack = resolveGuardStack(perms, 'create');
      expect(stack.guardKind).toBe('jwt');
      expect(stack.isPublic).toBe(false);
      expect(stack.effectiveRoles).toEqual(['admin']);
    });
  });

  describe('auth: [jwt, api-key]', () => {
    it('uses the flexible guard accepting either method', () => {
      const perms = authJwt({ auth: ['jwt', 'api-key'] });
      const stack = resolveGuardStack(perms, 'list');
      expect(stack.guardKind).toBe('jwt-or-api-key');
      expect(stack.isPublic).toBe(false);
    });
  });

  describe('auth: [api-key]', () => {
    it('uses the API key guard exclusively', () => {
      const perms = authJwt({ auth: ['api-key'] });
      const stack = resolveGuardStack(perms, 'list');
      expect(stack.guardKind).toBe('api-key');
      expect(stack.isPublic).toBe(false);
    });
  });

  describe('deny all', () => {
    it('uses DenyAllGuard when operation roles are [] and no public', () => {
      const perms = authJwt({ delete: [] });
      const stack = resolveGuardStack(perms, 'delete');
      expect(stack.denyAll).toBe(true);
      expect(stack.guardKind).toBe('deny-all');
    });
  });

  describe('effectiveRoles strips public', () => {
    it('removes public from roles passed to RolesGuard', () => {
      const perms = authJwt({ list: ['admin', 'public'] });
      const stack = resolveGuardStack(perms, 'list');
      // admin present, public stripped — RolesGuard only gets admin
      expect(stack.effectiveRoles).toEqual(['admin']);
    });
  });

  describe('triangulation across operations', () => {
    const perms = authJwt({
      auth: ['public'],
      list: ['public'],
      read: ['public'],
      create: ['admin'],
      update: ['admin'],
      delete: [],
    });

    it.each([
      ['list', 'public'],
      ['read', 'public'],
      ['create', 'jwt'],
      ['update', 'jwt'],
      ['delete', 'deny-all'],
    ] as Array<[PermissionAction, string]>)(
      'operation %s resolves to %s',
      (op, kind) => {
        const stack = resolveGuardStack(perms, op);
        expect(stack.guardKind).toBe(kind);
      },
    );
  });
});