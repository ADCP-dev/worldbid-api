import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemorySaver } from '@langchain/langgraph';
import type { BaseCheckpointSaver } from '@langchain/langgraph';

/**
 * CheckpointerService — owns the LangGraph checkpoint saver used by the chat
 * runtime to persist agent state per session (thread_id = session.id).
 *
 * Design (AD-03): PostgresSaver from `@langchain/langgraph-checkpoint-postgres`
 * — same Postgres instance as TypeORM, `await saver.setup()` once.
 *
 * The connection string is resolved from `DATABASE_URL` (same env used by the
 * TypeORM database config) so the checkpointer shares the dev/prod Postgres.
 * Falls back to MemorySaver (in-process, no persistence across restarts) only
 * when PostgresSaver initialization fails — chat still streams, just state is
 * lost on restart.
 *
 * PostgresSaver is imported LAZILY inside `createCheckpointerImpl` (not at the
 * top of the file) so unit tests that stub the checkpointer do not pay the
 * ESM-resolution cost of the @langchain/langgraph-checkpoint-postgres package
 * (whose transitive `@langchain/langgraph-checkpoint` peer demands a newer
 * `@langchain/core` export surface than the project currently pins).
 */
@Injectable()
export class CheckpointerService implements OnModuleInit {
  private readonly logger = new Logger(CheckpointerService.name);
  private saver: BaseCheckpointSaver | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    try {
      this.saver = await this.createCheckpointerImpl();
      this.logger.log('Checkpointer initialized (PostgresSaver)');
    } catch (err) {
      this.logger.warn(
        `Failed to initialize PostgresSaver: ${err instanceof Error ? err.message : String(err)}. Falling back to MemorySaver — chat state will NOT persist across restarts.`,
      );
      // Fallback: in-memory so the chat still streams, just no persistence.
      this.saver = new MemorySaver();
    }
  }

  /** Returns the active checkpoint saver. Throws if not initialized. */
  getCheckpointer(): BaseCheckpointSaver {
    if (!this.saver) {
      throw new Error('CheckpointerService not initialized');
    }
    return this.saver;
  }

  /**
   * Build a PostgresSaver from the DATABASE_URL conn string and run
   * `await saver.setup()` once to create the checkpoint tables. Stubbed in
   * tests so the test suite never needs a live Postgres.
   *
   * The checkpointer shares the same Postgres instance as TypeORM (DATABASE_URL
   * in the database config); checkpoint tables live in the `public` schema.
   */
  protected async createCheckpointerImpl(): Promise<BaseCheckpointSaver> {
    const connString =
      this.configService.get<string>('database.url') ??
      process.env.DATABASE_URL;
    if (!connString) {
      throw new Error(
        'DATABASE_URL is not set; cannot build PostgresSaver checkpointer',
      );
    }
    // Lazy import keeps the package out of unit-test module resolution.
    const { PostgresSaver } = await import(
      '@langchain/langgraph-checkpoint-postgres'
    );
    const saver = PostgresSaver.fromConnString(connString);
    await saver.setup();
    return saver;
  }
}