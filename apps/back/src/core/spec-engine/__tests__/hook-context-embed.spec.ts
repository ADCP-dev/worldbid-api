/**
 * TDD tests for HookContext embed wiring (PRD 06).
 *
 * REQ-09: HookContext.embed delegates to EmbedService via ModuleRef.
 */
import { describe, it, expect, vi } from 'vitest';
import { ModuleRef, ConfigService } from '@nestjs/common';
import { HookContextImpl } from '@src/core/spec-engine/hook-context';
import { EmbedService } from '@src/core/spec-engine/embed-service';
import type {
  AuthenticatedUser,
  TraceWriter,
} from '@src/core/spec-engine/spec.types';

function makeModuleRef(embedService: EmbedService): ModuleRef {
  return {
    get: vi.fn((token: unknown, _opts?: unknown) => {
      if (token === EmbedService) return embedService;
      throw new Error(`unexpected token: ${String(token)}`);
    }),
  } as unknown as ModuleRef;
}

function makeConfigService(): ConfigService {
  return {
    get: vi.fn((key: string) => {
      if (key === 'EMBED_PROVIDER') return 'openai';
      return undefined;
    }),
  } as unknown as ConfigService;
}

function makeTraceWriter(): TraceWriter {
  return { add: vi.fn(), isActive: () => false };
}

describe('HookContextImpl embed (PRD 06 — REQ-09)', () => {
  it('should delegate embed() to EmbedService via ModuleRef', async () => {
    const embedService = new EmbedService(makeConfigService());
    const spy = vi.spyOn(embedService, 'embed').mockResolvedValue([0.1, 0.2]);

    const moduleRef = makeModuleRef(embedService);
    const ctx = new HookContextImpl(
      moduleRef,
      makeConfigService(),
      null,
      'kb-article',
      'create',
      makeTraceWriter(),
    );

    const result = await ctx.embed('hello', 'text-embedding-3-small');

    expect(result).toEqual([0.1, 0.2]);
    expect(spy).toHaveBeenCalledWith(
      'hello',
      'text-embedding-3-small',
      undefined,
    );
  });

  it('should pass provider to embed service when given', async () => {
    const embedService = new EmbedService(makeConfigService());
    const spy = vi.spyOn(embedService, 'embed').mockResolvedValue([0.5]);

    const moduleRef = makeModuleRef(embedService);
    const ctx = new HookContextImpl(
      moduleRef,
      makeConfigService(),
      null,
      'kb-article',
      'create',
      makeTraceWriter(),
    );

    await ctx.embed('text', 'llama2', 'ollama');

    expect(spy).toHaveBeenCalledWith('text', 'llama2', 'ollama');
  });

  it('should throw clear error if EmbedService not registered in DI', async () => {
    const moduleRef: ModuleRef = {
      get: vi.fn(() => {
        throw new Error('not found');
      }),
    } as unknown as ModuleRef;

    const ctx = new HookContextImpl(
      moduleRef,
      makeConfigService(),
      null,
      'kb-article',
      'create',
      makeTraceWriter(),
    );

    await expect(ctx.embed('text', 'model')).rejects.toThrow();
  });
});
