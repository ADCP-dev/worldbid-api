/**
 * MigrationGenerator — CLI utility that reads a spec YAML file and generates
 * a TypeORM migration .ts file for the extension's resources.
 *
 * For the spike:
 *   - Reads the current spec from extensions/<name>/*.spec.yaml
 *   - Compares it against a "previous spec snapshot" stored as JSON in a
 *     hypothetical spec_schema_version table (passed in as `previousSpec`)
 *   - Generates a CREATE TABLE migration for new resources
 *   - Generates ALTER TABLE statements for changed fields
 *   - Writes a TypeORM migration .ts file to src/infrastructure/database/migrations/
 *
 * This is a CLI utility (not a NestJS provider). Run it directly with ts-node.
 *
 * Usage:
 *   ts-node migration-generator.ts <extensionName> [extensionsDir] [migrationsDir]
 *
 * Field type → SQL type mapping:
 *   string   → varchar(255)
 *   text     → text
 *   integer  → integer
 *   decimal  → numeric(10,2)
 *   boolean  → boolean
 *   datetime → timestamptz
 *   date     → date
 *   json     → jsonb
 *   enum     → varchar
 *   ref      → integer
 *   file     → varchar
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type {
  ExtensionSpec,
  ResourceSpec,
  FieldSpec,
  FieldType,
  RealtimeSpec,
  VectorFieldSpec,
} from './spec.types';
import { SpecLoader } from './spec-loader';
import { TriggerFactory } from './trigger-factory';
import { joinTableName } from './naming';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * A flattened snapshot of a resource's schema, used for diffing.
 * Stored in the hypothetical spec_schema_version table as JSON.
 */
export interface ResourceSnapshot {
  table: string;
  fields: Array<{
    name: string;
    type: FieldType;
    nullable: boolean;
    unique: boolean;
    default?: unknown;
    length?: number;
    precision?: number;
    scale?: number;
    enum?: string[];
    // PRD 06: pgvector — stored for diff-aware ALTER COLUMN TYPE
    dimensions?: number;
    indexType?: 'hnsw' | 'ivfflat';
  }>;
  timestamps: boolean;
  softDelete: boolean;
  indices: string[];
  uniques: string[];
  joinTables: JoinTableSnapshot[];
  realtime?: RealtimeSpec;
}

export interface JoinTableSnapshot {
  name: string;
  fromColumn: string;
  toColumn: string;
  fromResource: string;
  toResource: string;
}

export interface SpecSnapshot {
  extensionName: string;
  version: string;
  resources: Record<string, ResourceSnapshot>;
}

export interface MigrationStatement {
  up: string;
  down: string;
  description: string;
  /** Deferred FK specs (populated by buildCreateTable, consumed by generator). */
  deferredFkSpecs?: Array<{
    column: string;
    targetTable: string;
    onDelete: string;
  }>;
}

export interface GenerationResult {
  migrationFileName: string;
  migrationClassName: string;
  timestamp: string;
  statements: MigrationStatement[];
  createdTables: string[];
  alteredTables: string[];
}

// ─── SQL Type Mapping ─────────────────────────────────────────────────────────

const FIELD_TYPE_TO_SQL: Record<FieldType, string> = {
  string: 'character varying(255)',
  text: 'text',
  integer: 'integer',
  decimal: 'numeric(10,2)',
  boolean: 'boolean',
  datetime: 'TIMESTAMP WITH TIME ZONE',
  date: 'date',
  json: 'jsonb',
  enum: 'character varying',
  ref: 'integer',
  file: 'character varying',
  computed: 'integer', // computed fields are not stored, but included for type completeness
  'many-to-many': 'integer', // many-to-many is stored in join table, not main table
  // spec-engine-v2: password / secret are plain varchar columns (same as
  // `string` and `file`). Hashing is the auth module's downstream concern.
  // These entries are required for the Record<FieldType, string> to be
  // exhaustive after `password` / `secret` were added to the FieldType union.
  // No behavior change for pre-change field types.
  password: 'character varying(255)',
  secret: 'character varying(255)',
  // PRD 06: pgvector — base type; dimensionality is appended in columnSqlType
  vector: 'vector',
};

/**
 * Generate a pseudo-random TypeORM-style constraint name.
 * TypeORM uses 40-char hashes; we mimic the format for realism.
 */
function constraintName(prefix: string, table: string, column: string): string {
  const seed = `${prefix}_${table}_${column}_${Date.now()}_${Math.random()}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  // Pad to 40 chars to mimic TypeORM's SHA1-style names
  const padded = (hex + '0'.repeat(40)).slice(0, 40);
  return `${prefix}_${padded}`;
}

/**
 * Resolve a `ref` target name to its physical table name.
 *
 * Foundation built-in entities:
 *   - `user` → `"user"` (UserEntity, @Entity({ name: 'user' }))
 *   - `role` → `"role"`
 *   - `file` → `"file"`
 *
 * Spec resources:
 *   - resolved via the resourceMap (e.g. `task` → `ext_tasks_task`)
 *
 * Returns null if the target cannot be resolved (caller skips the FK).
 */
function resolveRefTable(
  ref: string,
  resourceMap: Map<string, ResourceSpec>,
): string | null {
  // Foundation built-ins (lowercase entity names)
  const BUILTIN_ENTITY_TABLES: ReadonlyMap<string, string> = new Map([
    ['user', 'user'],
    ['role', 'role'],
    ['file', 'file'],
    ['session', 'session'],
    ['api_key', 'api_key'],
  ]);
  const builtin = BUILTIN_ENTITY_TABLES.get(ref);
  if (builtin) return builtin;
  const target = resourceMap.get(ref);
  return target?.table ?? null;
}

function primaryKeyConstraintName(table: string): string {
  return constraintName('PK', table, 'id');
}

function uniqueConstraintName(table: string, column: string): string {
  return constraintName('UQ', table, column);
}

function indexName(table: string, column: string): string {
  return constraintName('IDX', table, column);
}

// ─── Column SQL Generation ────────────────────────────────────────────────────

/**
 * Convert a FieldSpec to a SQL column definition fragment (without the name).
 * Returns something like: `character varying(255) NOT NULL`
 */
function columnSqlType(field: FieldSpec): string {
  switch (field.type) {
    case 'string': {
      const len = field.length ?? 255;
      return `character varying(${len})`;
    }
    case 'enum': {
      const len = field.length ?? 255;
      return `character varying(${len})`;
    }
    case 'decimal': {
      const p = field.precision ?? 10;
      const s = field.scale ?? 2;
      return `numeric(${p},${s})`;
    }
    case 'vector': {
      // PRD 06: pgvector — vector(N) column type
      const dims = (field as VectorFieldSpec).dimensions;
      return `vector(${dims})`;
    }
    default:
      return FIELD_TYPE_TO_SQL[field.type] ?? 'character varying(255)';
  }
}

/**
 * Format a SQL DEFAULT literal for a given JS value.
 */
function formatDefault(value: unknown, type: FieldType): string {
  if (value === null || value === undefined) return 'NULL';
  switch (type) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'integer':
    case 'ref':
    case 'decimal':
      return String(value);
    case 'string':
    case 'enum':
    case 'file':
      return `'${String(value).replace(/'/g, "''")}'`;
    case 'text':
      return `'${String(value).replace(/'/g, "''")}'`;
    case 'json':
      return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
    case 'datetime':
    case 'date': {
      const str = String(value).replace(/'/g, "''");
      return `'${str}'`;
    }
    default:
      return `'${String(value).replace(/'/g, "''")}'`;
  }
}

interface ColumnDef {
  name: string;
  sql: string; // full column definition: "name" type [NOT NULL] [DEFAULT ...]
}

/**
 * Build a column definition for a spec field.
 */
function buildColumnDef(field: FieldSpec): ColumnDef {
  const colName = `"${field.name}"`;
  const sqlType = columnSqlType(field);
  const nullable = field.nullable ?? !field.required;
  const nullClause = nullable ? '' : ' NOT NULL';

  let defaultClause = '';
  if (field.default !== undefined) {
    defaultClause = ` DEFAULT ${formatDefault(field.default, field.type)}`;
  }

  return {
    name: field.name,
    sql: `${colName} ${sqlType}${nullClause}${defaultClause}`,
  };
}

/**
 * Build the standard timestamp/soft-delete columns.
 */
function buildAuditColumns(spec: ResourceSpec): ColumnDef[] {
  const cols: ColumnDef[] = [];
  if (spec.timestamps !== false) {
    cols.push({
      name: 'createdAt',
      sql: '"createdAt" TIMESTAMP NOT NULL DEFAULT now()',
    });
    cols.push({
      name: 'updatedAt',
      sql: '"updatedAt" TIMESTAMP NOT NULL DEFAULT now()',
    });
  }
  if (spec.softDelete !== false) {
    cols.push({
      name: 'deletedAt',
      sql: '"deletedAt" TIMESTAMP',
    });
  }
  return cols;
}

// ─── Statement Builders ───────────────────────────────────────────────────────

/**
 * PRD 06: Build a CREATE EXTENSION IF NOT EXISTS vector statement.
 * Returns null when no vector fields are present (caller skips).
 * Idempotent: IF NOT EXISTS allows safe re-runs.
 */
function buildVectorExtensionStatement(
  hasVectorFields: boolean,
): MigrationStatement | null {
  if (!hasVectorFields) return null;
  return {
    up: 'CREATE EXTENSION IF NOT EXISTS vector',
    down: 'DROP EXTENSION IF EXISTS vector',
    description: 'Create pgvector extension',
  };
}

/**
 * PRD 06: Build a CREATE INDEX statement for a vector field.
 * Supports HNSW (default) and IVFFlat index types with cosine ops.
 * Returns null when the field has no index.
 */
function buildVectorIndexStatement(
  spec: ResourceSpec,
  field: VectorFieldSpec,
): MigrationStatement | null {
  if (!field.index) return null;
  const indexType = field.indexType ?? 'hnsw';
  const indexName = `idx_${spec.table}_${field.name}_vector`;
  const ops = 'vector_cosine_ops';

  if (indexType === 'hnsw') {
    const m = field.indexParams?.m ?? 16;
    const efConstruction = field.indexParams?.efConstruction ?? 64;
    return {
      up: `CREATE INDEX "${indexName}" ON "${spec.table}" USING hnsw ("${field.name}" ${ops}) WITH (m = ${m}, ef_construction = ${efConstruction})`,
      down: `DROP INDEX "${indexName}"`,
      description: `Create HNSW vector index on ${spec.table}.${field.name}`,
    };
  }

  // ivfflat
  const lists = field.indexParams?.lists ?? 100;
  return {
    up: `CREATE INDEX "${indexName}" ON "${spec.table}" USING ivfflat ("${field.name}" ${ops}) WITH (lists = ${lists})`,
    down: `DROP INDEX "${indexName}"`,
    description: `Create IVFFlat vector index on ${spec.table}.${field.name}`,
  };
}

/**
 * Build a CREATE TABLE statement (up) + DROP TABLE (down) for a resource.
 *
 * @param spec  The resource spec
 * @param resourceMap  Optional map of all resource specs (for resolving FK
 *   target tables). When provided, `ref` fields emit FOREIGN KEY
 *   constraints and `enum` fields emit CHECK constraints.
 */
function buildCreateTable(
  spec: ResourceSpec,
  resourceMap?: Map<string, ResourceSpec>,
): MigrationStatement {
  const table = `"${spec.table}"`;

  // id column: SERIAL integer PK (matches Foundation convention for extension tables)
  const pkName = primaryKeyConstraintName(spec.table);
  const idCol = `"id" SERIAL NOT NULL`;
  const pkConstraint = `CONSTRAINT "${pkName}" PRIMARY KEY ("id")`;

  const fieldCols = spec.fields.map((f) => buildColumnDef(f));
  const auditCols = buildAuditColumns(spec);

  // Unique constraints
  const uniqueConstraints: string[] = [];
  const uniqueIndices: { name: string; column: string }[] = [];
  for (const f of spec.fields) {
    if (f.unique) {
      const cname = uniqueConstraintName(spec.table, f.name);
      uniqueConstraints.push(`CONSTRAINT "${cname}" UNIQUE ("${f.name}")`);
      uniqueIndices.push({ name: cname, column: f.name });
    }
  }

  // Foreign key constraints for `ref` fields (BUG #7 fix).
  // NOTE: FKs that reference other spec-resource tables (e.g. task-activity →
  // task) are emitted as separate ALTER TABLE statements AFTER all CREATE
  // TABLEs, to avoid ordering issues when the referenced table doesn't exist
  // yet. FKs to Foundation built-ins (user, role, file) are safe inline
  // because those tables already exist. We collect both here and split below.
  const inlineFkConstraints: string[] = [];
  const deferredFkSpecs: Array<{
    column: string;
    targetTable: string;
    onDelete: string;
  }> = [];
  if (resourceMap) {
    for (const f of spec.fields) {
      if (f.type !== 'ref' || !f.ref) continue;
      const targetTable = resolveRefTable(f.ref, resourceMap);
      if (!targetTable) continue;
      const onDelete = f.refOnDelete ?? 'RESTRICT';
      // If the target is a spec-resource table (in resourceMap), defer the FK
      // to an ALTER TABLE after all CREATE TABLEs. Otherwise (Foundation
      // built-in like 'user'), inline is safe.
      if (resourceMap.has(f.ref)) {
        deferredFkSpecs.push({ column: f.name, targetTable, onDelete });
      } else {
        const cname = constraintName('FK', spec.table, f.name);
        inlineFkConstraints.push(
          `CONSTRAINT "${cname}" FOREIGN KEY ("${f.name}") REFERENCES "${targetTable}" ("id") ON DELETE ${onDelete}`,
        );
      }
    }
  }

  // CHECK constraints for `enum` fields (BUG #7 fix)
  const checkConstraints: string[] = [];
  for (const f of spec.fields) {
    if (f.type !== 'enum' || !f.enum || f.enum.length === 0) continue;
    const cname = constraintName('CHK', spec.table, f.name);
    const values = f.enum.map((v) => `'${v}'`).join(', ');
    checkConstraints.push(
      `CONSTRAINT "${cname}" CHECK ("${f.name}" IN (${values}))`,
    );
  }

  const allColumns = [
    idCol,
    ...fieldCols.map((c) => c.sql),
    ...auditCols.map((c) => c.sql),
  ];
  const allConstraints = [
    pkConstraint,
    ...uniqueConstraints,
    ...inlineFkConstraints,
    ...checkConstraints,
  ];
  const columnSql = [...allColumns, ...allConstraints].join(', ');

  const up = `CREATE TABLE ${table} (${columnSql})`;

  // Build index statements (for indexed but non-unique fields)
  const indexStatements: string[] = [];
  for (const f of spec.fields) {
    if (f.index && !f.unique) {
      const iname = indexName(spec.table, f.name);
      indexStatements.push(`CREATE INDEX "${iname}" ON ${table} ("${f.name}")`);
    }
  }
  // Unique fields also get a unique index (TypeORM convention)
  for (const u of uniqueIndices) {
    indexStatements.push(
      `CREATE UNIQUE INDEX "${u.name}" ON ${table} ("${u.column}")`,
    );
  }

  const upFull = [up, ...indexStatements].join(';\n        ');

  // Down: drop indices then table
  const dropIndexStatements = [
    ...uniqueIndices.map((u) => `DROP INDEX "${u.name}"`),
  ];
  for (const f of spec.fields) {
    if (f.index && !f.unique) {
      const iname = indexName(spec.table, f.name);
      dropIndexStatements.push(`DROP INDEX "${iname}"`);
    }
  }
  const downParts = [...dropIndexStatements, `DROP TABLE ${table}`];
  const down = downParts.join(';\n        ');

  return {
    up: upFull,
    down,
    description: `Create table ${spec.table}`,
    deferredFkSpecs,
  };
}

/**
 * Build ALTER TABLE statements that add deferred FOREIGN KEY constraints
 * (FKs between spec-resource tables, emitted after all CREATE TABLEs).
 *
 * Diff-aware: only emits ADD CONSTRAINT for FKs that didn't exist in the
 * previous snapshot. When `previousSnapshot` is undefined (first run / no
 * snapshot stored), every spec-resource FK is emitted — matching the
 * CREATE-TABLE-only behavior for first runs.
 *
 * For existing resources, only FKs on *new* `ref` fields are emitted
 * (added via ALTER TABLE ADD COLUMN in buildAlterTable). FKs on fields
 * that already existed are assumed to have been created in a previous
 * migration — re-emitting them would fail with "constraint already exists".
 */
function buildDeferredFkStatements(
  specs: ResourceSpec[],
  resourceMap: Map<string, ResourceSpec>,
  previousSnapshot?: SpecSnapshot,
): MigrationStatement[] {
  const statements: MigrationStatement[] = [];
  for (const spec of specs) {
    const prevResource = previousSnapshot?.resources[spec.name];
    const prevFieldNames = new Set(
      prevResource?.fields.map((f) => f.name) ?? [],
    );
    for (const f of spec.fields) {
      if (f.type !== 'ref' || !f.ref) continue;
      if (!resourceMap.has(f.ref)) continue; // only spec-resource FKs
      // Skip FKs for fields that already existed in the previous snapshot:
      // they were created in a prior migration, re-emitting would fail.
      if (prevFieldNames.has(f.name)) continue;
      const targetTable = resolveRefTable(f.ref, resourceMap);
      if (!targetTable) continue;
      const cname = constraintName('FK', spec.table, f.name);
      const onDelete = f.refOnDelete ?? 'RESTRICT';
      statements.push({
        up: `ALTER TABLE "${spec.table}" ADD CONSTRAINT "${cname}" FOREIGN KEY ("${f.name}") REFERENCES "${targetTable}" ("id") ON DELETE ${onDelete}`,
        down: `ALTER TABLE "${spec.table}" DROP CONSTRAINT "${cname}"`,
        description: `Add FK ${spec.table}.${f.name} → ${targetTable}`,
      });
    }
  }
  return statements;
}

/**
 * Build ALTER TABLE statements for changed fields between two snapshots.
 */
function buildAlterTable(
  spec: ResourceSpec,
  previous: ResourceSnapshot,
): MigrationStatement[] {
  const statements: MigrationStatement[] = [];
  const table = `"${spec.table}"`;

  const previousFields = new Map(previous.fields.map((f) => [f.name, f]));

  for (const field of spec.fields) {
    const prev = previousFields.get(field.name);
    if (!prev) {
      // New column → ADD COLUMN
      const col = buildColumnDef(field);
      statements.push({
        up: `ALTER TABLE ${table} ADD COLUMN ${col.sql}`,
        down: `ALTER TABLE ${table} DROP COLUMN "${field.name}"`,
        description: `Added field '${field.name}' (${columnSqlType(field)}) to ${spec.table}`,
      });
      continue;
    }

    // Compare type / nullable / default / length / precision / scale
    const newType = columnSqlType(field);
    const oldType = columnSqlType({
      ...field,
      type: prev.type,
      length: prev.length,
      precision: prev.precision,
      scale: prev.scale,
    } as FieldSpec);

    if (newType !== oldType) {
      statements.push({
        up: `ALTER TABLE ${table} ALTER COLUMN "${field.name}" TYPE ${newType}`,
        down: `ALTER TABLE ${table} ALTER COLUMN "${field.name}" TYPE ${oldType}`,
        description: `Changed field '${field.name}' type from ${oldType} to ${newType} in ${spec.table}`,
      });
    }

    const newNullable = field.nullable ?? !field.required;
    if (newNullable !== prev.nullable) {
      if (newNullable) {
        statements.push({
          up: `ALTER TABLE ${table} ALTER COLUMN "${field.name}" DROP NOT NULL`,
          down: `ALTER TABLE ${table} ALTER COLUMN "${field.name}" SET NOT NULL`,
          description: `Changed field '${field.name}' nullable: ${prev.nullable} → true in ${spec.table}`,
        });
      } else {
        statements.push({
          up: `ALTER TABLE ${table} ALTER COLUMN "${field.name}" SET NOT NULL`,
          down: `ALTER TABLE ${table} ALTER COLUMN "${field.name}" DROP NOT NULL`,
          description: `Changed field '${field.name}' nullable: ${prev.nullable} → false in ${spec.table}`,
        });
      }
    }

    // Default change
    const newDefault = field.default;
    const oldDefault = prev.default;
    const newDefaultStr =
      newDefault !== undefined ? formatDefault(newDefault, field.type) : null;
    const oldDefaultStr =
      oldDefault !== undefined ? formatDefault(oldDefault, prev.type) : null;

    if (newDefaultStr !== oldDefaultStr) {
      if (newDefaultStr === null) {
        statements.push({
          up: `ALTER TABLE ${table} ALTER COLUMN "${field.name}" DROP DEFAULT`,
          down: `ALTER TABLE ${table} ALTER COLUMN "${field.name}" SET DEFAULT ${oldDefaultStr}`,
          description: `Dropped default on field '${field.name}' (was ${oldDefaultStr}) in ${spec.table}`,
        });
      } else if (oldDefaultStr === null) {
        statements.push({
          up: `ALTER TABLE ${table} ALTER COLUMN "${field.name}" SET DEFAULT ${newDefaultStr}`,
          down: `ALTER TABLE ${table} ALTER COLUMN "${field.name}" DROP DEFAULT`,
          description: `Set default on field '${field.name}' to ${newDefaultStr} in ${spec.table}`,
        });
      } else {
        statements.push({
          up: `ALTER TABLE ${table} ALTER COLUMN "${field.name}" SET DEFAULT ${newDefaultStr}`,
          down: `ALTER TABLE ${table} ALTER COLUMN "${field.name}" SET DEFAULT ${oldDefaultStr}`,
          description: `Changed default on field '${field.name}' from ${oldDefaultStr} to ${newDefaultStr} in ${spec.table}`,
        });
      }
    }
  }

  // Removed columns
  const currentFieldNames = new Set(spec.fields.map((f) => f.name));
  for (const prevField of previous.fields) {
    if (!currentFieldNames.has(prevField.name)) {
      const col = buildColumnDef(prevField as FieldSpec);
      statements.push({
        up: `ALTER TABLE ${table} DROP COLUMN "${prevField.name}"`,
        down: `ALTER TABLE ${table} ADD COLUMN ${col.sql}`,
        description: `Removed field '${prevField.name}' from ${spec.table}`,
      });
    }
  }

  return statements;
}

// ─── Join Table Helpers ──────────────────────────────────────────────────────

/**
 * Diff join tables between current spec and previous snapshot.
 * Returns CREATE TABLE statements for new join tables and DROP TABLE
 * statements for removed join tables.
 */
function diffJoinTables(
  spec: ResourceSpec,
  previous: ResourceSnapshot | undefined,
): MigrationStatement[] {
  const statements: MigrationStatement[] = [];
  const current = buildJoinTableSnapshots(spec);
  const prev = previous?.joinTables ?? [];

  const prevByName = new Map(prev.map((j) => [j.name, j]));
  const currentByName = new Map(current.map((j) => [j.name, j]));

  for (const j of current) {
    if (!prevByName.has(j.name)) {
      statements.push(buildCreateJoinTable(j));
    }
  }

  for (const j of prev) {
    if (!currentByName.has(j.name)) {
      statements.push({
        up: `DROP TABLE "${j.name}"`,
        down: buildCreateJoinTable(j).up,
        description: `Drop join table ${j.name}`,
      });
    }
  }

  return statements;
}

/**
 * Build a CREATE TABLE migration for a join table with composite PK + FKs.
 */
function buildCreateJoinTable(j: JoinTableSnapshot): MigrationStatement {
  const table = `"${j.name}"`;
  const fromCol = `"${j.fromColumn}"`;
  const toCol = `"${j.toColumn}"`;
  const pkName = primaryKeyConstraintName(j.name);

  const up =
    `CREATE TABLE ${table} (` +
    `${fromCol} integer NOT NULL, ` +
    `${toCol} integer NOT NULL, ` +
    `CONSTRAINT "${pkName}" PRIMARY KEY (${fromCol}, ${toCol})` +
    `)`;

  const down = `DROP TABLE ${table}`;

  return {
    up,
    down,
    description: `Create join table ${j.name}`,
  };
}

// ─── Snapshot Helpers ────────────────────────────────────────────────────────

/**
 * Build a ResourceSnapshot from a ResourceSpec (for diffing / storage).
 */
export function buildSnapshot(spec: ResourceSpec): ResourceSnapshot {
  return {
    table: spec.table,
    fields: spec.fields.map((f) => ({
      name: f.name,
      type: f.type,
      nullable: f.nullable ?? !f.required,
      unique: !!f.unique,
      default: f.default,
      length: f.length,
      precision: f.precision,
      scale: f.scale,
      enum: f.enum,
      // PRD 06: pgvector — persist vector-specific metadata for diffing
      ...(f.type === 'vector'
        ? {
            dimensions: (f as VectorFieldSpec).dimensions,
            indexType: (f as VectorFieldSpec).indexType,
          }
        : {}),
    })),
    timestamps: spec.timestamps !== false,
    softDelete: spec.softDelete !== false,
    indices: spec.fields.filter((f) => f.index).map((f) => f.name),
    uniques: spec.fields.filter((f) => f.unique).map((f) => f.name),
    joinTables: buildJoinTableSnapshots(spec),
    realtime: spec.realtime,
  };
}

/**
 * Build join table snapshots from many-to-many fields.
 * Uses the shared joinTableName helper so snapshot names always match the
 * materialized EntitySchema (no doubled ext_ prefix). The extension name is
 * derived from the spec (spec.name) — same value EntityFactory receives.
 */
function buildJoinTableSnapshots(spec: ResourceSpec): JoinTableSnapshot[] {
  const snapshots: JoinTableSnapshot[] = [];
  for (const f of spec.fields) {
    if (f.type !== 'many-to-many' || !f.ref) continue;
    const fromCol = f.throughFields?.from ?? `${spec.name}Id`;
    const toCol = f.throughFields?.to ?? `${f.name.replace(/Id$/, '')}Id`;
    snapshots.push({
      name: joinTableName(spec.name, spec, f),
      fromColumn: fromCol,
      toColumn: toCol,
      fromResource: spec.name,
      toResource: f.ref,
    });
  }
  return snapshots;
}

/**
 * Build a full SpecSnapshot from an ExtensionSpec.
 */
export function buildExtensionSnapshot(spec: ExtensionSpec): SpecSnapshot {
  const resources: Record<string, ResourceSnapshot> = {};
  for (const res of spec.resources) {
    resources[res.name] = buildSnapshot(res);
  }
  return {
    extensionName: spec.name,
    version: spec.version,
    resources,
  };
}

// ─── Migration File Rendering ─────────────────────────────────────────────────

/**
 * Generate the .ts migration file content.
 */
function renderMigrationFile(
  className: string,
  statements: MigrationStatement[],
): string {
  const upLines = statements.map(
    (s) => `        await queryRunner.query(\`${s.up};\`);`,
  );
  const downLines = statements
    .slice()
    .reverse()
    .map((s) => `        await queryRunner.query(\`${s.down};\`);`);

  return `import { MigrationInterface, QueryRunner } from 'typeorm';

export class ${className} implements MigrationInterface {
    name = '${className}'

    public async up(queryRunner: QueryRunner): Promise<void> {
${upLines.join('\n')}
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
${downLines.join('\n')}
    }
}
`;
}

/**
 * Convert a string to PascalCase, stripping non-alphanumeric chars.
 */
function pascalCase(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

/**
 * Generate a TypeORM migration timestamp (YYYYMMDDHHMMSSsss-style 13-digit number).
 */
function generateTimestamp(): string {
  return String(Date.now());
}

// ─── Spec Loading ────────────────────────────────────────────────────────────

/**
 * Find and read the merged spec for an extension.
 *
 * Uses `SpecLoader.load` which globs every `*.spec.yaml` in the extension dir
 * (and immediate subdirectories) and merges split-spec files into a single
 * ExtensionSpec via `mergeSpecs`. This fixes BUG #7: previously `readSpecFile`
 * only read `files[0]`, so only the first spec file's resources became tables.
 */
export function readSpecFile(
  extensionName: string,
  extensionsDir: string,
): ExtensionSpec {
  const loadedSpecs = SpecLoader.load(extensionsDir);
  const found = loadedSpecs.find((l) => l.spec.name === extensionName);
  if (!found) {
    throw new Error(
      `Extension "${extensionName}" not found in ${extensionsDir}` +
        ` (loaded: ${loadedSpecs.map((l) => l.spec.name).join(', ') || 'none'})`,
    );
  }
  return found.spec;
}

// ─── Main Generator ──────────────────────────────────────────────────────────

export interface GenerateOptions {
  /**
   * Previous spec snapshot (from spec_schema_version table). If not provided,
   * all resources are treated as new (CREATE TABLE only).
   */
  previousSnapshot?: SpecSnapshot;
}

export class MigrationGenerator {
  /**
   * Generate a TypeORM migration .ts file for an extension's spec.
   *
   * @param extensionName Name of the extension (subdirectory under extensionsDir)
   * @param extensionsDir Absolute path to the extensions/ directory
   * @param migrationsDir Absolute path to the migrations output directory
   * @param options Optional: previous snapshot for diffing
   * @returns Generation result with metadata about what was generated
   */
  static async generate(
    extensionName: string,
    extensionsDir: string,
    migrationsDir: string,
    options?: GenerateOptions,
  ): Promise<GenerationResult> {
    const spec = readSpecFile(extensionName, extensionsDir);
    const previous = options?.previousSnapshot;

    // Build a resource name → ResourceSpec map so buildCreateTable can
    // resolve `ref` targets to physical table names for FOREIGN KEY
    // constraints (BUG #7 fix).
    const resourceMap = new Map<string, ResourceSpec>();
    for (const res of spec.resources) {
      resourceMap.set(res.name, res);
    }

    const statements: MigrationStatement[] = [];
    const createdTables: string[] = [];
    const alteredTables: string[] = [];

    // PRD 06: pgvector — emit CREATE EXTENSION IF NOT EXISTS vector as the
    // very first statement when any resource has a vector field. This must
    // run before any CREATE TABLE / ADD COLUMN that references the vector type.
    const hasVectorFields = spec.resources.some((r) =>
      r.fields.some((f) => f.type === 'vector'),
    );
    const extStmt = buildVectorExtensionStatement(hasVectorFields);
    if (extStmt) {
      statements.push(extStmt);
      this.log(`🔌 ${extStmt.description}`);
    }

    for (const resource of spec.resources) {
      const prevResource = previous?.resources[resource.name];

      if (!prevResource) {
        // New resource → CREATE TABLE
        const stmt = buildCreateTable(resource, resourceMap);
        statements.push(stmt);
        createdTables.push(resource.table);
        this.log(
          `✅ CREATE TABLE "${resource.table}" (${resource.fields.length} fields)`,
        );
      } else {
        // Existing resource → ALTER TABLE for changes
        const alters = buildAlterTable(resource, prevResource);
        if (alters.length > 0) {
          statements.push(...alters);
          alteredTables.push(resource.table);
          for (const a of alters) {
            this.log(`  🔧 ${a.description}`);
          }
        } else {
          this.log(`  ⏭️  No changes for "${resource.table}"`);
        }
      }

      // Diff join tables for many-to-many fields
      const joinChanges = diffJoinTables(resource, prevResource);
      statements.push(...joinChanges);
      for (const change of joinChanges) {
        if (change.description.startsWith('Create join table')) {
          createdTables.push(
            change.description.replace('Create join table ', ''),
          );
        }
        this.log(`  🔗 ${change.description}`);
      }

      // PRD 06: pgvector — emit HNSW/IVFFlat index for vector fields with
      // index: true. Emitted after CREATE TABLE so the column exists.
      for (const field of resource.fields) {
        if (field.type !== 'vector') continue;
        const vecField = field as VectorFieldSpec;
        const idxStmt = buildVectorIndexStatement(resource, vecField);
        if (idxStmt) {
          statements.push(idxStmt);
          this.log(`  📐 ${idxStmt.description}`);
        }
      }
    }

    // After all CREATE TABLEs, emit deferred FK constraints (ALTER TABLE
    // ADD CONSTRAINT) for FKs between spec-resource tables. This avoids
    // ordering issues when a referenced table is created later in the loop.
    // Diff-aware: only FKs absent from the previous snapshot are emitted,
    // so existing FKs are not re-added (would fail with "constraint already
    // exists"). On first run (no snapshot) every spec-resource FK is emitted.
    const deferredFkStatements = buildDeferredFkStatements(
      spec.resources,
      resourceMap,
      previous,
    );
    for (const fkStmt of deferredFkStatements) {
      statements.push(fkStmt);
      this.log(`  🔗 ${fkStmt.description}`);
    }

    // Realtime triggers (PRD 05): emit CREATE/DROP trigger statements
    // diff-aware against the previous snapshot's realtime config.
    const realtimeStatements = this.buildRealtimeStatements(
      spec.resources,
      previous,
    );
    for (const rtStmt of realtimeStatements) {
      statements.push(rtStmt);
      this.log(`  📡 ${rtStmt.description}`);
    }

    if (statements.length === 0) {
      this.log('ℹ️  No migration statements generated — spec unchanged.');
      // Still produce an empty migration for record-keeping? No — skip.
      return {
        migrationFileName: '',
        migrationClassName: '',
        timestamp: '',
        statements: [],
        createdTables,
        alteredTables,
      };
    }

    // Build migration file name and class name
    const timestamp = generateTimestamp();
    const descriptionParts: string[] = [];
    if (createdTables.length > 0) {
      descriptionParts.push(`Create${createdTables.length}Tables`);
    }
    if (alteredTables.length > 0) {
      descriptionParts.push(`Alter${alteredTables.length}Tables`);
    }
    const description = descriptionParts.join('') || 'SchemaUpdate';
    const extPascal = pascalCase(extensionName);
    const migrationClassName = `Spec${extPascal}${description}${timestamp}`;
    const migrationFileName = `${timestamp}-Spec${extPascal}${description}.ts`;

    // Ensure migrations dir exists
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }

    const content = renderMigrationFile(migrationClassName, statements);
    const outPath = path.join(migrationsDir, migrationFileName);
    fs.writeFileSync(outPath, content, 'utf-8');

    this.log(`\n📝 Migration file written: ${outPath}`);
    this.log(`   Class: ${migrationClassName}`);
    this.log(`   Statements: ${statements.length}`);
    this.log(`   Tables created: ${createdTables.length}`);
    this.log(`   Tables altered: ${alteredTables.length}`);

    return {
      migrationFileName,
      migrationClassName,
      timestamp,
      statements,
      createdTables,
      alteredTables,
    };
  }

  /**
   * Console logger (overridable for testing).
   */
  protected static log(message: string): void {
    // eslint-disable-next-line no-console
    console.log(`[MigrationGenerator] ${message}`);
  }

  /**
   * Build CREATE/DROP trigger statements for realtime resources, diff-aware
   * against the previous snapshot.
   */
  protected static buildRealtimeStatements(
    resources: ResourceSpec[],
    previous?: SpecSnapshot,
  ): MigrationStatement[] {
    const statements: MigrationStatement[] = [];
    for (const resource of resources) {
      const prevRealtime = previous?.resources[resource.name]?.realtime;
      const currRealtime = resource.realtime;

      if (currRealtime && !prevRealtime) {
        statements.push(...TriggerFactory.create(resource));
      } else if (!currRealtime && prevRealtime) {
        statements.push(...TriggerFactory.drop(resource, prevRealtime));
      } else if (currRealtime && prevRealtime) {
        if (JSON.stringify(currRealtime) !== JSON.stringify(prevRealtime)) {
          statements.push(...TriggerFactory.drop(resource, prevRealtime));
          statements.push(...TriggerFactory.create(resource));
        }
      }
    }
    return statements;
  }
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

/**
 * Snapshot persistence — stores the spec snapshot in the
 * `spec_schema_snapshots` table so the next migration generation can diff
 * against it and produce ALTER TABLE statements instead of CREATE TABLE.
 *
 * The table is created by migration `CreateSpecSchemaSnapshotsTable`. If the
 * table doesn't exist yet (first run before that migration), these functions
 * fail gracefully (return null / log a warning) so the generator still works
 * in CREATE-only mode.
 */
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Build a database connection from the .env file (same as TypeORM CLI).
export function getDataSource(): DataSource {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
  return new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USERNAME ?? 'dev',
    password: process.env.DATABASE_PASSWORD ?? 'dev123',
    database: process.env.DATABASE_NAME ?? 'foundation',
    entities: [],
    migrations: [],
  });
}

/**
 * Read the previous snapshot for an extension from the DB.
 * Returns null if the table doesn't exist or no snapshot is stored.
 */
export async function readSnapshotFromDb(
  ds: DataSource,
  extensionName: string,
): Promise<SpecSnapshot | null> {
  try {
    const res = await ds.query(
      `SELECT snapshot FROM "spec_schema_snapshots" WHERE "extension_name" = $1 LIMIT 1`,
      [extensionName],
    );
    if (res && res.length > 0 && res[0].snapshot) {
      return typeof res[0].snapshot === 'string'
        ? JSON.parse(res[0].snapshot)
        : res[0].snapshot;
    }
    return null;
  } catch {
    // Table doesn't exist yet — first run, no snapshot. That's fine.
    return null;
  }
}

/**
 * Persist the current spec snapshot to the DB (upsert by extension name).
 * Called after a successful migration generation so the next run can diff.
 */
export async function writeSnapshotToDb(
  ds: DataSource,
  snapshot: SpecSnapshot,
): Promise<void> {
  try {
    await ds.query(
      `INSERT INTO "spec_schema_snapshots" ("extension_name", "snapshot", "created_at", "updated_at")
       VALUES ($1, $2, now(), now())
       ON CONFLICT ("extension_name")
       DO UPDATE SET "snapshot" = $2, "updated_at" = now()`,
      [snapshot.extensionName, JSON.stringify(snapshot)],
    );
  } catch (err) {
    // Table doesn't exist or DB not reachable — warn but don't fail.

    console.warn(
      `[MigrationGenerator] Could not persist snapshot: ${(err as Error).message} — ` +
        'run the CreateSpecSchemaSnapshotsTable migration first.',
    );
  }
}

/**
 * Build a full SpecSnapshot from the current spec file (in-memory).
 * Wraps the existing `buildExtensionSnapshot` for CLI use.
 */
export function buildFullSnapshot(
  extensionName: string,
  spec: ExtensionSpec,
): SpecSnapshot {
  return buildExtensionSnapshot(spec);
}

/**
 * Run from CLI: ts-node migration-generator.ts <extensionName> [extensionsDir] [migrationsDir]
 *
 * Defaults:
 *   extensionsDir  = <cwd>/src/extensions
 *   migrationsDir  = <cwd>/src/infrastructure/database/migrations
 *
 * Snapshot diffing is automatic: reads the previous snapshot from the
 * `spec_schema_snapshots` DB table, generates ALTER TABLE for changed
 * resources + CREATE TABLE for new ones, then persists the new snapshot.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error(
      'Usage: ts-node migration-generator.ts <extensionName> [extensionsDir] [migrationsDir]',
    );
    process.exit(1);
  }

  const extensionName = args[0];
  const extensionsDir =
    args[1] ?? path.resolve(process.cwd(), 'src/extensions');
  const migrationsDir =
    args[2] ??
    path.resolve(process.cwd(), 'src/infrastructure/database/migrations');

  // Read the previous snapshot from the DB (for diffing).
  const ds = getDataSource();
  await ds.initialize();
  let previousSnapshot: SpecSnapshot | undefined;
  try {
    const prev = await readSnapshotFromDb(ds, extensionName);
    if (prev) {
      // eslint-disable-next-line no-console
      console.log(
        `[MigrationGenerator] Found previous snapshot for "${extensionName}" (version ${prev.version}).`,
      );
      previousSnapshot = prev;
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `[MigrationGenerator] No previous snapshot — generating CREATE TABLE for all resources.`,
      );
    }
  } catch (err) {
    console.warn(
      `[MigrationGenerator] Could not read snapshot: ${(err as Error).message} — treating as first run.`,
    );
  }

  // Generate with the previous snapshot (enables ALTER TABLE diffs).
  const result = await MigrationGenerator.generate(
    extensionName,
    extensionsDir,
    migrationsDir,
    { previousSnapshot },
  );
  // eslint-disable-next-line no-console
  console.log(`\n✅ Done. Generated ${result.statements.length} statements.`);

  // Persist the new snapshot ONLY if --save-snapshot flag is passed.
  // This separates generation from snapshot persistence: the user generates
  // the migration, runs it, then saves the snapshot. Otherwise the snapshot
  // would be updated before the migration runs, and the next generation
  // would not detect any diff (the snapshot already matches the spec).
  const saveSnapshot = args.includes('--save-snapshot');
  if (saveSnapshot) {
    const spec = readSpecFile(extensionName, extensionsDir);
    const newSnapshot = buildFullSnapshot(extensionName, spec);
    await writeSnapshotToDb(ds, newSnapshot);
    // eslint-disable-next-line no-console
    console.log(
      `[MigrationGenerator] Persisted snapshot for "${extensionName}" (version ${newSnapshot.version}).`,
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(
      `[MigrationGenerator] Snapshot NOT saved. Run with --save-snapshot after migrating, ` +
        `or run \`pnpm spec:snapshot-save ${extensionName}\`.`,
    );
  }

  await ds.destroy();
}

// Run main only when executed directly (not when imported)
if (require.main === module) {
  main();
}
