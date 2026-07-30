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
} from './spec.types';

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
  }>;
  timestamps: boolean;
  softDelete: boolean;
  indices: string[];
  uniques: string[];
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
    case 'date':
      return `'${String(value)}'`;
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
 * Build a CREATE TABLE statement (up) + DROP TABLE (down) for a resource.
 */
function buildCreateTable(spec: ResourceSpec): MigrationStatement {
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

  const allColumns = [idCol, ...fieldCols.map((c) => c.sql), ...auditCols.map((c) => c.sql)];
  const allConstraints = [pkConstraint, ...uniqueConstraints];
  const columnSql = [...allColumns, ...allConstraints].join(', ');

  const up = `CREATE TABLE ${table} (${columnSql})`;

  // Build index statements (for indexed but non-unique fields)
  const indexStatements: string[] = [];
  for (const f of spec.fields) {
    if (f.index && !f.unique) {
      const iname = indexName(spec.table, f.name);
      indexStatements.push(
        `CREATE INDEX "${iname}" ON ${table} ("${f.name}")`,
      );
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
  const dropIndexStatements = [...uniqueIndices.map((u) => `DROP INDEX "${u.name}"`)];
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
  };
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
        description: `Add column ${field.name} to ${spec.table}`,
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
        description: `Change column ${field.name} type in ${spec.table}`,
      });
    }

    const newNullable = field.nullable ?? !field.required;
    if (newNullable !== prev.nullable) {
      if (newNullable) {
        statements.push({
          up: `ALTER TABLE ${table} ALTER COLUMN "${field.name}" DROP NOT NULL`,
          down: `ALTER TABLE ${table} ALTER COLUMN "${field.name}" SET NOT NULL`,
          description: `Make column ${field.name} nullable in ${spec.table}`,
        });
      } else {
        statements.push({
          up: `ALTER TABLE ${table} ALTER COLUMN "${field.name}" SET NOT NULL`,
          down: `ALTER TABLE ${table} ALTER COLUMN "${field.name}" DROP NOT NULL`,
          description: `Make column ${field.name} non-nullable in ${spec.table}`,
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
          description: `Drop default on column ${field.name} in ${spec.table}`,
        });
      } else if (oldDefaultStr === null) {
        statements.push({
          up: `ALTER TABLE ${table} ALTER COLUMN "${field.name}" SET DEFAULT ${newDefaultStr}`,
          down: `ALTER TABLE ${table} ALTER COLUMN "${field.name}" DROP DEFAULT`,
          description: `Set default on column ${field.name} in ${spec.table}`,
        });
      } else {
        statements.push({
          up: `ALTER TABLE ${table} ALTER COLUMN "${field.name}" SET DEFAULT ${newDefaultStr}`,
          down: `ALTER TABLE ${table} ALTER COLUMN "${field.name}" SET DEFAULT ${oldDefaultStr}`,
          description: `Change default on column ${field.name} in ${spec.table}`,
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
        description: `Drop column ${prevField.name} from ${spec.table}`,
      });
    }
  }

  return statements;
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
    })),
    timestamps: spec.timestamps !== false,
    softDelete: spec.softDelete !== false,
    indices: spec.fields.filter((f) => f.index).map((f) => f.name),
    uniques: spec.fields.filter((f) => f.unique).map((f) => f.name),
  };
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
 * Find and read the .spec.yaml file for an extension.
 */
function readSpecFile(extensionName: string, extensionsDir: string): ExtensionSpec {
  const extDir = path.join(extensionsDir, extensionName);
  if (!fs.existsSync(extDir)) {
    throw new Error(`Extension directory not found: ${extDir}`);
  }

  const files = fs
    .readdirSync(extDir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.spec.yaml'))
    .map((d) => path.join(extDir, d.name));

  if (files.length === 0) {
    throw new Error(`No .spec.yaml file found in ${extDir}`);
  }

  const raw = fs.readFileSync(files[0], 'utf-8');
  const spec = yaml.load(raw) as ExtensionSpec;
  if (!spec || !spec.name || !Array.isArray(spec.resources)) {
    throw new Error(`Invalid spec in ${files[0]}: missing name or resources`);
  }
  return spec;
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

    const statements: MigrationStatement[] = [];
    const createdTables: string[] = [];
    const alteredTables: string[] = [];

    for (const resource of spec.resources) {
      const prevResource = previous?.resources[resource.name];

      if (!prevResource) {
        // New resource → CREATE TABLE
        const stmt = buildCreateTable(resource);
        statements.push(stmt);
        createdTables.push(resource.table);
        this.log(`✅ CREATE TABLE "${resource.table}" (${resource.fields.length} fields)`);
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
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

/**
 * Run from CLI: ts-node migration-generator.ts <extensionName> [extensionsDir] [migrationsDir]
 *
 * Defaults:
 *   extensionsDir  = <cwd>/extensions
 *   migrationsDir  = <cwd>/src/infrastructure/database/migrations
 */
function main(): void {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    // eslint-disable-next-line no-console
    console.error(
      'Usage: ts-node migration-generator.ts <extensionName> [extensionsDir] [migrationsDir]',
    );
    process.exit(1);
  }

  const extensionName = args[0];
  const extensionsDir =
    args[1] ?? path.resolve(process.cwd(), 'extensions');
  const migrationsDir =
    args[2] ?? path.resolve(process.cwd(), 'src/infrastructure/database/migrations');

  MigrationGenerator.generate(extensionName, extensionsDir, migrationsDir)
    .then((result) => {
      // eslint-disable-next-line no-console
      console.log(`\n✅ Done. Generated ${result.statements.length} statements.`);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`\n❌ Migration generation failed: ${(err as Error).message}`);
      process.exit(1);
    });
}

// Run main only when executed directly (not when imported)
if (require.main === module) {
  main();
}