/**
 * Regression tests for C (join-table name mismatch), D (validation gate),
 * and G (single extension module loader).
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { EntityFactory } from '@src/core/spec-engine/entity-factory';
import { joinTableName } from '@src/core/spec-engine/naming';
import type { ResourceSpec, FieldSpec } from '@src/core/spec-engine/spec.types';
import {
  resolveExtensionModulePath,
  resolveHookModulePath,
  extractModuleExport,
} from '@src/core/spec-engine/extension-module-loader';

// ─── C. Join-table naming ────────────────────────────────────────────────────

describe('joinTableName — single shared derivation (C)', () => {
  const spec: ResourceSpec = {
    name: 'task',
    table: 'ext_tasks_task',
    fields: [
      {
        name: 'tags',
        type: 'many-to-many',
        ref: 'tag',
      } as FieldSpec,
    ],
  };
  const field = spec.fields[0];

  it('should derive ext_<extension>_<resource>_<field> with the ext_ prefix applied once', () => {
    expect(joinTableName('tasks', spec, field)).toBe('ext_tasks_task_tags');
  });

  it('should NOT duplicate the prefix (old controller lookup bug)', () => {
    const name = joinTableName('tasks', spec, field);
    // Old buggy code produced ext_tasks_ext_tasks_task_tags.
    expect(name.startsWith('ext_tasks_ext_')).toBe(false);
    expect(name.match(/ext_/g)?.length).toBe(1);
  });

  it('should derive ext_<resource>_<field> when the extension name is missing', () => {
    expect(joinTableName(undefined, spec, field)).toBe('ext_task_tags');
  });

  it('should honor an explicit field.joinTable override', () => {
    const explicitField: FieldSpec = {
      ...field,
      joinTable: 'my_custom_join_table',
    };
    expect(joinTableName('tasks', spec, explicitField)).toBe(
      'my_custom_join_table',
    );
  });

  it('should make EntityFactory.create use the same name as the helper', () => {
    const { joinTableSchemas } = EntityFactory.create(spec, new Map(), 'tasks');
    expect(joinTableSchemas[0].options.tableName).toBe(
      joinTableName('tasks', spec, field),
    );
    expect(joinTableSchemas[0].options.tableName).toBe('ext_tasks_task_tags');
  });
});

// ─── G. Extension module loader ─────────────────────────────────────────────

describe('extension-module-loader (G)', () => {
  const ORIGINAL_ENV = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_ENV;
  });

  describe('resolveExtensionModulePath', () => {
    it('resolves .ts directly in development', () => {
      process.env.NODE_ENV = 'development';
      expect(resolveExtensionModulePath('/ext/tasks/hooks/before.ts')).toBe(
        '/ext/tasks/hooks/before.ts',
      );
    });

    it('rewrites .ts to .js in production', () => {
      process.env.NODE_ENV = 'production';
      expect(resolveExtensionModulePath('/ext/tasks/hooks/before.ts')).toBe(
        '/ext/tasks/hooks/before.js',
      );
    });

    it('leaves non-.ts paths untouched in production', () => {
      process.env.NODE_ENV = 'production';
      expect(resolveExtensionModulePath('/ext/tasks/hooks/before.js')).toBe(
        '/ext/tasks/hooks/before.js',
      );
    });
  });

  describe('resolveHookModulePath (containment)', () => {
    const extensionDir = '/app/src/extensions/tasks';

    it('accepts a path inside the extension directory (dev)', () => {
      process.env.NODE_ENV = 'development';
      expect(
        resolveHookModulePath(
          '/app/src/extensions/tasks/hooks/a.ts',
          extensionDir,
        ),
      ).toBe('/app/src/extensions/tasks/hooks/a.ts');
    });

    it('rejects a path escaping the extension directory', () => {
      process.env.NODE_ENV = 'development';
      expect(
        resolveHookModulePath(
          '/app/src/extensions/other/hooks/a.ts',
          extensionDir,
        ),
      ).toBeNull();
      expect(resolveHookModulePath('/etc/passwd', extensionDir)).toBeNull();
    });

    it('applies .ts→.js in production while keeping containment', () => {
      process.env.NODE_ENV = 'production';
      expect(
        resolveHookModulePath(
          '/app/src/extensions/tasks/hooks/a.ts',
          extensionDir,
        ),
      ).toBe('/app/src/extensions/tasks/hooks/a.js');
    });
  });

  describe('extractModuleExport', () => {
    it('extracts the default export when present', () => {
      const fn = () => 1;
      expect(extractModuleExport({ default: fn })).toBe(fn);
    });

    it('returns the module itself when there is no default export', () => {
      const mod = { foo: 1 };
      expect(extractModuleExport(mod)).toBe(mod);
    });

    it('returns primitives unchanged', () => {
      expect(extractModuleExport(42)).toBe(42);
    });
  });
});

// Silence unused-import warning for vi when not used by a test above.
void vi;
