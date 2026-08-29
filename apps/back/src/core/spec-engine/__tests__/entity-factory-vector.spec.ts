/**
 * TDD tests for EntityFactory vector column support (PRD 06).
 *
 * REQ-03: EntityFactory creates a vector column with transformer.
 */
import { describe, it, expect } from 'vitest';
import { EntitySchema } from 'typeorm';
import { EntityFactory } from '@src/core/spec-engine/entity-factory';
import type {
  ResourceSpec,
  VectorFieldSpec,
} from '@src/core/spec-engine/spec.types';

function makeVectorResource(
  field: Partial<VectorFieldSpec> = {},
): ResourceSpec {
  return {
    name: 'kb-article',
    table: 'ext_test_kb_article',
    fields: [
      { name: 'title', type: 'string', required: true },
      {
        name: 'embedding',
        type: 'vector',
        dimensions: 1536,
        ...field,
      },
    ],
  };
}

describe('EntityFactory — vector column (PRD 06 — REQ-03)', () => {
  it('should create an EntitySchema with a vector column', () => {
    const spec = makeVectorResource();
    const result = EntityFactory.create(spec);

    const columns = (result.mainSchema.options as any).columns;
    expect(columns.embedding).toBeDefined();
    expect(columns.embedding.type).toBe('vector');
  });

  it('should default nullable to true for vector fields', () => {
    const spec = makeVectorResource();
    const result = EntityFactory.create(spec);

    const columns = (result.mainSchema.options as any).columns;
    expect(columns.embedding.nullable).toBe(true);
  });

  it('should respect nullable: false when explicitly set', () => {
    const spec = makeVectorResource({ nullable: false });
    const result = EntityFactory.create(spec);

    const columns = (result.mainSchema.options as any).columns;
    expect(columns.embedding.nullable).toBe(false);
  });

  it('should include a transformer that converts array to pgvector string', () => {
    const spec = makeVectorResource();
    const result = EntityFactory.create(spec);

    const transformer = (result.mainSchema.options as any).columns.embedding
      .transformer;
    expect(transformer).toBeDefined();
    expect(typeof transformer.to).toBe('function');
    expect(typeof transformer.from).toBe('function');
  });

  it('should transform number[] to pgvector string "[1,2,3]"', () => {
    const spec = makeVectorResource();
    const result = EntityFactory.create(spec);

    const transformer = (result.mainSchema.options as any).columns.embedding
      .transformer;
    expect(transformer.to([0.1, 0.2, 0.3])).toBe('[0.1,0.2,0.3]');
  });

  it('should transform null to null on write', () => {
    const spec = makeVectorResource();
    const result = EntityFactory.create(spec);

    const transformer = (result.mainSchema.options as any).columns.embedding
      .transformer;
    expect(transformer.to(null)).toBeNull();
  });

  it('should transform pgvector string "[1,2,3]" to number[]', () => {
    const spec = makeVectorResource();
    const result = EntityFactory.create(spec);

    const transformer = (result.mainSchema.options as any).columns.embedding
      .transformer;
    const result_arr = transformer.from('[0.1,0.2,0.3]');
    expect(Array.isArray(result_arr)).toBe(true);
    expect(result_arr).toHaveLength(3);
    expect(result_arr[0]).toBeCloseTo(0.1);
  });

  it('should transform null to null on read', () => {
    const spec = makeVectorResource();
    const result = EntityFactory.create(spec);

    const transformer = (result.mainSchema.options as any).columns.embedding
      .transformer;
    expect(transformer.from(null)).toBeNull();
  });

  it('should not create a relation for vector fields', () => {
    const spec = makeVectorResource();
    const result = EntityFactory.create(spec);

    const relations = (result.mainSchema.options as any).relations;
    expect(relations).toBeUndefined();
  });

  it('should not break non-vector fields', () => {
    const spec = makeVectorResource();
    const result = EntityFactory.create(spec);

    const columns = (result.mainSchema.options as any).columns;
    expect(columns.title).toBeDefined();
    expect(columns.title.type).toBe(String);
  });

  it('should handle multiple vector fields', () => {
    const spec: ResourceSpec = {
      name: 'multi-vector',
      table: 'ext_test_multi_vector',
      fields: [
        {
          name: 'titleEmbed',
          type: 'vector',
          dimensions: 384,
        },
        {
          name: 'contentEmbed',
          type: 'vector',
          dimensions: 1536,
        },
      ],
    };

    const result = EntityFactory.create(spec);
    const columns = (result.mainSchema.options as any).columns;
    expect(columns.titleEmbed).toBeDefined();
    expect(columns.contentEmbed).toBeDefined();
    expect(columns.titleEmbed.type).toBe('vector');
    expect(columns.contentEmbed.type).toBe('vector');
  });
});
