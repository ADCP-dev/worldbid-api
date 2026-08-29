/**
 * EntityFactory — TDD tests for runtime bug fixes.
 *
 * Covers:
 *   - BUG #2: ref field target must use `field.ref` verbatim (lowercase 'user'),
 *     NOT capitalized 'User'. UserEntity is `@Entity({ name: 'user' })`.
 *   - BUG #13/#14: computed fields produce NO column entry.
 */

import { EntityFactory } from '@src/core/spec-engine/entity-factory';
import type { ResourceSpec } from '@src/core/spec-engine/spec.types';

describe('EntityFactory — ref target resolution (BUG #2)', () => {
  const baseSpec = (fields: ResourceSpec['fields']): ResourceSpec => ({
    name: 'demo',
    table: 'ext_demo_main',
    fields,
    timestamps: false,
    softDelete: false,
  });

  it('ref field to user resolves target as lowercase "user" (not "User")', () => {
    const spec = baseSpec([{ name: 'assigneeId', type: 'ref', ref: 'user' }]);

    const result = EntityFactory.create(spec, new Map());

    const options = result.mainSchema.options as any;
    const assigneeRelation = options.relations.assignee;
    expect(assigneeRelation).toBeDefined();
    // The target must be a function returning the entity name string.
    // UserEntity is @Entity({ name: 'user' }) — lowercase.
    const target = (assigneeRelation.target as () => string)();
    expect(target).toBe('user');
    expect(target).not.toBe('User');
  });

  it('ref field to another spec resource uses field.ref verbatim', () => {
    const spec = baseSpec([{ name: 'taskId', type: 'ref', ref: 'task' }]);

    const result = EntityFactory.create(spec, new Map());

    const options = result.mainSchema.options as any;
    const target = (options.relations.task.target as () => string)();
    expect(target).toBe('task');
  });

  it('many-to-many ref to user resolves target as lowercase "user"', () => {
    const spec = baseSpec([
      { name: 'tags', type: 'many-to-many', ref: 'user' },
    ]);

    const result = EntityFactory.create(spec, new Map(), 'demo');

    // The join table relation targeting 'user' must be lowercase.
    const joinOptions = result.joinTableSchemas[0].options as any;
    const userRelationKey = Object.keys(joinOptions.relations).find(
      (k) => k !== 'demo',
    );
    expect(userRelationKey).toBeDefined();
    const target = (
      joinOptions.relations[userRelationKey!].target as () => string
    )();
    expect(target).toBe('user');
    expect(target).not.toBe('User');
  });

  it('join table composite PK uses ref verbatim for relation target', () => {
    const spec = baseSpec([
      { name: 'taskId', type: 'ref', ref: 'task' },
      { name: 'userId', type: 'ref', ref: 'user' },
    ]);

    const result = EntityFactory.create(spec, new Map());

    const options = result.mainSchema.options as any;
    expect((options.relations.task.target as () => string)()).toBe('task');
    expect((options.relations.user.target as () => string)()).toBe('user');
  });
});

describe('EntityFactory — computed field no column (BUG #13/#14)', () => {
  const baseSpec = (fields: ResourceSpec['fields']): ResourceSpec => ({
    name: 'demo',
    table: 'ext_demo_main',
    fields,
    timestamps: false,
    softDelete: false,
  });

  it('computed field produces NO column entry on the main table', () => {
    const spec = baseSpec([
      { name: 'title', type: 'string' },
      { name: 'fullName', type: 'computed' },
    ]);

    const result = EntityFactory.create(spec, new Map());

    const options = result.mainSchema.options as any;
    expect(options.columns).toBeDefined();
    // 'fullName' must NOT be a stored column — computed fields are virtual.
    expect(options.columns).not.toHaveProperty('fullName');
    // Sanity: real column IS present.
    expect(options.columns).toHaveProperty('title');
  });

  it('mix of computed + stored fields only stores non-computed', () => {
    const spec = baseSpec([
      { name: 'status', type: 'enum', enum: ['open', 'closed'] },
      { name: 'progressLabel', type: 'computed' },
      { name: 'priority', type: 'string' },
      { name: 'derivedScore', type: 'computed' },
    ]);

    const result = EntityFactory.create(spec, new Map());

    const options = result.mainSchema.options as any;
    expect(Object.keys(options.columns)).not.toContain('progressLabel');
    expect(Object.keys(options.columns)).not.toContain('derivedScore');
    expect(Object.keys(options.columns)).toContain('status');
    expect(Object.keys(options.columns)).toContain('priority');
  });
});
