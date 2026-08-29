/**
 * TDD tests for SpecValidator vector field validation (PRD 06).
 *
 * REQ-01: vector without dimensions = error
 * REQ-02: autoEmbed without source = error, source nonexistent = error
 */
import { describe, it, expect } from 'vitest';
import { SpecValidator } from '@src/core/spec-engine/spec-validator';
import type {
  ExtensionSpec,
  ResourceSpec,
  VectorFieldSpec,
} from '@src/core/spec-engine/spec.types';

function makeSpec(fields: any[]): ResourceSpec {
  return {
    name: 'kb-article',
    table: 'ext_test_kb_article',
    fields,
  };
}

function makeLoaded(spec: ResourceSpec) {
  return {
    spec: {
      name: 'test-ext',
      version: '1.0.0',
      resources: [spec],
    } as ExtensionSpec,
    dir: '/tmp/test',
    specPath: '/tmp/test/test.spec.yaml',
  };
}

describe('SpecValidator — vector field validation (PRD 06)', () => {
  it('should accept vector as a valid field type', () => {
    const spec = makeSpec([
      { name: 'embedding', type: 'vector', dimensions: 1536 },
    ]);
    const result = SpecValidator.validateAll([makeLoaded(spec)]);

    const typeErrors = result.errors.filter(
      (e) =>
        e.field === 'embedding' && e.message.includes('Invalid field type'),
    );
    expect(typeErrors).toHaveLength(0);
  });

  it('should reject vector field without dimensions', () => {
    const spec = makeSpec([
      { name: 'embedding', type: 'vector' }, // no dimensions
    ]);
    const result = SpecValidator.validateAll([makeLoaded(spec)]);

    expect(
      result.errors.some(
        (e) => e.field === 'embedding' && e.message.includes('dimensions'),
      ),
    ).toBe(true);
  });

  it('should reject vector field with zero dimensions', () => {
    const spec = makeSpec([
      { name: 'embedding', type: 'vector', dimensions: 0 },
    ]);
    const result = SpecValidator.validateAll([makeLoaded(spec)]);

    expect(
      result.errors.some(
        (e) => e.field === 'embedding' && e.message.includes('dimensions'),
      ),
    ).toBe(true);
  });

  it('should reject vector field with negative dimensions', () => {
    const spec = makeSpec([
      { name: 'embedding', type: 'vector', dimensions: -5 },
    ]);
    const result = SpecValidator.validateAll([makeLoaded(spec)]);

    expect(
      result.errors.some(
        (e) => e.field === 'embedding' && e.message.includes('dimensions'),
      ),
    ).toBe(true);
  });

  it('should reject autoEmbed without source field', () => {
    const spec = makeSpec([
      {
        name: 'embedding',
        type: 'vector',
        dimensions: 1536,
        autoEmbed: {
          model: 'text-embedding-3-small',
          provider: 'openai',
        } as any,
      },
    ]);
    const result = SpecValidator.validateAll([makeLoaded(spec)]);

    expect(
      result.errors.some(
        (e) => e.message.includes('autoEmbed') && e.message.includes('source'),
      ),
    ).toBe(true);
  });

  it('should reject autoEmbed with source referencing nonexistent field', () => {
    const spec = makeSpec([
      { name: 'title', type: 'string' },
      {
        name: 'embedding',
        type: 'vector',
        dimensions: 1536,
        autoEmbed: {
          source: 'nonexistent',
          model: 'text-embedding-3-small',
          provider: 'openai',
        },
      },
    ]);
    const result = SpecValidator.validateAll([makeLoaded(spec)]);

    expect(
      result.errors.some(
        (e) =>
          e.message.includes('autoEmbed') && e.message.includes('nonexistent'),
      ),
    ).toBe(true);
  });

  it('should reject autoEmbed without model', () => {
    const spec = makeSpec([
      { name: 'content', type: 'text' },
      {
        name: 'embedding',
        type: 'vector',
        dimensions: 1536,
        autoEmbed: { source: 'content', provider: 'openai' } as any,
      },
    ]);
    const result = SpecValidator.validateAll([makeLoaded(spec)]);

    expect(
      result.errors.some(
        (e) => e.message.includes('autoEmbed') && e.message.includes('model'),
      ),
    ).toBe(true);
  });

  it('should reject autoEmbed with invalid provider', () => {
    const spec = makeSpec([
      { name: 'content', type: 'text' },
      {
        name: 'embedding',
        type: 'vector',
        dimensions: 1536,
        autoEmbed: { source: 'content', model: 'x', provider: 'cohere' as any },
      },
    ]);
    const result = SpecValidator.validateAll([makeLoaded(spec)]);

    expect(
      result.errors.some(
        (e) =>
          e.message.includes('autoEmbed') && e.message.includes('provider'),
      ),
    ).toBe(true);
  });

  it('should accept valid vector field with autoEmbed', () => {
    const spec = makeSpec([
      { name: 'content', type: 'text' },
      {
        name: 'embedding',
        type: 'vector',
        dimensions: 1536,
        autoEmbed: {
          source: 'content',
          model: 'text-embedding-3-small',
          provider: 'openai',
        },
      },
    ]);
    const result = SpecValidator.validateAll([makeLoaded(spec)]);

    const vectorErrors = result.errors.filter((e) => e.field === 'embedding');
    expect(vectorErrors).toHaveLength(0);
  });

  it('should accept vector field without autoEmbed', () => {
    const spec = makeSpec([
      { name: 'embedding', type: 'vector', dimensions: 384 },
    ]);
    const result = SpecValidator.validateAll([makeLoaded(spec)]);

    const vectorErrors = result.errors.filter((e) => e.field === 'embedding');
    expect(vectorErrors).toHaveLength(0);
  });
});
