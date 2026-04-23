#!/usr/bin/env node
/**
 * Migration generator script
 * Usage: node scripts/migrate.js <migration-name>
 * Example: node scripts/migrate.js AddUsersTable
 *
 * Generates migration file: <timestamp>-<MigrationName>.ts
 */

const { spawnSync } = require('child_process');
const path = require('path');

const migrationName = process.argv[2];

if (!migrationName) {
  console.error('Usage: node scripts/migrate.js <migration-name>');
  console.error('Example: node scripts/migrate.js AddUsersTable');
  process.exit(1);
}

const migrationsPath = 'src/infrastructure/database/migrations';
// TypeORM will add the timestamp automatically
const fullPath = `${migrationsPath}/${migrationName}`;

console.log(`Generating migration: ${migrationName}`);

const result = spawnSync(
  'npx',
  [
    'env-cmd',
    '-f',
    path.join(__dirname, '..', '.env'),
    'ts-node',
    '--project',
    'tsconfig.json',
    '-r',
    'tsconfig-paths/register',
    './node_modules/typeorm/cli.js',
    '--dataSource=src/infrastructure/database/data-source.ts',
    'migration:generate',
    fullPath,
  ],
  {
    stdio: 'inherit',
    shell: true,
  },
);

if (result.error) {
  console.error(`Error: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status || 0);
