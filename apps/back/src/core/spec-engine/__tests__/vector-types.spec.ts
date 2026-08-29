/**
 * TDD tests for VectorFieldSpec + AutoEmbedSpec types (PRD 06).
 *
 * REQ-01: VectorFieldSpec extends FieldSpec with vector-specific props
 * REQ-02: AutoEmbedSpec declares source, model, provider
 * REQ-09: HookContext exposes embed() + queue?
 */
import { describe, it, expect } from 'vitest';
import type {
  FieldType,
  FieldSpec,
  VectorFieldSpec,
  AutoEmbedSpec,
  HookContext,
} from '@src/core/spec-engine/spec.types';

describe('VectorFieldSpec (PRD 06 — REQ-01)', () => {
  it('should accept vector in the FieldType union', () => {
    const type: FieldType = 'vector';
    expect(type).toBe('vector');
  });

  it('should extend FieldSpec with vector-specific properties', () => {
    const field: VectorFieldSpec = {
      name: 'embedding',
      type: 'vector',
      dimensions: 1536,
      index: true,
      indexType: 'hnsw',
      indexParams: { m: 16, efConstruction: 64 },
      nullable: true,
      autoEmbed: {
        source: 'content',
        model: 'text-embedding-3-small',
        provider: 'openai',
      },
    };

    expect(field.name).toBe('embedding');
    expect(field.type).toBe('vector');
    expect(field.dimensions).toBe(1536);
    expect(field.index).toBe(true);
    expect(field.indexType).toBe('hnsw');
    expect(field.indexParams?.m).toBe(16);
    expect(field.indexParams?.efConstruction).toBe(64);
    expect(field.nullable).toBe(true);
  });

  it('should satisfy FieldSpec assignability (extends FieldSpec)', () => {
    const vectorField: VectorFieldSpec = {
      name: 'embedding',
      type: 'vector',
      dimensions: 1536,
    };
    // VectorFieldSpec extends FieldSpec → assignable
    const asFieldSpec: FieldSpec = vectorField;
    expect(asFieldSpec.type).toBe('vector');
  });

  it('should allow minimal vector field with only required props', () => {
    const field: VectorFieldSpec = {
      name: 'embedding',
      type: 'vector',
      dimensions: 384,
    };
    expect(field.index).toBeUndefined();
    expect(field.indexType).toBeUndefined();
    expect(field.autoEmbed).toBeUndefined();
  });

  it('should support ivfflat indexType', () => {
    const field: VectorFieldSpec = {
      name: 'embedding',
      type: 'vector',
      dimensions: 1536,
      index: true,
      indexType: 'ivfflat',
      indexParams: { lists: 100 },
    };
    expect(field.indexType).toBe('ivfflat');
    expect(field.indexParams?.lists).toBe(100);
  });
});

describe('AutoEmbedSpec (PRD 06 — REQ-02)', () => {
  it('should declare source, model, provider', () => {
    const autoEmbed: AutoEmbedSpec = {
      source: 'content',
      model: 'text-embedding-3-small',
      provider: 'openai',
    };
    expect(autoEmbed.source).toBe('content');
    expect(autoEmbed.model).toBe('text-embedding-3-small');
    expect(autoEmbed.provider).toBe('openai');
  });

  it('should support ollama provider', () => {
    const autoEmbed: AutoEmbedSpec = {
      source: 'description',
      model: 'llama2',
      provider: 'ollama',
    };
    expect(autoEmbed.provider).toBe('ollama');
  });

  it('should support local provider', () => {
    const autoEmbed: AutoEmbedSpec = {
      source: 'title',
      model: 'stub',
      provider: 'local',
    };
    expect(autoEmbed.provider).toBe('local');
  });
});

describe('HookContext embed + queue (PRD 06 — REQ-09)', () => {
  it('should include embed method in HookContext interface', () => {
    // Type-level test: HookContext must have embed
    const ctx: HookContext = {
      operation: 'create',
      resource: 'article',
      user: null,
      getRepository: () => ({}) as any,
      getService: () => ({}) as any,
      config: () => ({}) as any,
      sendEmail: async () => {},
      logError: async () => {},
      logger: {} as any,
      trace: { add: () => {}, isActive: () => false },
      abort: () => {
        throw new Error('abort');
      },
      transaction: async (fn) => fn({} as any),
      embed: async (text: string, _model: string) => {
        expect(text).toBe('hello');
        return [0.1, 0.2, 0.3];
      },
    };

    expect(typeof ctx.embed).toBe('function');
  });

  it('should include optional queue in HookContext interface', () => {
    const ctx: HookContext = {
      operation: 'create',
      resource: 'article',
      user: null,
      getRepository: () => ({}) as any,
      getService: () => ({}) as any,
      config: () => ({}) as any,
      sendEmail: async () => {},
      logError: async () => {},
      logger: {} as any,
      trace: { add: () => {}, isActive: () => false },
      abort: () => {
        throw new Error('abort');
      },
      transaction: async (fn) => fn({} as any),
      embed: async () => [0.1],
      queue: {
        add: async (name: string) => {
          expect(name).toBe('embed-retry');
        },
      },
    };

    expect(ctx.queue).toBeDefined();
    expect(typeof ctx.queue?.add).toBe('function');
  });

  it('should allow HookContext without queue (optional)', () => {
    const ctx: HookContext = {
      operation: 'create',
      resource: 'article',
      user: null,
      getRepository: () => ({}) as any,
      getService: () => ({}) as any,
      config: () => ({}) as any,
      sendEmail: async () => {},
      logError: async () => {},
      logger: {} as any,
      trace: { add: () => {}, isActive: () => false },
      abort: () => {
        throw new Error('abort');
      },
      transaction: async (fn) => fn({} as any),
      embed: async () => [0.1],
    };

    expect(ctx.queue).toBeUndefined();
  });
});
