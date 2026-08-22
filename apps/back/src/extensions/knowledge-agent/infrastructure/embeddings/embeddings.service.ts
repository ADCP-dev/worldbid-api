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
    this.init();
  }

  /** Build the OllamaEmbeddings instance. Kept separate so tests can stub it. */
  protected init(): void {
    const model =
      this.config.get<string>('ka.embeddingModel') ?? 'nomic-embed-text';
    const baseUrl =
      this.config.get<string>('ka.ollamaBaseUrl') ?? 'http://localhost:11434';
    this.embeddings = this.createEmbeddingsImpl({ model, baseUrl });
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