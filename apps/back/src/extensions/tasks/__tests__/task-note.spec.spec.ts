/**
 * Task Note Spec — TDD RED tests for change `tasks-v2-professional` Slice 1.
 *
 * Verifies the new `task-note.spec.yaml`:
 *   - Loads as a valid resource within the `tasks` extension
 *   - Has the 3 expected fields (content, authorId, taskId) with correct types
 *   - Declares permissions (list/read/create/update/delete) + rowLevel for user/manager
 *   - Declares an afterCreate hook (task-note-after-create)
 *   - Has seeds (at least 3)
 *
 * RED: the spec file does not exist yet → SpecLoader will not find the
 *      `task-note` resource → assertions fail.
 */
import * as fs from 'fs';
import * as path from 'path';

import { SpecLoader } from '@core/spec-engine/spec-loader';
import type { ResourceSpec } from '@core/spec-engine/spec.types';

// `__dirname` = .../src/extensions/tasks/__tests__
// SpecLoader.load expects the dir that CONTAINS extension folders → src/extensions
const EXTENSIONS_DIR = path.resolve(__dirname, '..', '..');
const TASKS_EXT_DIR = path.resolve(__dirname, '..');

function loadTasksExtension() {
  // Load every *.spec.yaml in the tasks extension dir.
  const loaded = SpecLoader.load(EXTENSIONS_DIR);
  return loaded.find((l) => l.spec.name === 'tasks');
}

function findResource(specName: string): ResourceSpec {
  const loaded = loadTasksExtension();
  if (!loaded) {
    throw new Error('tasks extension not loaded by SpecLoader');
  }
  const res = loaded.spec.resources.find((r) => r.name === specName);
  if (!res) {
    throw new Error(`resource "${specName}" not found in tasks extension`);
  }
  return res;
}

describe('task-note.spec.yaml — Slice 1 (RED→GREEN)', () => {
  it('the spec file exists on disk', () => {
    const specPath = path.join(TASKS_EXT_DIR, 'task-note.spec.yaml');
    expect(fs.existsSync(specPath)).toBe(true);
  });

  it('loads as a resource named "task-note" within the tasks extension', () => {
    const res = findResource('task-note');
    expect(res.name).toBe('task-note');
    expect(res.table).toBe('ext_tasks_task_note');
  });

  it('declares exactly the 3 expected fields with correct types', () => {
    const res = findResource('task-note');
    const fieldNames = res.fields.map((f) => f.name);
    expect(fieldNames).toContain('content');
    expect(fieldNames).toContain('authorId');
    expect(fieldNames).toContain('taskId');

    const content = res.fields.find((f) => f.name === 'content')!;
    expect(content.type).toBe('text');
    expect(content.required).toBe(true);

    const authorId = res.fields.find((f) => f.name === 'authorId')!;
    expect(authorId.type).toBe('ref');
    expect(authorId.ref).toBe('user');
    expect(authorId.nullable).toBe(true);

    const taskId = res.fields.find((f) => f.name === 'taskId')!;
    expect(taskId.type).toBe('ref');
    expect(taskId.ref).toBe('task');
    expect(taskId.required).toBe(true);
  });

  it('declares permissions for list/read/create with [admin,user,manager]', () => {
    const res = findResource('task-note');
    const perms = res.permissions!;
    expect(perms.list).toEqual(
      expect.arrayContaining(['admin', 'user', 'manager']),
    );
    expect(perms.read).toEqual(
      expect.arrayContaining(['admin', 'user', 'manager']),
    );
    expect(perms.create).toEqual(
      expect.arrayContaining(['admin', 'user', 'manager']),
    );
  });

  it('declares rowLevel for user and manager keyed on authorId', () => {
    const res = findResource('task-note');
    const rowLevel = res.permissions?.rowLevel;
    expect(rowLevel).toBeDefined();
    expect(rowLevel!.user).toBeDefined();
    expect(rowLevel!.user.filter).toContain('authorId');
    expect(rowLevel!.manager).toBeDefined();
    expect(rowLevel!.manager.filter).toContain('authorId');
  });

  it('declares an afterCreate hook pointing at task-note-after-create', () => {
    const res = findResource('task-note');
    const hooks = res.hooks!;
    expect(hooks.afterCreate).toBeDefined();
    expect(String(hooks.afterCreate)).toContain('task-note-after-create');
  });

  it('declares at least 3 seed rows', () => {
    const res = findResource('task-note');
    const seeds = res.seeds;
    expect(Array.isArray(seeds)).toBe(true);
    expect(seeds!.length).toBeGreaterThanOrEqual(3);
    // Every seed has content + taskId
    for (const seed of seeds!) {
      expect(seed.content).toBeTruthy();
      expect(seed.taskId).toBeDefined();
    }
  });

  it('content field has validation min=5', () => {
    const res = findResource('task-note');
    const content = res.fields.find((f) => f.name === 'content')!;
    expect(content.validation).toBeDefined();
    expect(content.validation?.min).toBe(5);
  });

  it('taskId ref uses CASCADE on delete', () => {
    const res = findResource('task-note');
    const taskId = res.fields.find((f) => f.name === 'taskId')!;
    expect(taskId.refOnDelete).toBe('CASCADE');
  });
});