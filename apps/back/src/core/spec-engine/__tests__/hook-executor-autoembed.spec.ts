/**
 * TDD tests for HookExecutor autoEmbed (PRD 06).
 *
 * REQ-07: autoEmbed afterCreate — generate embedding, update entity, fail gracefully
 * REQ-08: autoEmbed afterUpdate — only regenerate if source field changed
 */
import { describe, it, expect, vi } from 'vitest';
import { HookExecutor } from '@src/core/spec-engine/hook-executor';
import type {
  ResourceSpec,
  VectorFieldSpec,
  HookContext,
  TraceWriter,
} from '@src/core/spec-engine/spec.types';
import type { TraceBuilder } from '@src/core/spec-engine/spec-trace';

function makeResource(autoEmbed?: VectorFieldSpec['autoEmbed']): ResourceSpec {
  return {
    name: 'kb-article',
    table: 'ext_test_kb_article',
    fields: [
      { name: 'title', type: 'string' },
      { name: 'content', type: 'text' },
      {
        name: 'embedding',
        type: 'vector',
        dimensions: 1536,
        autoEmbed,
      },
    ],
  };
}

function makeCtx(overrides: Partial<HookContext> = {}): HookContext {
  const updateMock = vi.fn().mockResolvedValue(undefined);
  const repoMock = { update: updateMock } as any;
  return {
    operation: 'create',
    resource: 'kb-article',
    user: null,
    getRepository: () => repoMock,
    getService: () => ({}) as any,
    config: () => ({}) as any,
    sendEmail: async () => {},
    logError: async () => {},
    logger: {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
      fatal: vi.fn(),
      setLogLevels: vi.fn(),
      localInstance: undefined,
    } as any,
    trace: { add: vi.fn(), isActive: () => false } as TraceWriter,
    abort: () => {
      throw new Error('abort');
    },
    transaction: async (fn) => fn({} as any),
    embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    ...overrides,
  } as HookContext;
}

function makeTraceBuilder(): TraceBuilder {
  return {
    startStage: vi.fn(),
    endStage: vi.fn(),
    skipStage: vi.fn(),
    getRequestId: () => 'test-req',
  } as unknown as TraceBuilder;
}

describe('HookExecutor — autoEmbed afterCreate (PRD 06 — REQ-07)', () => {
  it('should generate embedding and update entity when autoEmbed is set', async () => {
    const resource = makeResource({
      source: 'content',
      model: 'text-embedding-3-small',
      provider: 'openai',
    });
    const ctx = makeCtx();
    const executor = new HookExecutor();
    const trace = makeTraceBuilder();

    // Call executeAfterHook with no manual hook + resource param
    // We need to call the autoEmbed path — executeAfterHook accepts optional resource
    await executor.executeAutoEmbed(
      { id: 1, content: 'hello world' },
      ctx,
      resource,
    );

    expect(ctx.embed).toHaveBeenCalledWith(
      'hello world',
      'text-embedding-3-small',
      'openai',
    );
    // Repository update called with the embedding
    const repo = ctx.getRepository('kb-article');
    expect(repo.update).toHaveBeenCalledWith(1, {
      embedding: [0.1, 0.2, 0.3],
    });
  });

  it('should NOT generate embedding when source field is null/empty', async () => {
    const resource = makeResource({
      source: 'content',
      model: 'text-embedding-3-small',
      provider: 'openai',
    });
    const ctx = makeCtx();
    const executor = new HookExecutor();

    await executor.executeAutoEmbed({ id: 1, content: null }, ctx, resource);

    expect(ctx.embed).not.toHaveBeenCalled();
  });

  it('should NOT generate embedding when no autoEmbed is configured', async () => {
    const resource = makeResource();
    const ctx = makeCtx();
    const executor = new HookExecutor();

    await executor.executeAutoEmbed({ id: 1, content: 'hello' }, ctx, resource);

    expect(ctx.embed).not.toHaveBeenCalled();
  });

  it('should NOT fail the create when embed fails — log + queue retry', async () => {
    const resource = makeResource({
      source: 'content',
      model: 'text-embedding-3-small',
      provider: 'openai',
    });
    const queueAdd = vi.fn().mockResolvedValue(undefined);
    const ctx = makeCtx({
      embed: vi.fn().mockRejectedValue(new Error('API down')),
      queue: { add: queueAdd } as any,
    });
    const executor = new HookExecutor();

    // Should NOT throw
    await executor.executeAutoEmbed(
      { id: 42, content: 'hello' },
      ctx,
      resource,
    );

    expect(ctx.logger.warn).toHaveBeenCalled();
    // Queue retry should be enqueued
    expect(queueAdd).toHaveBeenCalledWith(
      'embed-retry',
      expect.objectContaining({
        resourceId: 42,
        resource: 'kb-article',
        field: 'embedding',
        source: 'content',
      }),
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      }),
    );
  });

  it('should NOT fail the create when embed fails and no queue available — just log', async () => {
    const resource = makeResource({
      source: 'content',
      model: 'text-embedding-3-small',
      provider: 'openai',
    });
    const ctx = makeCtx({
      embed: vi.fn().mockRejectedValue(new Error('API down')),
    });
    const executor = new HookExecutor();

    // Should NOT throw
    await expect(
      executor.executeAutoEmbed({ id: 1, content: 'hello' }, ctx, resource),
    ).resolves.toBeUndefined();

    expect(ctx.logger.warn).toHaveBeenCalled();
  });
});

describe('HookExecutor — autoEmbed afterUpdate (PRD 06 — REQ-08)', () => {
  it('should regenerate embedding when source field changed', async () => {
    const resource = makeResource({
      source: 'content',
      model: 'text-embedding-3-small',
      provider: 'openai',
    });
    const ctx = makeCtx();
    const executor = new HookExecutor();

    await executor.executeAutoEmbedOnUpdate(
      { id: 1, content: 'new content' },
      ctx,
      resource,
      { content: 'new content' },
    );

    expect(ctx.embed).toHaveBeenCalledWith(
      'new content',
      'text-embedding-3-small',
      'openai',
    );
  });

  it('should NOT regenerate embedding when source field did not change', async () => {
    const resource = makeResource({
      source: 'content',
      model: 'text-embedding-3-small',
      provider: 'openai',
    });
    const ctx = makeCtx();
    const executor = new HookExecutor();

    await executor.executeAutoEmbedOnUpdate(
      { id: 1, content: 'old content' },
      ctx,
      resource,
      { title: 'new title' }, // title changed, not content
    );

    expect(ctx.embed).not.toHaveBeenCalled();
  });

  it('should NOT regenerate embedding when changes is undefined', async () => {
    const resource = makeResource({
      source: 'content',
      model: 'text-embedding-3-small',
      provider: 'openai',
    });
    const ctx = makeCtx();
    const executor = new HookExecutor();

    await executor.executeAutoEmbedOnUpdate(
      { id: 1, content: 'content' },
      ctx,
      resource,
      undefined,
    );

    expect(ctx.embed).not.toHaveBeenCalled();
  });
});
