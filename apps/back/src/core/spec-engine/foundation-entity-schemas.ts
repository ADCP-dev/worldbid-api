/**
 * FoundationEntitySchemas — minimal TypeORM EntitySchema mirrors of the
 * Foundation core entities that spec-engine `ref` fields target.
 *
 * WHY THIS EXISTS:
 *   TypeORM's `ConnectionMetadataBuilder.buildEntityMetadatas` splits entities
 *   into decorator-registered classes (built from the global
 *   `getMetadataArgsStorage()`) and EntitySchema objects (built from a SEPARATE
 *   `metadataArgsStorage` produced by `EntitySchemaTransformer`). Relations on
 *   EntitySchemas with string targets (e.g. `target: 'user'`) can only resolve
 *   entities registered in the SAME metadata store — they CANNOT cross-reference
 *   decorator-registered entities. (See TypeORM source comment:
 *   `// todo: instead we need to merge multiple metadata args storages`.)
 *
 *   The spec-engine builds its resource tables as EntitySchemas, so a spec field
 *   `ref: user` would fail at boot with
 *   `Entity metadata for task#user was not found`, even though `UserEntity` is
 *   `@Entity({ name: 'user' })` and loaded via the global entities glob.
 *
 * THE FIX:
 *   Build minimal EntitySchema mirrors of the referenced Foundation entities
 *   (same `name` + `tableName` as the decorator entity) and register them in the
 *   spec-engine's `TypeOrmModule.forFeature([...])` alongside the resource
 *   schemas. With `synchronize: false`, TypeORM does NOT emit DDL for these
 *   mirrors — it only uses them to resolve relation targets in the schema-build
 *   path. The decorator-registered entities remain the source of truth for the
 *   actual table; these mirrors only exist to satisfy relation resolution.
 *
 * WHICH ENTITIES:
 *   Only the Foundation entities that spec `ref` / `many-to-many` fields target.
 *   Today that is `user` (assignee, reporter, author, etc.) and `role` (RBAC
 *   joins). Adding more is a one-line change to `FOUNDATION_ENTITY_SPECS` below.
 *
 * NOTE: The column set here is intentionally a SUBSET — only the columns the
 *   spec-engine might load via `include=assignee` relations or that notification
 *   templates interpolate. TypeORM only needs the PK + any columns referenced
 *   by the relation's joinColumn. Extra columns are harmless (no DDL emitted).
 */

import { EntitySchema } from 'typeorm';

/**
 * Registry of Foundation entities mirrored as EntitySchemas, keyed by the
 * entity name (matching the `@Entity({ name })` value). Add new entries here
 * when a spec references a new Foundation entity.
 */
const FOUNDATION_ENTITY_SPECS: Array<{
  name: string;
  tableName: string;
  columns: Record<string, any>;
}> = [
  {
    // Mirrors UserEntity (@Entity({ name: 'user' })).
    // PK is integer auto-increment (matches Foundation convention).
    name: 'user',
    tableName: 'user',
    columns: {
      id: { type: Number, primary: true, generated: true },
      email: { type: 'varchar', nullable: true },
      firstName: { type: 'varchar', nullable: true },
      lastName: { type: 'varchar', nullable: true },
      provider: { type: 'varchar', nullable: false, default: 'email' },
      language: { type: 'varchar', length: 5, nullable: true },
      createdAt: { type: 'timestamp', createDate: true },
      updatedAt: { type: 'timestamp', updateDate: true },
      deletedAt: { type: 'timestamp', nullable: true, deleteDate: true },
    },
  },
  {
    // Mirrors RoleEntity (@Entity({ name: 'role' })).
    name: 'role',
    tableName: 'role',
    columns: {
      id: { type: Number, primary: true },
      name: { type: 'varchar', nullable: true },
      homeRoute: { type: 'varchar', nullable: true },
    },
  },
];

/**
 * Build and return the Foundation EntitySchema mirrors. These are intended to
 * be appended to the spec-engine's `forFeature` entities array.
 *
 * Idempotent: each call builds fresh schema objects (safe to call once at
 * module register time).
 */
export function buildFoundationEntitySchemas(): EntitySchema<any>[] {
  return FOUNDATION_ENTITY_SPECS.map(
    (spec) =>
      new EntitySchema<any>({
        name: spec.name,
        tableName: spec.tableName,
        columns: spec.columns,
      }),
  );
}

/**
 * The set of Foundation entity names that the spec-engine knows how to mirror.
 * Used by EntityFactory / SpecValidator to recognize `ref: user` / `ref: role`
 * as valid built-in targets (so they don't warn "ref target not found").
 */
export const FOUNDATION_ENTITY_NAMES: ReadonlySet<string> = new Set(
  FOUNDATION_ENTITY_SPECS.map((s) => s.name),
);
