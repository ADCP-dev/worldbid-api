/**
 * Migration Diff — TDD RED tests for change `tasks-v2-professional` Slice 1.
 *
 * Verifies the migration generator produces a DIFF migration when given a
 * previous snapshot:
 *   - CREATE TABLE ext_tasks_task_note (new resource)
 *   - ALTER TABLE ext_tasks_task ADD COLUMN "tags" jsonb (new field)
 *
 * RED: `task.spec.yaml` does not yet declare `tags`, so the generated
 *      migration will NOT contain `ADD COLUMN "tags"` → assertion fails.
 *
 * The previous snapshot mirrors what's stored in the DB today (v2.0.0):
 * 4 resources (task, task-comment, task-activity, task-attachment) with
 * task having 15 fields (no tags).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { MigrationGenerator } from '@src/core/spec-engine/migration-generator';
import type { SpecSnapshot } from '@src/core/spec-engine/migration-generator';
import { SpecLoader } from '@src/core/spec-engine/spec-loader';
import { buildExtensionSnapshot } from '@src/core/spec-engine/migration-generator';
import type { ExtensionSpec, ResourceSpec } from '@src/core/spec-engine/spec.types';

function buildTempExtension(rootDir: string): string {
  const extDir = path.join(rootDir, 'extensions', 'tasks');
  fs.mkdirSync(extDir, { recursive: true });
  const srcDir = path.resolve(__dirname, '..');
  for (const file of fs.readdirSync(srcDir)) {
    if (file.endsWith('.spec.yaml')) {
      fs.copyFileSync(path.join(srcDir, file), path.join(extDir, file));
    }
  }
  return path.join(rootDir, 'extensions');
}

/**
 * Build the PREVIOUS snapshot (state before this change) by loading the
 * current spec, removing the `task-note` resource and the `tags` field from
 * `task`, then calling buildExtensionSnapshot. This mirrors what's stored
 * in the DB's spec_schema_snapshots table (v2.0.0 with 4 resources, task
 * with 15 fields, no tags, no task-note).
 */
function buildPreviousSnapshot(extensionsDir: string): SpecSnapshot {
  const loaded = SpecLoader.load(extensionsDir);
  const found = loaded.find((l) => l.spec.name === 'tasks');
  if (!found) {
    throw new Error('tasks extension not loaded');
  }
  // Clone the spec so we don't mutate the original.
  const spec: ExtensionSpec = JSON.parse(JSON.stringify(found.spec));
  // Remove the task-note resource (it's new in this change).
  spec.resources = spec.resources.filter(
    (r: ResourceSpec) => r.name !== 'task-note',
  );
  // Remove the `tags` field from task if present (it's new in this change).
  const task = spec.resources.find((r) => r.name === 'task');
  if (task) {
    task.fields = task.fields.filter((f) => f.name !== 'tags');
  }
  return buildExtensionSnapshot(spec);
}

describe('MigrationGenerator — diff (tasks-v2 Slice 1)', () => {
  let tmpDir: string;
  let extensionsDir: string;
  let migrationsDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-diff-'));
    extensionsDir = buildTempExtension(tmpDir);
    migrationsDir = path.join(tmpDir, 'migrations');
    fs.mkdirSync(migrationsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates CREATE TABLE for the new task-note resource', async () => {
    const result = await MigrationGenerator.generate(
      'tasks',
      extensionsDir,
      migrationsDir,
      { previousSnapshot: buildPreviousSnapshot(extensionsDir) },
    );

    expect(result.createdTables).toContain('ext_tasks_task_note');
    const allUp = result.statements.map((s) => s.up).join('\n');
    expect(allUp).toMatch(/CREATE TABLE.*ext_tasks_task_note/i);
  });

  it('generates ALTER TABLE ext_tasks_task ADD COLUMN "tags"', async () => {
    const result = await MigrationGenerator.generate(
      'tasks',
      extensionsDir,
      migrationsDir,
      { previousSnapshot: buildPreviousSnapshot(extensionsDir) },
    );

    expect(result.alteredTables).toContain('ext_tasks_task');
    const allUp = result.statements.map((s) => s.up).join('\n');
    expect(allUp).toMatch(/ALTER TABLE.*ext_tasks_task.*ADD COLUMN.*tags/i);
    // The new column is jsonb
    expect(allUp).toMatch(/tags.*jsonb/i);
  });

  it('does NOT re-emit CREATE TABLE for pre-existing resources', async () => {
    const result = await MigrationGenerator.generate(
      'tasks',
      extensionsDir,
      migrationsDir,
      { previousSnapshot: buildPreviousSnapshot(extensionsDir) },
    );

    // task, task-comment, task-activity, task-attachment already exist → no CREATE
    expect(result.createdTables).not.toContain('ext_tasks_task');
    expect(result.createdTables).not.toContain('ext_tasks_task_comment');
    expect(result.createdTables).not.toContain('ext_tasks_task_activity');
    expect(result.createdTables).not.toContain('ext_tasks_task_attachment');
  });

  it('emits a valid TypeORM migration .ts file containing both changes', async () => {
    const result = await MigrationGenerator.generate(
      'tasks',
      extensionsDir,
      migrationsDir,
      { previousSnapshot: buildPreviousSnapshot(extensionsDir) },
    );

    const filePath = path.join(migrationsDir, result.migrationFileName);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('MigrationInterface');
    expect(content).toContain('ext_tasks_task_note');
    expect(content).toMatch(/ADD COLUMN.*tags/i);
  });
});