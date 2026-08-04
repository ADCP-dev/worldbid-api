/**
 * SpecQueryBuilder — TDD tests for BUG #3.
 *
 *   query.resource is a RESOURCE NAME (e.g. 'task'), not a table name.
 *   The builder must resolve resource → table via a resourceMap so dashboards
 *   that pass `resource: task` hit `FROM "ext_tasks_task"`, not `FROM "task"`.
 *
 *   Backward-compat: when no resourceMap is passed, the old behavior
 *   (treat query.resource as the table name) is preserved so existing tests
 *   and direct callers keep working.
 */

import { SpecQueryBuilder } from '@src/core/spec-engine/query-builder';
import type { ResourceSpec } from '@src/core/spec-engine/spec.types';

function makeResourceMap(): Map<string, ResourceSpec> {
  const task: ResourceSpec = {
    name: 'task',
    table: 'ext_tasks_task',
    fields: [],
  };
  const taskActivity: ResourceSpec = {
    name: 'task-activity',
    table: 'ext_tasks_task_activity',
    fields: [],
  };
  return new Map([
    ['task', task],
    ['task-activity', taskActivity],
  ]);
}

// A minimal fake repository — SpecQueryBuilder only uses it as a passthrough.
const fakeRepo = {} as import('typeorm').Repository<any>;

describe('SpecQueryBuilder — resource name → table resolution (BUG #3)', () => {
  it('resolves resource "task" to table "ext_tasks_task" when resourceMap given', () => {
    const result = SpecQueryBuilder.build(
      { resource: 'task', aggregate: 'count' },
      fakeRepo,
      makeResourceMap(),
    );
    expect(result.sql).toContain('FROM "ext_tasks_task"');
    expect(result.sql).not.toContain('FROM "task"');
  });

  it('resolves resource "task-activity" to its table name', () => {
    const result = SpecQueryBuilder.build(
      { resource: 'task-activity', aggregate: 'count' },
      fakeRepo,
      makeResourceMap(),
    );
    expect(result.sql).toContain('FROM "ext_tasks_task_activity"');
  });

  it('falls back to query.resource verbatim when resourceMap is omitted (back-compat)', () => {
    // Old behavior: resource string IS the table name.
    const result = SpecQueryBuilder.build(
      { resource: 'ext_tasks_task', aggregate: 'count' },
      fakeRepo,
    );
    expect(result.sql).toContain('FROM "ext_tasks_task"');
  });

  it('falls back to query.resource when resourceMap has no matching resource', () => {
    const result = SpecQueryBuilder.build(
      { resource: 'unknown_resource', aggregate: 'count' },
      fakeRepo,
      makeResourceMap(),
    );
    // No match → use query.resource as-is (validated as an identifier).
    expect(result.sql).toContain('FROM "unknown_resource"');
  });

  it('group-by query still uses resolved table for the FROM clause', () => {
    const result = SpecQueryBuilder.build(
      {
        resource: 'task',
        aggregate: 'count',
        groupBy: 'status',
      },
      fakeRepo,
      makeResourceMap(),
    );
    expect(result.sql).toContain('FROM "ext_tasks_task"');
    expect(result.sql).toContain('GROUP BY "status"');
  });

  it('filter expression uses the resolved table alias-free column refs', () => {
    const result = SpecQueryBuilder.build(
      {
        resource: 'task',
        aggregate: 'count',
        filter: 'priority == urgent && status != done',
      },
      fakeRepo,
      makeResourceMap(),
    );
    expect(result.sql).toContain('FROM "ext_tasks_task"');
    expect(result.sql).toMatch(/"priority" = \$1/);
    expect(result.params).toContain('urgent');
  });
});