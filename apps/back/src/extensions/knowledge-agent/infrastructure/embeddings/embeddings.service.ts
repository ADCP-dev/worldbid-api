import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * EmbeddingsService — wraps `OllamaEmbeddings` from `@langchain/ollama` (the
 * modern dedicated package, NOT `@langchain/community`).
 *
 * The model + baseUrl are resolved from the `ka` config block (env vars
 * KA_EMBEDDING_MODEL, KA_OLLAMA_BASE_URL) with sensible defaults.
 *
 * `@langchain/ollama` is lazy-imported inside `createEmbeddingsImpl` because a
 * top-level import pulls `@langchain/core/language_models/compat`, which is
 * not exported by the installed @langchain/core version and crashes the test
 * runner. The lazy import keeps the extension boot resilient; tests stub
 * `createEmbeddingsImpl` so the real module is never touched.
 *
 * Used by:
 *   - `EmbeddingProcessor` (Bull worker) to embed note content on save.
 *   - `VectorStoreService` (PGVectorStore.initialize) to embed search queries.
 */
@Injectable()
export class EmbeddingsService implements OnModuleInit {
  private embeddings!: unknown;

  constructor(private readonly config: ConfigService) {}

  /** NestJS lifecycle hook — builds the OllamaEmbeddings instance on boot. */
  async onModuleInit(): Promise<void> {
    try {
      this.init();
    } catch (err) {
      // @langchain/ollama is optional — if the package or its
      // @langchain/core compat subpath is unavailable (version mismatch),
      // degrade gracefully instead of crashing the bootstrap. The extension
      // will surface a runtime error only when embed() is actually called.
      // eslint-disable-next-line no-console
      console.warn(
        `[EmbeddingsService] OllamaEmbeddings unavailable — embedding features disabled: ${(err as Error).message}`,
      );
    }
  }

  /** Build the embeddings instance. Kept separate so tests can stub it. */
  protected init(): void {
    // OpenAI-compatible provider (OpenRouter, OpenAI, Ark, …) when configured.
    // Env contract (read directly — there is no registered 'ka' config ns):
    //   KA_EMBEDDING_BASE_URL — e.g. https://openrouter.ai/api/v1
    //   KA_EMBEDDING_MODEL    — e.g. openai/text-embedding-3-small (MUST match
    //                           the DB column dimension: 1536 for 3-small)
    //   KA_EMBEDDING_API_KEY  — or OPENROUTER_API_KEY as fallback
    const baseUrl = process.env.KA_EMBEDDING_BASE_URL;
    if (baseUrl) {
      const model =
        process.env.KA_EMBEDDING_MODEL ?? 'openai/text-embedding-3-small';
      const apiKey =
        process.env.KA_EMBEDDING_API_KEY ??
        process.env.OPENROUTER_API_KEY ??
        '';
      this.embeddings = this.createOpenAIEmbeddingsImpl({
        model,
        baseUrl,
        apiKey,
      });
      return;
    }

    // Legacy local Ollama (default).
    const model =
      process.env.KA_EMBEDDING_MODEL_OLLAMA ?? 'nomic-embed-text';
    const ollamaBaseUrl =
      process.env.KA_OLLAMA_BASE_URL ?? 'http://localhost:11434';
    this.embeddings = this.createEmbeddingsImpl({
      model,
      baseUrl: ollamaBaseUrl,
    });
  }

  /** Create OpenAI-compatible embeddings (OpenRouter / OpenAI / Ark). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected createOpenAIEmbeddingsImpl(opts: {
    model: string;
    baseUrl: string;
    apiKey: string;
  }): any {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OpenAIEmbeddings } = require('@langchain/openai');
    return new OpenAIEmbeddings({
      model: opts.model,
      apiKey: opts.apiKey,
      configuration: { baseURL: opts.baseUrl },
    });
  }

  /** Create the real OllamaEmbeddings. Stubbed in tests to avoid network. */
  protected createEmbeddingsImpl(opts: {
    model: string;
    baseUrl: string;
  }): unknown {
    // Lazy import: avoids the @langchain/core compat subpath crash at load.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OllamaEmbeddings } = require('@langchain/ollama');
    return new OllamaEmbeddings(opts);
  }

  /** Embed a single query string. */
  async embed(text: string): Promise<number[]> {
    const e = this.embeddings as {
      embedQuery: (t: string) => Promise<number[]>;
    };
    return e.embedQuery(text);
  }

  /** Embed a batch of documents. */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const e = this.embeddings as {
      embedDocuments: (t: string[]) => Promise<number[][]>;
    };
    return e.embedDocuments(texts);
  }

  /** Expose the underlying instance so PGStore can reuse it. */
  getEmbeddings(): unknown {
    return this.embeddings;
  }
}