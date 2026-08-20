/**
 * TDD tests for EmbedService (PRD 06).
 *
 * REQ-10: EmbedService supports openai + ollama + local providers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { EmbedService } from '@src/core/spec-engine/embed-service';

function makeConfigService(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    EMBED_PROVIDER: 'openai',
    OPENAI_API_KEY: 'test-key',
    OLLAMA_URL: 'http://localhost:11434',
    ...overrides,
  };
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('EmbedService (PRD 06 — REQ-10)', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should call OpenAI API for provider openai', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      }),
    } as Response;
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const service = new EmbedService(makeConfigService());
    const result = await service.embed('hello', 'text-embedding-3-small');

    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/embeddings');
    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.input).toBe('hello');
    expect(body.model).toBe('text-embedding-3-small');
  });

  it('should include Authorization header with OPENAI_API_KEY', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ data: [{ embedding: [0.5] }] }),
    } as Response;
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const service = new EmbedService(
      makeConfigService({ OPENAI_API_KEY: 'secret-key-123' }),
    );
    await service.embed('text', 'model');

    const opts = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = opts.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer secret-key-123');
  });

  it('should throw when OPENAI_API_KEY is not configured', async () => {
    const service = new EmbedService(
      makeConfigService({ OPENAI_API_KEY: undefined }),
    );
    await expect(service.embed('text', 'model', 'openai')).rejects.toThrow(
      'OPENAI_API_KEY not configured',
    );
  });

  it('should call Ollama API for provider ollama', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ embedding: [0.4, 0.5, 0.6] }),
    } as Response;
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const service = new EmbedService(
      makeConfigService({ EMBED_PROVIDER: 'ollama' }),
    );
    const result = await service.embed('hello', 'llama2', 'ollama');

    expect(result).toEqual([0.4, 0.5, 0.6]);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('http://localhost:11434/api/embeddings');
    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body.prompt).toBe('hello');
    expect(body.model).toBe('llama2');
  });

  it('should use OLLAMA_URL config when set', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ embedding: [0.1] }),
    } as Response;
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const service = new EmbedService(
      makeConfigService({
        OLLAMA_URL: 'http://my-ollama:8080',
        EMBED_PROVIDER: 'ollama',
      }),
    );
    await service.embed('text', 'model', 'ollama');

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toBe('http://my-ollama:8080/api/embeddings');
  });

  it('should use default provider from config when provider omitted', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1] }] }),
    } as Response;
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const service = new EmbedService(
      makeConfigService({ EMBED_PROVIDER: 'openai' }),
    );
    await service.embed('text', 'model');

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.openai.com/v1/embeddings');
  });

  it('should throw for unknown provider', async () => {
    const service = new EmbedService(makeConfigService());
    await expect(service.embed('text', 'model', 'cohere')).rejects.toThrow(
      'Unknown embed provider: cohere',
    );
  });

  it('should return pseudo-embedding for local provider (stub)', async () => {
    const service = new EmbedService(
      makeConfigService({ EMBED_PROVIDER: 'local' }),
    );
    const result = await service.embed('test text', 'stub', 'local');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1536);
    // All values should be numbers (stub is deterministic, not semantically meaningful)
    for (const v of result) {
      expect(typeof v).toBe('number');
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('should throw on OpenAI API error response', async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({}),
    } as Response;
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(mockResponse) as unknown as typeof globalThis.fetch;

    const service = new EmbedService(makeConfigService());
    await expect(service.embed('text', 'model', 'openai')).rejects.toThrow(
      'OpenAI embeddings API error: 401',
    );
  });

  it('should throw on Ollama API error response', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    } as Response;
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(mockResponse) as unknown as typeof globalThis.fetch;

    const service = new EmbedService(
      makeConfigService({ EMBED_PROVIDER: 'ollama' }),
    );
    await expect(service.embed('text', 'model', 'ollama')).rejects.toThrow(
      'Ollama embeddings API error: 500',
    );
  });
});