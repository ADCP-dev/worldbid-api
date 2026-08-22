import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingsService } from './embeddings/embeddings.service';

/**
 * VectorStoreService — wraps `PGVectorStore` from `@langchain/pgvector`.
 *
 * Reuses the existing Postgres connection (from the `database` config) and
 * the `ext_ka_notes` table whose `embedding` column stores the pgvector
 * vectors. Semantic search delegates to `PGVectorStore.similaritySearchWithScore`
 * which computes cosine similarity over the HNSW index.
 *
 * `@langchain/pgvector` is lazy-imported (same compat-subpath issue as
 * `@langchain/ollama`); tests stub `createStoreImpl`.
 */
@Injectable()
export class VectorStoreService implements OnModuleInit {
  private readonly logger = new Logger(VectorStoreService.name);
  private store: { similaritySearchWithScore: (q: string, k: number) => Promise<unknown> } | null = null;

  constructor(
    private readonly embeddingsService: EmbeddingsService,
    private readonly config: ConfigService,
  ) {}

  /** NestJS lifecycle — initialize the store on boot. */
  async onModuleInit(): Promise<void> {
    try {
      await this.initialize();
    } catch (err) {
      this.logger.warn(
        `VectorStore init failed: ${err instanceof Error ? err.message : String(err)}. Semantic search disabled until DB available.`,
      );
    }
  }

  /** Build (or reuse) the PGVectorStore. Idempotent. */
  async initialize(): Promise<void> {
    if (this.store) return;
    const embeddings = this.embeddingsService.getEmbeddings();
    const pgConfig = this.resolvePgConfig();
    this.store = await this.createStoreImpl(embeddings, {
      postgresConnectionOptions: pgConfig,
      tableName: 'ext_ka_notes',
      columns: {
        idColumnName: 'id',
        vectorColumnName: 'embedding',
        contentColumnName: 'content_md',
        metadataColumnName: 'metadata',
      },
    });
  }

  /**
   * Semantic search: returns `[document, score]` tuples sorted by cosine
   * similarity. Returns `[]` when the store is unavailable (init failed).
   */
  async similaritySearch(query: string, topK = 5): Promise<unknown> {
    if (!this.store) return [];
    return this.store.similaritySearchWithScore(query, topK);
  }

  /** Resolve the TypeORM/pg connection options from the `database` config. */
  private resolvePgConfig(): Record<string, unknown> {
    const db = this.config.get<Record<string, unknown>>('database') ?? {};
    return {
      type: 'postgres',
      host: db['host'] ?? process.env.DATABASE_HOST ?? 'localhost',
      port: db['port'] ?? Number(process.env.DATABASE_PORT ?? 5432),
      user: db['user'] ?? process.env.DATABASE_USER,
      password: db['password'] ?? process.env.DATABASE_PASSWORD,
      database: db['database'] ?? process.env.DATABASE_NAME,
    };
  }

  /** Create the real PGVectorStore. Stubbed in tests. */
  protected async createStoreImpl(
    embeddings: unknown,
    opts: Record<string, unknown>,
  ): Promise<{ similaritySearchWithScore: (q: string, k: number) => Promise<unknown> }> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PGVectorStore } = require('@langchain/pgvector');
    return PGVectorStore.initialize(embeddings, opts);
  }
}