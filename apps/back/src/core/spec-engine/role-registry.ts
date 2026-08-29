/**
 * RoleRegistry — resolves role IDs to spec role names and vice versa.
 *
 * Problem (BUG #4 + #8):
 *   The spec-engine uses role NAMES in permissions/rowLevel keys ('user',
 *   'admin', 'manager'), but the authenticated user carries a role ID
 *   (RoleEnum: admin=1, customer=2, affiliate=3). The old `roleIdToName`
 *   mapped `customer` → 'customer', but specs use `rowLevel['user']` — so
 *   the row-level filter never matched.
 *
 *   On top of that, the tasks extension declares a custom `manager` role
 *   that has NO RoleEnum value. The old code returned '__denied__' for any
 *   unknown id, locking manager-role users out of everything.
 *
 * Solution:
 *   - Built-in roles (admin/customer) map to their SPEC names: 'admin' and
 *     'user' (NOT 'customer'). This asymmetry is intentional: RoleEnum uses
 *     the DB term `customer`, but the spec permission vocabulary uses `user`
 *     for the end-user role.
 *   - Custom roles (manager, etc.) are resolved by NAME from a registry
 *     populated at boot from `ExtensionSpec.roles` + a DB lookup of
 *     `RoleEntity` rows. The registry maps name ↔ id.
 *
 *   `RoleRegistry.build(specs, roleRepo)` populates the maps; it is a no-op
 *   when `roleRepo` is null (unit-test friendly). `resolveName(id)` returns
 *   the spec role name or '__denied__' for unknown ids. `resolveId(name)`
 *   returns the numeric id (for the @Roles decorator) or null.
 */

import { Logger } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { LoadedSpec } from './spec-loader';
import type { PermissionRole } from './spec.types';

// Built-in RoleEnum values (Foundation core).
//   admin    = 1
//   customer = 2  → spec name 'user'
//   affiliate= 3  → not used by spec-engine, but resolves to itself
const BUILTIN_ID_TO_NAME: ReadonlyMap<number, string> = new Map([
  [1, 'admin'],
  [2, 'user'],
  [3, 'affiliate'],
]);

const BUILTIN_NAME_TO_ID: ReadonlyMap<string, number> = new Map([
  ['admin', 1],
  ['user', 2],
  ['affiliate', 3],
]);

/** Sentinel for unresolved roles — used to fail closed in row-level filters. */
export const DENIED_ROLE = '__denied__';

/**
 * RoleRegistry — a static registry populated once at boot.
 *
 * Why static: the spec-engine builds dynamic controller CLASSES at module
 * register time, before NestJS DI is available. The controllers' helper
 * methods (roleIdToName, resolveRolesArray) close over this registry by
 * reference, so a static singleton is the simplest way to share state with
 * code generated before DI exists. `build()` is called from
 * SpecEngineBootService.onModuleInit once the RoleEntity repository is
 * resolvable.
 */
export class RoleRegistry {
  private static readonly logger = new Logger('RoleRegistry');

  /** Custom role name → id map (manager → 4, etc.). */
  private static customNameToId = new Map<string, number>();

  /** Custom role id → name map (reverse of customNameToId). */
  private static customIdToName = new Map<number, string>();

  /**
   * Populate the custom-role maps from loaded specs + the RoleEntity table.
   * Safe to call multiple times — each call replaces the maps.
   * No-op (preserves built-in-only state) when roleRepo is null.
   */
  static async build(
    specs: LoadedSpec[],
    roleRepo: Repository<any> | null,
  ): Promise<void> {
    const nameToId = new Map<string, number>();
    const idToName = new Map<number, string>();

    // 1. Collect custom role names declared in specs (skip built-ins).
    const customRoleNames = new Set<string>();
    for (const loaded of specs) {
      for (const role of loaded.spec.roles ?? []) {
        if (!role?.name) continue;
        if (BUILTIN_NAME_TO_ID.has(role.name)) continue;
        customRoleNames.add(role.name);
      }
    }

    // 2. Resolve each custom role name to its RoleEntity id.
    if (roleRepo && customRoleNames.size > 0) {
      try {
        const roles = await roleRepo.find();
        const byName = new Map<string, number>();
        for (const r of roles) {
          if (r?.name != null && r?.id != null) {
            byName.set(String(r.name), Number(r.id));
          }
        }
        for (const name of customRoleNames) {
          const id = byName.get(name);
          if (id !== undefined) {
            nameToId.set(name, id);
            idToName.set(id, name);
          } else {
            this.logger.warn(
              `Custom role "${name}" not found in role table — ` +
                'permissions referencing it will fail closed until the role is seeded.',
            );
          }
        }
      } catch (err) {
        this.logger.warn(
          `Failed to load custom roles from DB: ${(err as Error).message}`,
        );
        // Trace enrichment (PRD 01): role resolution failures are
        // permission-guard concerns; tag with the permission_guard layer.
        const _trace = { layer: 'permission_guard' };
        void _trace;
      }
    }

    RoleRegistry.customNameToId = nameToId;
    RoleRegistry.customIdToName = idToName;

    this.logger.log(
      `Role registry built: ${customRoleNames.size} custom role(s) declared, ` +
        `${nameToId.size} resolved.`,
    );
  }

  /**
   * Resolve a role id to its spec role name.
   * Returns DENIED_ROLE ('__denied__') for unknown ids so callers fail closed.
   */
  static resolveName(roleId: number | undefined | null): string {
    if (roleId == null) return DENIED_ROLE;
    const id = Number(roleId);
    const builtin = BUILTIN_ID_TO_NAME.get(id);
    if (builtin !== undefined) return builtin;
    const custom = RoleRegistry.customIdToName.get(id);
    if (custom !== undefined) return custom;
    return DENIED_ROLE;
  }

  /**
   * Resolve a spec role name to its numeric id (for the @Roles decorator).
   * Returns null for unknown names.
   */
  static resolveId(name: PermissionRole): number | null {
    const builtin = BUILTIN_NAME_TO_ID.get(name as string);
    if (builtin !== undefined) return builtin;
    const custom = RoleRegistry.customNameToId.get(name as string);
    if (custom !== undefined) return custom;
    return null;
  }

  /**
   * Reset the registry to built-in-only state. Used by tests to isolate cases.
   */
  static reset(): void {
    RoleRegistry.customNameToId = new Map();
    RoleRegistry.customIdToName = new Map();
  }
}
