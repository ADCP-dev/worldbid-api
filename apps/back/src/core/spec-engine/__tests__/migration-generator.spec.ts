/**
 * MigrationGenerator — TDD tests for BUG #7.
 *
 *   - Reads ALL split spec files for an extension (not just the first), so the
 *     generated migration creates every resource table (task, task-comment,
 *     task-activity, task-attachment).
 *   - Emits FOREIGN KEY constraints for `ref` fields (e.g. taskId → task.id).
 *   - Emits CHECK constraints for `enum` fields (e.g. status IN (...)).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MigrationGenerator } from '@src/core/spec-engine/migration-generator';

/**
 * Build a temp extensions dir mirroring the real tasks extension layout:
 *   <tmp>/extensions/tasks/task.spec.yaml
 *   <tmp>/extensions/tasks/task-comment.spec.yaml
 *   <tmp>/extensions/tasks/task-activity.spec.yaml
 *   <tmp>/extensions/tasks/task-attachment.spec.yaml
 *   <tmp>/extensions/tasks/tasks.extension.spec.yaml
 */
function buildTempExtension(rootDir: string): string {
  const extDir = path.join(rootDir, 'extensions', 'tasks');
  fs.mkdirSync(extDir, { recursive: true });
  const srcDir = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'extensions',
    'tasks',
  );
  for (const file of fs.readdirSync(srcDir)) {
    if (file.endsWith('.spec.yaml')) {
      fs.copyFileSync(path.join(srcDir, file), path.join(extDir, file));
    }
  }
  return path.join(rootDir, 'extensions');
}

describe('MigrationGenerator — split-spec merge (BUG #7)', () => {
  let tmpDir: string;
  let extensionsDir: string;
  let migrationsDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-test-'));
    extensionsDir = buildTempExtension(tmpDir);
    migrationsDir = path.join(tmpDir, 'migrations');
    fs.mkdirSync(migrationsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates CREATE TABLE for ALL four resource tables', async () => {
    const result = await MigrationGenerator.generate(
      'tasks',
      extensionsDir,
      migrationsDir,
    );

    const tableNames = result.createdTables;
    expect(tableNames).toContain('ext_tasks_task');
    expect(tableNames).toContain('ext_tasks_task_comment');
    expect(tableNames).toContain('ext_tasks_task_activity');
    expect(tableNames).toContain('ext_tasks_task_attachment');
    expect(result.statements.length).toBeGreaterThanOrEqual(4);
  });

  it('emits FOREIGN KEY constraints for ref fields', async () => {
    const result = await MigrationGenerator.generate(
      'tasks',
      extensionsDir,
      migrationsDir,
    );

    // task-comment.taskId → ext_tasks_task.id (CASCADE)
    const commentStmt = result.statements.find(
      (s) => s.description.includes('task-comment') || s.up.includes('ext_tasks_task_comment'),
    );
    expect(commentStmt).toBeDefined();
    const allUp = result.statements.map((s) => s.up).join('\n');
    expect(allUp).toMatch(/FOREIGN KEY/i);
    expect(allUp).toMatch(/REFERENCES\s+"ext_tasks_task"/i);
  });

  it('emits CHECK constraints for enum fields', async () => {
    const result = await MigrationGenerator.generate(
      'tasks',
      extensionsDir,
      migrationsDir,
    );

    const allUp = result.statements.map((s) => s.up).join('\n');
    // task.status enum: pending, in_progress, review, done, blocked
    expect(allUp).toMatch(/CHECK/i);
    expect(allUp).toMatch(/pending/);
    expect(allUp).toMatch(/in_progress/);
  });

  it('writes a valid TypeORM migration .ts file', async () => {
    const result = await MigrationGenerator.generate(
      'tasks',
      extensionsDir,
      migrationsDir,
    );

    expect(result.migrationFileName).not.toBe('');
    const filePath = path.join(migrationsDir, result.migrationFileName);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('MigrationInterface');
    expect(content).toContain(result.migrationClassName);
  });
});

describe('MigrationGenerator — realtime triggers (PRD 05)', () => {
  let tmpDir: string;
  let extensionsDir: string;
  let migrationsDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-rt-'));
    extensionsDir = path.join(tmpDir, 'extensions');
    migrationsDir = path.join(tmpDir, 'migrations');
    fs.mkdirSync(migrationsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeRealtimeExtension(
    realtime: unknown,
    prevRealtime?: unknown,
  ): void {
    const extDir = path.join(extensionsDir, 'rt-demo');
    fs.mkdirSync(extDir, { recursive: true });
    fs.writeFileSync(
      path.join(extDir, 'demo.spec.yaml'),
      `name: rt-demo\nversion: '1.0.0'\nresources:\n  - name: demo\n    table: ext_rt_demo_demo\n    fields:\n      - name: title\n        type: string\n` +
        (realtime
          ? `    realtime:\n      events: [insert, update, delete]\n      channel: demo\n      payload: ${typeof realtime === 'string' ? realtime : 'id'}\n`
          : ''),
    );
  }

  it('generates trigger statements when realtime declared', async () => {
    writeRealtimeExtension('id');
    const result = await MigrationGenerator.generate(
      'rt-demo',
      extensionsDir,
      migrationsDir,
    );

    const allUp = result.statements.map((s) => s.up).join('\n');
    expect(allUp).toContain('CREATE OR REPLACE FUNCTION "notify_demo"');
    expect(allUp).toContain('CREATE TRIGGER "demo_realtime_notify"');
    expect(allUp).toContain('pg_notify');
  });

  it('does NOT generate trigger statements when realtime absent', async () => {
    writeRealtimeExtension(null);
    const result = await MigrationGenerator.generate(
      'rt-demo',
      extensionsDir,
      migrationsDir,
    );

    const allUp = result.statements.map((s) => s.up).join('\n');
    expect(allUp).not.toContain('notify_demo');
    expect(allUp).not.toContain('realtime_notify');
  });

  it('emits DROP trigger when realtime removed from previous snapshot', async () => {
    writeRealtimeExtension(null);
    const prevSnapshot = {
      extensionName: 'rt-demo',
      version: '1.0.0',
      resources: {
        demo: {
          table: 'ext_rt_demo_demo',
          fields: [{ name: 'title', type: 'string', nullable: false, unique: false }],
          timestamps: true,
          softDelete: true,
          indices: [],
          uniques: [],
          joinTables: [],
          realtime: { events: ['insert'], channel: 'demo' },
        },
      },
    };

    const result = await MigrationGenerator.generate(
      'rt-demo',
      extensionsDir,
      migrationsDir,
      { previousSnapshot: prevSnapshot },
    );

    const allUp = result.statements.map((s) => s.up).join('\n');
    expect(allUp).toContain('DROP TRIGGER');
    expect(allUp).toContain('DROP FUNCTION');
  });
});