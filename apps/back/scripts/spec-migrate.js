#!/usr/bin/env node
/**
 * spec-migrate — end-to-end spec migration flow for one extension.
 *
 * Wraps the three spec-engine steps into one command:
 *   1. generate  — pnpm spec:generate-migration <ext> (reads prev snapshot, emits diff)
 *   2. run       — pnpm migration:run               (applies pending migrations)
 *   3. save      — pnpm spec:snapshot-save <ext>     (persists new snapshot for next diff)
 *
 * Usage:
 *   pnpm spec:migrate <extensionName>
 *   pnpm spec:migrate tasks
 *
 * If step 1 reports "no changes", steps 2 and 3 still run (migration:run is
 * idempotent, snapshot-save keeps the stored snapshot in sync with the spec).
 */

const { spawnSync } = require('child_process');
const path = require('path');

const ext = process.argv[2];
if (!ext) {
  console.error('Usage: node scripts/spec-migrate.js <extensionName>');
  console.error('Example: node scripts/spec-migrate.js tasks');
  process.exit(1);
}

function run(label, cmd, args) {
  console.log(`\n── ${label} ──────────────────────────────────────────`);
  console.log(`$ ${cmd} ${args.join(' ')}\n`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', cwd: process.cwd() });
  if (res.status !== 0) {
    console.error(`\n✗ ${label} failed (exit ${res.status}). Aborting spec-migrate.`);
    process.exit(res.status ?? 1);
  }
}

// 1. Generate migration from spec diff
run('1/3 generate-migration', 'npx', [
  'ts-node', '-r', 'tsconfig-paths/register',
  './src/core/spec-engine/migration-generator.ts', ext,
]);

// 2. Apply pending migrations
run('2/3 migration:run', 'npm', ['run', 'migration:run']);

// 3. Save the new snapshot so the next generate-migration diffs against it
run('3/3 snapshot-save', 'npx', [
  'ts-node', '-r', 'tsconfig-paths/register',
  './src/core/spec-engine/spec-snapshot-save.ts', ext,
]);

console.log(`\n✅ spec:migrate "${ext}" complete: generate → run → snapshot saved.`);