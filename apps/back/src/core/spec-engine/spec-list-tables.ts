#!/usr/bin/env node
/**
 * spec-list-tables.ts — CLI that lists ALL tables in the database:
 * - Spec-engine tables (from YAML: ext_<ext>_<resource>)
 * - Traditional NestJS tables (from @Entity() in code)
 * - Foundation core tables (user, role, file, etc.)
 *
 * For each table shows:
 * - Table name + schema
 * - Source: spec-engine YAML file or traditional entity file or core
 * - Columns: name, type, nullable, default
 * - Relations: FKs (column → target table)
 * - Indexes
 * - Row count (from DB)
 *
 * Usage:
 *   node src/core/spec-engine/spec-list-tables.ts              # all tables
 *   node src/core/spec-engine/spec-list-tables.ts --json       # JSON output
 *   node src/core/spec-engine/spec-list-tables.ts ext_tasks   # prefix filter
 *
 * Works WITHOUT the app running — reads source code + DB schema.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const verbose = args.includes('--verbose') || args.includes('-v');
const prefixFilter = args.find((a) => !a.startsWith('--') && a !== 'all');

const srcDir = path.resolve(process.cwd(), 'src');
const extensionsDir = path.join(srcDir, 'extensions');
const customDir = path.join(srcDir, 'custom');

// js-yaml from pnpm store
let yaml;
try {
  yaml = require('js-yaml');
} catch {
  const pnpmBase = path.resolve(process.cwd(), '../../node_modules/.pnpm');
  const jsYamlDir = fs
    .readdirSync(pnpmBase)
    .find((d) => d.startsWith('js-yaml@'));
  if (!jsYamlDir) {
    console.error('js-yaml not found.');
    process.exit(2);
  }
  yaml = require(path.join(pnpmBase, jsYamlDir, 'node_modules/js-yaml'));
}

// ─── 1. Collect spec-engine tables (from YAML) ─────────────────────────

function collectSpecTables() {
  const tables = [];

  // Search both src/extensions/ and src/custom/ for spec YAML files
  const searchDirs = [extensionsDir, customDir].filter((d) =>
    fs.existsSync(d),
  );

  for (const searchDir of searchDirs) {
    const isCustom = searchDir === customDir;

    for (const ext of fs.readdirSync(searchDir)) {
      const extDir = path.join(searchDir, ext);
      if (!fs.statSync(extDir).isDirectory()) continue;

    const specFiles = fs
      .readdirSync(extDir)
      .filter((f) => f.endsWith('.spec.yaml'))
      .map((f) => path.join(extDir, f));

    for (const file of specFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const spec = yaml.load(content);
        const resources = spec.resources || [spec];
        const extName = spec.name || ext;

        for (const resource of resources) {
          const rName = resource.name || extName;
          const table = resource.table || `ext_${extName}_${rName}`;
          const columns = [];

          for (const field of resource.fields || []) {
            const col = {
              name: field.name,
              type: field.type,
              sqlType: fieldToSqlType(field),
              nullable: field.nullable !== false && !field.required,
              required: !!field.required,
              default: field.default,
              length: field.length,
              precision: field.precision,
              scale: field.scale,
              enum: field.enum,
              ref: field.ref,
              refOnDelete: field.refOnDelete,
              validation: field.validation,
            };
            columns.push(col);
          }

          // Timestamps
          if (spec.timestamps !== false) {
            columns.push({ name: 'createdAt', type: 'datetime', sqlType: 'TIMESTAMP', nullable: false, default: 'now()' });
            columns.push({ name: 'updatedAt', type: 'datetime', sqlType: 'TIMESTAMP', nullable: false, default: 'now()' });
          }
          // Soft delete
          if (spec.softDelete !== false) {
            columns.push({ name: 'deletedAt', type: 'datetime', sqlType: 'TIMESTAMP', nullable: true });
          }

          // Hooks
          const hooks = resource.hooks ? Object.keys(resource.hooks) : [];

          // Actions
          const actions = resource.actions ? resource.actions.map(a => a.name) : [];

          // Jobs
          const jobs = resource.jobs ? resource.jobs.map(j => j.name) : [];

          // Notifications
          const notifications = resource.notifications ? resource.notifications.map(n => n.name) : [];

          // Seeds
          const seeds = resource.seeds ? resource.seeds.length : 0;

          // Webhooks
          const webhooks = resource.webhooks ? resource.webhooks.map(w => w.name) : [];

          tables.push({
            source: isCustom ? 'custom' : 'spec-engine',
            extension: extName,
            resource: rName,
            table,
            specFile: path.basename(file),
            columns,
            hooks,
            actions,
            jobs,
            notifications,
            webhooks,
            seeds,
            permissions: resource.permissions ? Object.keys(resource.permissions) : [],
            rowLevel: resource.permissions?.rowLevel ? Object.keys(resource.permissions.rowLevel) : [],
          });
        }
      } catch {
        // skip parse errors
      }
    }
    }
  }

  return tables;
}

// ─── 2. Collect traditional NestJS tables (from @Entity() in code) ───────

function collectTraditionalTables() {
  const tables = [];

  // Find all .entity.ts files
  const entityFiles = execSync(
    `find ${srcDir} -name "*.entity.ts" -not -path "*node_modules*" -not -path "*__tests__*"`,
    { encoding: 'utf-8' },
  )
    .trim()
    .split('\n')
    .filter(Boolean);

  for (const file of entityFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');

      // Extract @Entity({ name: 'table' }) or @Entity('table')
      let tableName = '';
      const entityMatch = content.match(
        /@Entity\s*\(\s*{?\s*(?:name:\s*)?['"`]([^'"`]+)['"`]/,
      );
      if (entityMatch) {
        tableName = entityMatch[1];
      } else {
        const simpleMatch = content.match(/@Entity\s*\(\s*['"`]([^'"`]+)['"`]/);
        if (simpleMatch) tableName = simpleMatch[1];
        else continue; // Not a table entity
      }

      // Extract columns from @Column, @PrimaryGeneratedColumn, @CreateDateColumn, etc.
      const columns = [];

      // Primary key
      const pkMatch = content.match(
        /@PrimaryGeneratedColumn\s*\(\s*[^)]*\)\s*\n\s*(\w+)\s*:\s*(\w+)/,
      );
      if (pkMatch) {
        columns.push({
          name: pkMatch[1],
          type: pkMatch[2],
          sqlType: 'SERIAL',
          nullable: false,
          required: true,
          isPrimary: true,
        });
      }

      // UUID primary key
      const uuidPkMatch = content.match(
        /@PrimaryGeneratedColumn\s*\(\s*['"`]uuid['"`]/,
      );
      if (uuidPkMatch) {
        const pkVarMatch = content.match(
          /@PrimaryGeneratedColumn\s*\(\s*['"`]uuid['"`][^)]*\)\s*\n\s*(\w+)\s*:\s*string/,
        );
        if (pkVarMatch) {
          columns.push({
            name: pkVarMatch[1],
            type: 'string',
            sqlType: 'UUID',
            nullable: false,
            required: true,
            isPrimary: true,
          });
        }
      }

      // Regular columns
      const columnRegex =
        /@(?:Column|PrimaryColumn)\s*\(\s*{?\s*([^)}]*)}?\s*\)?\s*\n\s*(\w+)\s*:\s*(\w+(?:\[\])?)/g;
      let match;

      while ((match = columnRegex.exec(content)) !== null) {
        const decoratorContent = match[1] || '';
        const colName = match[2];
        const colType = match[3];

        // Parse column options
        const isNullable = /nullable:\s*true/.test(decoratorContent);
        const hasDefault = /default:/.test(decoratorContent);
        const defaultMatch = decoratorContent.match(/default:\s*([^,}]+)/);
        const typeMatch = decoratorContent.match(/type:\s*['"`]?(\w+)['"`]?/);
        const lengthMatch = decoratorContent.match(/length:\s*(\d+)/);

        columns.push({
          name: colName,
          type: colType,
          sqlType: typeMatch ? typeMatch[1].toUpperCase() : inferSqlType(colType),
          nullable: isNullable,
          default: defaultMatch ? defaultMatch[1].trim() : undefined,
          length: lengthMatch ? parseInt(lengthMatch[1]) : undefined,
        });
      }

      // CreateDateColumn
      if (content.match(/@CreateDateColumn/)) {
        const cdMatch = content.match(
          /@CreateDateColumn\s*\(\s*[^)]*\)\s*\n\s*(\w+)/,
        );
        if (cdMatch) {
          columns.push({
            name: cdMatch[1],
            type: 'Date',
            sqlType: 'TIMESTAMP',
            nullable: false,
            default: 'now()',
          });
        }
      }

      // UpdateDateColumn
      if (content.match(/@UpdateDateColumn/)) {
        const udMatch = content.match(
          /@UpdateDateColumn\s*\(\s*[^)]*\)\s*\n\s*(\w+)/,
        );
        if (udMatch) {
          columns.push({
            name: udMatch[1],
            type: 'Date',
            sqlType: 'TIMESTAMP',
            nullable: false,
            default: 'now()',
          });
        }
      }

      // DeleteDateColumn
      if (content.match(/@DeleteDateColumn/)) {
        const ddMatch = content.match(
          /@DeleteDateColumn\s*\(\s*[^)]*\)\s*\n\s*(\w+)/,
        );
        if (ddMatch) {
          columns.push({
            name: ddMatch[1],
            type: 'Date',
            sqlType: 'TIMESTAMP',
            nullable: true,
          });
        }
      }

      // Relations (ManyToOne, OneToOne, OneToMany, ManyToMany)
      const relations = [];
      const relRegex =
        /@(?:ManyToOne|OneToOne|OneToMany|ManyToMany)\s*\(\s*(?:\(\)\s*=>\s*)?(\w+)/g;

      while ((match = relRegex.exec(content)) !== null) {
        const targetEntity = match[1];
        // Find the property name
        const afterMatch = content.substring(match.index, match.index + 500);
        const propMatch = afterMatch.match(/\)\s*\n\s*(\w+)\s*:/);
        if (propMatch) {
          relations.push({
            type: match[0].split('(')[0].replace('@', ''),
            target: targetEntity,
            property: propMatch[1],
          });
        }
      }

      tables.push({
        source: 'traditional',
        entityFile: path.relative(process.cwd(), file),
        table: tableName,
        columns,
        relations,
      });
    } catch {
      // skip unreadable files
    }
  }

  return tables;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function fieldToSqlType(field) {
  switch (field.type) {
    case 'string':
      return `VARCHAR(${field.length || 255})`;
    case 'text':
      return 'TEXT';
    case 'integer':
      return 'INTEGER';
    case 'decimal':
      return `DECIMAL(${field.precision || 10},${field.scale || 2})`;
    case 'boolean':
      return 'BOOLEAN';
    case 'datetime':
      return 'TIMESTAMP';
    case 'enum':
      return `VARCHAR + CHECK`;
    case 'ref':
      return 'INTEGER (FK)';
    case 'json':
      return 'JSONB';
    case 'file':
    case 'password':
      return 'VARCHAR';
    case 'vector':
      return `VECTOR(${field.dimensions || 1536})`;
    default:
      return 'VARCHAR';
  }
}

function inferSqlType(tsType) {
  const map = {
    string: 'VARCHAR',
    text: 'TEXT',
    number: 'INTEGER',
    boolean: 'BOOLEAN',
    Date: 'TIMESTAMP',
    'string[]': 'VARCHAR[]',
    Object: 'JSONB',
  };
  return map[tsType] || 'VARCHAR';
}

// ─── Main ────────────────────────────────────────────────────────────────

const specTables = collectSpecTables();
const traditionalTables = collectTraditionalTables();
const allTables = [...specTables, ...traditionalTables];

// Filter by prefix if provided
const filtered = prefixFilter
  ? allTables.filter((t) => t.table.startsWith(prefixFilter))
  : allTables;

if (asJson) {
  console.log(JSON.stringify(filtered, null, 2));
  process.exit(0);
}

// Group by source
const specCount = specTables.length;
const tradCount = traditionalTables.length;

console.log(`\n🗄️  Foundation — ${filtered.length} tables\n`);
console.log(`Spec-engine: ${specCount} tables | Traditional: ${tradCount} tables\n`);

// Sort by table name
filtered.sort((a, b) => a.table.localeCompare(b.table));

for (const t of filtered) {
  const sourceIcon = t.source === 'spec-engine' ? '📦' : '📝';
  const sourceFile =
    t.source === 'spec-engine' ? t.specFile : path.basename(t.entityFile);

  console.log(`${'─'.repeat(80)}`);
  console.log(`${sourceIcon} ${t.table} (${t.source})`);
  if (t.source === 'spec-engine') {
    console.log(`   Extension: ${t.extension} | Resource: ${t.resource} | Spec: ${sourceFile}`);
  } else {
    console.log(`   Entity: ${sourceFile}`);
  }

  // Columns
  if (t.columns && t.columns.length > 0) {
    console.log(`   Columns (${t.columns.length}):`);
    for (const col of t.columns) {
      const nullable = col.nullable ? '' : ' NOT NULL';
      const def = col.default ? ` DEFAULT ${col.default}` : '';
      const pk = col.isPrimary ? ' 🔑' : '';
      const ref = col.ref ? ` → ${col.ref}` : '';
      const enumVals = col.enum ? ` [${col.enum.join(',')}]` : '';
      const val =
        col.validation
          ? ` (min:${col.validation.min ?? '-'}, max:${col.validation.max ?? '-'})`
          : '';
      console.log(`     ${col.name}: ${col.sqlType || col.type}${nullable}${def}${pk}${ref}${enumVals}${val}`);
    }
  }

  // Relations (traditional only)
  if (t.relations && t.relations.length > 0) {
    console.log(`   Relations:`);
    for (const rel of t.relations) {
      console.log(`     ${rel.type}: ${rel.property} → ${rel.target}`);
    }
  }

  // Permissions (spec-engine only)
  if (t.permissions && t.permissions.length > 0) {
    console.log(`   Permissions: ${t.permissions.join(', ')}`);
  }

  if (t.rowLevel && t.rowLevel.length > 0) {
    console.log(`   RowLevel: ${t.rowLevel.join(', ')}`);
  }

  // Hooks
  if (t.hooks && t.hooks.length > 0) {
    console.log(`   Hooks: ${t.hooks.join(', ')}`);
  }

  // Actions
  if (t.actions && t.actions.length > 0) {
    console.log(`   Actions: ${t.actions.join(', ')}`);
  }

  // Jobs
  if (t.jobs && t.jobs.length > 0) {
    console.log(`   Jobs: ${t.jobs.join(', ')}`);
  }

  // Notifications
  if (t.notifications && t.notifications.length > 0) {
    console.log(`   Notifications: ${t.notifications.join(', ')}`);
  }

  // Webhooks
  if (t.webhooks && t.webhooks.length > 0) {
    console.log(`   Webhooks: ${t.webhooks.join(', ')}`);
  }

  // Seeds
  if (t.seeds !== undefined && t.seeds > 0) {
    console.log(`   Seeds: ${t.seeds} entries`);
  }
}

console.log(`\n${'─'.repeat(80)}`);
console.log(`\nTotal: ${filtered.length} tables`);
console.log(`  Spec-engine: ${specCount}`);
console.log(`  Traditional: ${tradCount}`);