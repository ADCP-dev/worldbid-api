/**
 * Spec Loader Merge — Unit tests
 *
 * Tests the split-merge loader behavior introduced by change
 * `spec-engine-v2-frontend-and-loader` (Slice 1).
 *
 * Coverage:
 *   - mergeSpecs: split resources merge into one ExtensionSpec
 *   - Duplicate resource name across files rejects with fileA/fileB/resource
 *   - views/overrides/roles/roleSeeds/config concatenate across files
 *   - Duplicate view name across files rejects
 *   - SpecLoader glob skips dist/node_modules/hidden directories
 *   - Backward compatible: single root *.spec.yaml loads as before
 *   - Monolith + split coexist (split merged on top of monolith)
 *
 * RED phase: mergeSpecs / SpecMergeError do not exist yet → import fails.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { SpecLoader } from '@core/spec-engine/spec-loader';
import {
  mergeSpecs,
  SpecMergeError,
} from '@core/spec-engine/spec-loader.merge';
import { SpecValidator } from '@core/spec-engine/spec-validator';
import type {
  ExtensionSpec,
  LoadedSpec,
  ResourceSpec,
  RoleDefSpec,
} from '@core/spec-engine/spec.types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeSpec(
  name: string,
  resources: ExtensionSpec['resources'],
  extra: Partial<ExtensionSpec> = {},
): ExtensionSpec {
  return {
    name,
    version: '1.0.0',
    resources,
    ...extra,
  };
}

function makeResource(
  name: string,
  table: string,
): ExtensionSpec['resources'][number] {
  return {
    name,
    table,
    fields: [{ name: 'id', type: 'string' }],
  };
}

/** Create a temp extensions dir with the given files laid out. */
function withTempExtensions(
  layout: Record<string, string>,
  fn: (extensionsDir: string) => void,
): void {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-loader-test-'));
  try {
    for (const [relPath, content] of Object.entries(layout)) {
      const fullPath = path.join(tmp, relPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf-8');
    }
    fn(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ─── mergeSpecs ─────────────────────────────────────────────────────────────

describe('mergeSpecs', () => {
  it('merges split resources from multiple files into one ExtensionSpec', () => {
    const fileA = makeSpec('tasks', [makeResource('task', 'ext_tasks_task')]);
    const fileB = makeSpec('tasks', [
      makeResource('taskComment', 'ext_tasks_task_comment'),
    ]);

    const merged = mergeSpecs([fileA, fileB]);

    expect(merged.name).toBe('tasks');
    expect(merged.resources).toHaveLength(2);
    expect(merged.resources.map((r) => r.name)).toEqual([
      'task',
      'taskComment',
    ]);
  });

  it('preserves declaration order within each file', () => {
    const fileA = makeSpec('demo', [
      makeResource('alpha', 'ext_demo_alpha'),
      makeResource('beta', 'ext_demo_beta'),
    ]);
    const fileB = makeSpec('demo', [makeResource('gamma', 'ext_demo_gamma')]);

    const merged = mergeSpecs([fileA, fileB]);

    expect(merged.resources.map((r) => r.name)).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
  });

  it('rejects duplicate resource name across files with SpecMergeError naming both files and the resource', () => {
    const fileA = makeSpec('tasks', [makeResource('task', 'ext_tasks_task')]);
    const fileB = makeSpec('tasks', [
      makeResource('task', 'ext_tasks_task_dup'),
    ]);

    let caught: SpecMergeError | null = null;
    try {
      mergeSpecs([fileA, fileB]);
    } catch (err) {
      caught = err as SpecMergeError;
    }

    expect(caught).not.toBeNull();
    expect(caught).toBeInstanceOf(SpecMergeError);
    expect(caught?.resource).toBe('task');
    // fileA/fileB identify the two conflicting specs by their extension name
    expect(caught?.fileA).toBe('tasks');
    expect(caught?.fileB).toBe('tasks');
    expect(caught?.message).toContain('task');
  });

  it('concatenates views from all files', () => {
    const fileA = makeSpec('demo', [makeResource('alpha', 'ext_demo_alpha')], {
      views: [
        {
          name: 'overview',
          type: 'dashboard',
          roles: ['admin'],
          panels: [],
        },
      ],
    });
    const fileB = makeSpec('demo', [makeResource('beta', 'ext_demo_beta')], {
      views: [
        {
          name: 'reports',
          type: 'dashboard',
          roles: ['admin'],
          panels: [],
        },
      ],
    });

    const merged = mergeSpecs([fileA, fileB]);

    expect(merged.views).toHaveLength(2);
    expect(merged.views?.map((v) => v.name)).toEqual(['overview', 'reports']);
  });

  it('rejects duplicate view name across files', () => {
    const fileA = makeSpec('demo', [makeResource('alpha', 'ext_demo_alpha')], {
      views: [
        { name: 'overview', type: 'dashboard', roles: ['admin'], panels: [] },
      ],
    });
    const fileB = makeSpec('demo', [makeResource('beta', 'ext_demo_beta')], {
      views: [
        { name: 'overview', type: 'dashboard', roles: ['admin'], panels: [] },
      ],
    });

    expect(() => mergeSpecs([fileA, fileB])).toThrow(SpecMergeError);
    expect(() => mergeSpecs([fileA, fileB])).toThrow(/overview/);
  });

  it('concatenates overrides from all files', () => {
    const fileA = makeSpec('demo', [makeResource('alpha', 'ext_demo_alpha')], {
      overrides: [
        { resource: 'alpha', fields: { add: [], remove: ['legacy'] } },
      ],
    });
    const fileB = makeSpec('demo', [makeResource('beta', 'ext_demo_beta')], {
      overrides: [{ resource: 'beta', fields: { add: [], remove: ['old'] } }],
    });

    const merged = mergeSpecs([fileA, fileB]);

    expect(merged.overrides).toHaveLength(2);
    expect(merged.overrides?.map((o) => o.resource)).toEqual(['alpha', 'beta']);
  });

  it('concatenates roles from all files', () => {
    const fileA = makeSpec('demo', [makeResource('alpha', 'ext_demo_alpha')], {
      roles: [{ name: 'manager', description: 'Manager role' }],
    });
    const fileB = makeSpec('demo', [makeResource('beta', 'ext_demo_beta')], {
      roles: [{ name: 'viewer', description: 'Viewer role' }],
    });

    const merged = mergeSpecs([fileA, fileB]);

    expect(merged.roles).toHaveLength(2);
    expect(merged.roles?.map((r) => r.name)).toEqual(['manager', 'viewer']);
  });

  it('concatenates roleSeeds from all files', () => {
    const fileA = makeSpec('demo', [makeResource('alpha', 'ext_demo_alpha')], {
      roleSeeds: [{ role: 'manager', userId: 1 }],
    });
    const fileB = makeSpec('demo', [makeResource('beta', 'ext_demo_beta')], {
      roleSeeds: [{ role: 'viewer', userId: 2 }],
    });

    const merged = mergeSpecs([fileA, fileB]);

    expect(merged.roleSeeds).toHaveLength(2);
  });

  it('concatenates config items from all files', () => {
    const fileA = makeSpec('demo', [makeResource('alpha', 'ext_demo_alpha')], {
      config: [{ name: 'API_KEY', required: true }],
    });
    const fileB = makeSpec('demo', [makeResource('beta', 'ext_demo_beta')], {
      config: [{ name: 'REGION', required: false, default: 'us-east' }],
    });

    const merged = mergeSpecs([fileA, fileB]);

    expect(merged.config).toHaveLength(2);
    expect(merged.config?.map((c) => c.name)).toEqual(['API_KEY', 'REGION']);
  });

  it('returns empty resources when no files provided', () => {
    const merged = mergeSpecs([]);
    expect(merged.resources).toEqual([]);
  });
});

// ─── SpecLoader glob + merge integration ───────────────────────────────────

describe('SpecLoader glob + merge integration', () => {
  it('loads a single root *.spec.yaml unchanged (backward compatible)', () => {
    const monolithYaml = [
      'name: tasks',
      'version: 1.0.0',
      'resources:',
      '  - name: task',
      '    table: ext_tasks_task',
      '    fields:',
      '      - name: title',
      '        type: string',
    ].join('\n');

    withTempExtensions(
      { 'tasks/tasks.spec.yaml': monolithYaml },
      (extensionsDir) => {
        const loaded = SpecLoader.load(extensionsDir);

        expect(loaded).toHaveLength(1);
        expect(loaded[0].spec.name).toBe('tasks');
        expect(loaded[0].spec.resources).toHaveLength(1);
        expect(loaded[0].spec.resources[0].name).toBe('task');
      },
    );
  });

  it('loads multiple *.spec.yaml from immediate subdirectories and merges them', () => {
    const taskYaml = [
      'name: tasks',
      'version: 1.0.0',
      'resources:',
      '  - name: task',
      '    table: ext_tasks_task',
      '    fields:',
      '      - name: title',
      '        type: string',
    ].join('\n');

    const commentYaml = [
      'name: tasks',
      'version: 1.0.0',
      'resources:',
      '  - name: taskComment',
      '    table: ext_tasks_task_comment',
      '    fields:',
      '      - name: body',
      '        type: text',
    ].join('\n');

    const layout = {
      'tasks/task.spec.yaml': taskYaml,
      'tasks/sub/task-comment.spec.yaml': commentYaml,
    };

    withTempExtensions(layout, (extensionsDir) => {
      const loaded = SpecLoader.load(extensionsDir);

      expect(loaded).toHaveLength(1);
      expect(loaded[0].spec.resources).toHaveLength(2);
      const names = loaded[0].spec.resources.map((r) => r.name);
      expect(names).toContain('task');
      expect(names).toContain('taskComment');
    });
  });

  it('ignores *.spec.yaml inside dist directories', () => {
    const realYaml = [
      'name: tasks',
      'version: 1.0.0',
      'resources:',
      '  - name: task',
      '    table: ext_tasks_task',
      '    fields:',
      '      - name: title',
      '        type: string',
    ].join('\n');

    const leakYaml = [
      'name: leak',
      'version: 1.0.0',
      'resources:',
      '  - name: leaked',
      '    table: ext_leak',
      '    fields:',
      '      - name: x',
      '        type: string',
    ].join('\n');

    const layout = {
      'tasks/tasks.spec.yaml': realYaml,
      'tasks/dist/leak.spec.yaml': leakYaml,
    };

    withTempExtensions(layout, (extensionsDir) => {
      const loaded = SpecLoader.load(extensionsDir);

      expect(loaded).toHaveLength(1);
      const names = loaded[0].spec.resources.map((r) => r.name);
      expect(names).not.toContain('leaked');
    });
  });

  it('ignores *.spec.yaml inside node_modules directories', () => {
    const realYaml = [
      'name: tasks',
      'version: 1.0.0',
      'resources:',
      '  - name: task',
      '    table: ext_tasks_task',
      '    fields:',
      '      - name: title',
      '        type: string',
    ].join('\n');

    const leakYaml = [
      'name: leak',
      'version: 1.0.0',
      'resources:',
      '  - name: leaked',
      '    table: ext_leak',
      '    fields:',
      '      - name: x',
      '        type: string',
    ].join('\n');

    const layout = {
      'tasks/tasks.spec.yaml': realYaml,
      'tasks/node_modules/pkg/leak.spec.yaml': leakYaml,
    };

    withTempExtensions(layout, (extensionsDir) => {
      const loaded = SpecLoader.load(extensionsDir);

      const names = loaded.flatMap((l) => l.spec.resources.map((r) => r.name));
      expect(names).not.toContain('leaked');
    });
  });

  it('ignores *.spec.yaml inside hidden directories (dot-prefixed)', () => {
    const realYaml = [
      'name: tasks',
      'version: 1.0.0',
      'resources:',
      '  - name: task',
      '    table: ext_tasks_task',
      '    fields:',
      '      - name: title',
      '        type: string',
    ].join('\n');

    const leakYaml = [
      'name: leak',
      'version: 1.0.0',
      'resources:',
      '  - name: leaked',
      '    table: ext_leak',
      '    fields:',
      '      - name: x',
      '        type: string',
    ].join('\n');

    const layout = {
      'tasks/tasks.spec.yaml': realYaml,
      'tasks/.cache/leak.spec.yaml': leakYaml,
    };

    withTempExtensions(layout, (extensionsDir) => {
      const loaded = SpecLoader.load(extensionsDir);

      const names = loaded.flatMap((l) => l.spec.resources.map((r) => r.name));
      expect(names).not.toContain('leaked');
    });
  });

  it('merges split files on top of monolith when both present', () => {
    const monolithYaml = [
      'name: tasks',
      'version: 1.0.0',
      'resources:',
      '  - name: task',
      '    table: ext_tasks_task',
      '    fields:',
      '      - name: title',
      '        type: string',
    ].join('\n');

    const splitYaml = [
      'name: tasks',
      'version: 1.0.0',
      'resources:',
      '  - name: taskComment',
      '    table: ext_tasks_task_comment',
      '    fields:',
      '      - name: body',
      '        type: text',
    ].join('\n');

    const layout = {
      'tasks/tasks.spec.yaml': monolithYaml,
      'tasks/sub/task-comment.spec.yaml': splitYaml,
    };

    withTempExtensions(layout, (extensionsDir) => {
      const loaded = SpecLoader.load(extensionsDir);

      expect(loaded).toHaveLength(1);
      const names = loaded[0].spec.resources.map((r) => r.name);
      expect(names).toEqual(expect.arrayContaining(['task', 'taskComment']));
      expect(loaded[0].spec.resources).toHaveLength(2);
    });
  });

  it('rejects duplicate resource name between monolith and split file', () => {
    const monolithYaml = [
      'name: tasks',
      'version: 1.0.0',
      'resources:',
      '  - name: task',
      '    table: ext_tasks_task',
      '    fields:',
      '      - name: title',
      '        type: string',
    ].join('\n');

    const splitYaml = [
      'name: tasks',
      'version: 1.0.0',
      'resources:',
      '  - name: task',
      '    table: ext_tasks_task_dup',
      '    fields:',
      '      - name: title',
      '        type: string',
    ].join('\n');

    const layout = {
      'tasks/tasks.spec.yaml': monolithYaml,
      'tasks/sub/task.spec.yaml': splitYaml,
    };

    withTempExtensions(layout, (extensionsDir) => {
      expect(() => SpecLoader.load(extensionsDir)).toThrow(SpecMergeError);
    });
  });
});

// ─── Slice 7: Canonical tasks split-spec fixture ───────────────────────────
//
// The real `extensions/tasks/` example is being redesigned from scratch (Slice 7)
// into a canonical, demanding example that showcases every spec-engine v2
// feature. The fixture is laid out as split-by-resource files:
//
//   extensions/tasks/
//     task.spec.yaml              ← task resource (kanban, sections, steps…)
//     task-comment.spec.yaml       ← task-comment resource
//     task-attachment.spec.yaml    ← task-attachment resource (file upload)
//     task-activity.spec.yaml      ← task-activity resource (list view)
//     tasks.extension.spec.yaml    ← extension-level: name, roles, views
//
// These tests load the real fixture from disk (not a temp copy) and assert the
// merged shape. They are RED until the fixture files + SpecValidator custom-role
// support exist.

describe('Slice 7 — canonical tasks split-spec fixture', () => {
  const TASKS_DIR = path.resolve(__dirname, '../../../extensions/tasks');

  it('fixture directory exists (sanity)', () => {
    expect(fs.existsSync(TASKS_DIR)).toBe(true);
  });

  it('loads the canonical tasks extension with 4 resources from split files', () => {
    const loaded = SpecLoader.load(path.dirname(TASKS_DIR));

    const tasks = loaded.find((l) => l.spec.name === 'tasks');
    expect(tasks).toBeDefined();
    expect(tasks!.spec.resources).toHaveLength(4);

    const names = tasks!.spec.resources.map((r) => r.name).sort();
    expect(names).toEqual([
      'task',
      'task-activity',
      'task-attachment',
      'task-comment',
    ]);
  });

  it('declares 3 extension-level views (dashboards) merged across files', () => {
    const loaded = SpecLoader.load(path.dirname(TASKS_DIR));
    const tasks = loaded.find((l) => l.spec.name === 'tasks');

    expect(tasks).toBeDefined();
    expect(tasks!.spec.views).toBeDefined();
    expect(tasks!.spec.views!.length).toBeGreaterThanOrEqual(3);

    const viewNames = tasks!.spec.views!.map((v) => v.name).sort();
    expect(viewNames).toContain('task-dashboard');
    expect(viewNames).toContain('my-tasks');
    expect(viewNames).toContain('team-overview');
  });

  it('declares 3 extension-level roles (admin, user, manager)', () => {
    const loaded = SpecLoader.load(path.dirname(TASKS_DIR));
    const tasks = loaded.find((l) => l.spec.name === 'tasks');

    expect(tasks).toBeDefined();
    expect(tasks!.spec.roles).toBeDefined();
    expect(tasks!.spec.roles!.length).toBeGreaterThanOrEqual(3);

    const roleNames = tasks!.spec.roles!.map((r) => r.name).sort();
    expect(roleNames).toContain('admin');
    expect(roleNames).toContain('user');
    expect(roleNames).toContain('manager');
  });

  it('has no duplicate resource names across the split files (no SpecMergeError)', () => {
    // SpecLoader.load throws SpecMergeError on duplicates — wrapping in a
    // no-throw assertion confirms the canonical fixture is well-formed.
    expect(() => SpecLoader.load(path.dirname(TASKS_DIR))).not.toThrow();
  });

  it('task resource showcases the demanding field set (kanban + sections + steps)', () => {
    const loaded = SpecLoader.load(path.dirname(TASKS_DIR));
    const tasks = loaded.find((l) => l.spec.name === 'tasks');
    const task = tasks!.spec.resources.find((r) => r.name === 'task');

    expect(task).toBeDefined();
    const fieldNames = task!.fields.map((f) => f.name);
    // Core demanding fields
    expect(fieldNames).toContain('title');
    expect(fieldNames).toContain('status');
    expect(fieldNames).toContain('priority');
    expect(fieldNames).toContain('assigneeId');
    expect(fieldNames).toContain('dueDate');
    expect(fieldNames).toContain('position');
    expect(fieldNames).toContain('estimateHours');
    expect(fieldNames).toContain('metadata');
    expect(fieldNames).toContain('isRecurring');
    expect(fieldNames).toContain('recurrenceRule');
    expect(fieldNames).toContain('apiKey');
    expect(fieldNames).toContain('attachment');
    expect(fieldNames).toContain('coverImage');
    // Kanban view config
    expect(task!.ui?.view).toBe('kanban');
    expect(task!.ui?.kanbanColumn).toBe('status');
    expect(task!.ui?.kanbanOrder).toBe('position');
    // Sections + steps + showIf showcase
    expect(task!.ui?.sections).toBeDefined();
    expect(task!.ui?.sections!.length).toBeGreaterThanOrEqual(3);
    expect(task!.ui?.steps).toBeDefined();
    expect(task!.ui?.steps!.length).toBeGreaterThanOrEqual(3);
    // recurrenceRule is showIf-gated on isRecurring
    const recurrence = task!.fields.find((f) => f.name === 'recurrenceRule');
    expect(recurrence?.ui?.showIf).toBeDefined();
  });

  it('task-attachment resource showcases file fields (single + multiple)', () => {
    const loaded = SpecLoader.load(path.dirname(TASKS_DIR));
    const tasks = loaded.find((l) => l.spec.name === 'tasks');
    const attachment = tasks!.spec.resources.find(
      (r) => r.name === 'task-attachment',
    );

    expect(attachment).toBeDefined();
    const fieldNames = attachment!.fields.map((f) => f.name);
    expect(fieldNames).toContain('filename');
    expect(fieldNames).toContain('file');
    expect(fieldNames).toContain('files');
    expect(fieldNames).toContain('taskId');

    const singleFile = attachment!.fields.find((f) => f.name === 'file');
    expect(singleFile?.type).toBe('file');

    const multiFile = attachment!.fields.find((f) => f.name === 'files');
    expect(multiFile?.type).toBe('file');
    expect(multiFile?.ui?.multiple).toBe(true);
  });

  it('task-activity resource showcases the list view', () => {
    const loaded = SpecLoader.load(path.dirname(TASKS_DIR));
    const tasks = loaded.find((l) => l.spec.name === 'tasks');
    const activity = tasks!.spec.resources.find(
      (r) => r.name === 'task-activity',
    );

    expect(activity).toBeDefined();
    expect(activity!.ui?.view).toBe('list');
    const fieldNames = activity!.fields.map((f) => f.name);
    expect(fieldNames).toContain('action');
    expect(fieldNames).toContain('description');
    expect(fieldNames).toContain('userId');
    expect(fieldNames).toContain('taskId');
  });

  it('task-dashboard view showcases table + list + custom panel types', () => {
    const loaded = SpecLoader.load(path.dirname(TASKS_DIR));
    const tasks = loaded.find((l) => l.spec.name === 'tasks');
    const dashboard = tasks!.spec.views!.find(
      (v) => v.name === 'task-dashboard',
    );

    expect(dashboard).toBeDefined();
    expect(dashboard!.panels).toBeDefined();
    expect(dashboard!.panels!.length).toBeGreaterThanOrEqual(5);

    const charts = dashboard!.panels!.map((p) => p.chart);
    // Must include the new chart types introduced by spec-engine-v2
    expect(charts).toContain('table');
    expect(charts).toContain('list');
    // And the pre-existing ones
    expect(charts).toContain('stat');
    expect(charts).toContain('donut');
    expect(charts).toContain('bar');
    expect(charts).toContain('line');
  });

  it('team-overview view is type=custom delegating to a named component', () => {
    const loaded = SpecLoader.load(path.dirname(TASKS_DIR));
    const tasks = loaded.find((l) => l.spec.name === 'tasks');
    const team = tasks!.spec.views!.find((v) => v.name === 'team-overview');

    expect(team).toBeDefined();
    expect(team!.type).toBe('custom');
    expect(team!.component).toBeDefined();
    expect(typeof team!.component).toBe('string');
  });
});

// ─── Slice 7: SpecValidator accepts custom roles from ExtensionSpec.roles ──
//
// The canonical tasks extension defines a custom `manager` role. Pre-change the
// SpecValidator only accepted BUILTIN_ROLES = [admin, user, public] in
// permissions.*. With the tasks extension declaring `roles: [admin, user,
// manager]`, the validator must accept `manager` in permissions lists and
// rowLevel keys. This is the minimal, allowed adjustment to spec-validator.ts.

describe('Slice 7 — SpecValidator custom roles from ExtensionSpec.roles', () => {
  function loadedWithRoles(
    roles: RoleDefSpec[],
    perms: ResourceSpec['permissions'],
  ): LoadedSpec {
    const resource: ResourceSpec = {
      name: 'task',
      table: 'ext_tasks_task',
      fields: [
        { name: 'title', type: 'string' },
        { name: 'assigneeId', type: 'ref', ref: 'user' },
      ],
      permissions: perms,
    };
    return {
      spec: {
        name: 'tasks',
        version: '2.0.0',
        roles,
        resources: [resource],
      },
      dir: '/tmp/tasks',
      specPath: '/tmp/tasks/tasks.extension.spec.yaml',
    };
  }

  it('accepts a custom role declared in ExtensionSpec.roles inside permissions lists', () => {
    const loaded = loadedWithRoles(
      [{ name: 'manager', description: 'Team manager' }],
      {
        list: ['admin', 'user', 'manager'],
        read: ['admin', 'user', 'manager'],
        create: ['admin', 'manager'],
        update: ['admin', 'manager'],
        delete: ['admin'],
      },
    );

    const result = SpecValidator.validateAll([loaded]);

    const roleErrors = result.errors.filter((e) =>
      /Invalid role "manager"/.test(e.message),
    );
    expect(roleErrors).toHaveLength(0);
    expect(result.valid).toBe(true);
  });

  it('accepts a custom role in rowLevel filter keyed by role', () => {
    const loaded = loadedWithRoles(
      [{ name: 'manager', description: 'Team manager' }],
      {
        list: ['admin', 'manager'],
        read: ['admin', 'manager'],
        create: ['admin'],
        update: ['admin'],
        delete: ['admin'],
        rowLevel: {
          manager: { filter: 'assigneeId == ${user.id}' },
        },
      },
    );

    const result = SpecValidator.validateAll([loaded]);

    const roleErrors = result.errors.filter((e) =>
      /invalid role|Row-level filter for invalid role/i.test(e.message),
    );
    expect(roleErrors).toHaveLength(0);
    expect(result.valid).toBe(true);
  });

  it('still rejects an undeclared role (not in roles[] nor builtin)', () => {
    const loaded = loadedWithRoles([{ name: 'manager' }], {
      list: ['admin', 'ghost'], // ghost is neither builtin nor declared
      read: ['admin'],
      create: ['admin'],
      update: ['admin'],
      delete: ['admin'],
    });

    const result = SpecValidator.validateAll([loaded]);

    expect(
      result.errors.some((e) => /Invalid role "ghost"/.test(e.message)),
    ).toBe(true);
  });

  it('accepts a field-level permission using a custom role', () => {
    const loaded = loadedWithRoles([{ name: 'manager' }], {
      list: ['admin', 'manager'],
      read: ['admin', 'manager'],
      create: ['admin', 'manager'],
      update: ['admin', 'manager'],
      delete: ['admin'],
      fields: {
        assigneeId: { read: ['admin', 'manager'] },
      },
    });

    const result = SpecValidator.validateAll([loaded]);

    const roleErrors = result.errors.filter((e) =>
      /Invalid role "manager"/.test(e.message),
    );
    expect(roleErrors).toHaveLength(0);
    expect(result.valid).toBe(true);
  });
});

// ─── Slice 7: SpecValidator accepts the canonical tasks fixture end-to-end ─
//
// Loads the real fixture and runs the full SpecValidator.validateAll on the
// merged ExtensionSpec. This is the gate that proves the canonical example is
// structurally valid (no invalid field types, no bad chart types, no missing
// hook files — the hooks referenced by the spec must exist on disk).

describe('Slice 7 — SpecValidator accepts the canonical tasks fixture', () => {
  const TASKS_DIR = path.resolve(__dirname, '../../../extensions/tasks');

  it('validates the canonical tasks extension without errors', () => {
    const loaded = SpecLoader.load(path.dirname(TASKS_DIR));
    const tasks = loaded.find((l) => l.spec.name === 'tasks');
    expect(tasks).toBeDefined();

    const result = SpecValidator.validateAll([
      {
        spec: tasks!.spec,
        dir: TASKS_DIR,
        specPath: path.join(TASKS_DIR, 'tasks.extension.spec.yaml'),
      },
    ]);

    // Surface every error for easy debugging if this fails
    if (!result.valid) {
      console.error(
        'Canonical tasks validation errors:\n' +
          result.errors
            .map(
              (e) =>
                `  - [${e.resource ?? '.'}/${e.field ?? '.'}] ${e.message}`,
            )
            .join('\n'),
      );
    }
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('canonical tasks spec uses every new spec-engine-v2 hint at least once', () => {
    const loaded = SpecLoader.load(path.dirname(TASKS_DIR));
    const tasks = loaded.find((l) => l.spec.name === 'tasks');
    expect(tasks).toBeDefined();

    const allFields = tasks!.spec.resources.flatMap((r) => r.fields);
    const allUi = allFields.map((f) => f.ui ?? {});

    // New UI hints
    expect(allUi.some((u) => u.section !== undefined)).toBe(true);
    expect(allUi.some((u) => u.showIf !== undefined)).toBe(true);
    expect(allUi.some((u) => u.cols !== undefined)).toBe(true);
    expect(allUi.some((u) => u.order !== undefined)).toBe(true);
    expect(allUi.some((u) => u.placeholder !== undefined)).toBe(true);
    expect(allUi.some((u) => u.helpText !== undefined)).toBe(true);
    expect(allUi.some((u) => u.multiple === true)).toBe(true);
    expect(allUi.some((u) => u.accept !== undefined)).toBe(true);

    // New field types
    expect(
      allFields.some((f) => f.type === 'password' || f.type === 'secret'),
    ).toBe(true);

    // New formInput values
    expect(allUi.some((u) => u.formInput === 'switch')).toBe(true);
    expect(allUi.some((u) => u.formInput === 'stepper')).toBe(true);

    // New ResourceUISpec groupings
    const task = tasks!.spec.resources.find((r) => r.name === 'task');
    expect(task!.ui?.sections).toBeDefined();
    expect(task!.ui?.steps).toBeDefined();

    // New view + kanban + list
    expect(tasks!.spec.resources.some((r) => r.ui?.view === 'kanban')).toBe(
      true,
    );
    expect(tasks!.spec.resources.some((r) => r.ui?.view === 'list')).toBe(true);

    // New ChartType table + list + custom view
    const charts = tasks!.spec
      .views!.flatMap((v) => v.panels ?? [])
      .map((p) => p.chart);
    expect(charts).toContain('table');
    expect(charts).toContain('list');
    expect(tasks!.spec.views!.some((v) => v.type === 'custom')).toBe(true);
  });
});
