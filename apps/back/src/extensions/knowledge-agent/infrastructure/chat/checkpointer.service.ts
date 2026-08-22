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
 * DEVIATION from design: `@langchain/langgraph-checkpoint-postgres` is NOT
 * installed in this project (only `@langchain/langgraph` + its transitive
 * `@langchain/langgraph-checkpoint`). The design's fallback (MemorySaver) is
 * used instead so chat sessions work end-to-end. State is kept in-process and
 * is lost on restart — acceptable for v1 single-instance dev. When the
 * postgres checkpointer package is added, swap `createCheckpointerImpl` to
 * return a `PostgresSaver.fromConnString(...)` and call `await saver.setup()`
 * — no other code changes needed.
 */
@Injectable()
export class CheckpointerService implements OnModuleInit {
  private readonly logger = new Logger(CheckpointerService.name);
  private saver: BaseCheckpointSaver | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    try {
      this.saver = await this.createCheckpointerImpl();
      this.logger.log('Checkpointer initialized');
    } catch (err) {
      this.logger.warn(
        `Failed to initialize checkpointer: ${err instanceof Error ? err.message : String(err)}. Chat state will not persist.`,
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
   * Wrapper that builds the checkpointer. Stubbed in tests.
   *
   * Currently returns a `MemorySaver` (in-process). Swap this method to
   * `PostgresSaver.fromConnString(connString)` + `await saver.setup()` once
   * `@langchain/langgraph-checkpoint-postgres` is installed.
   */
  protected async createCheckpointerImpl(): Promise<BaseCheckpointSaver> {
    // Future: read KA_DB_URI or DATABASE_URL and build a PostgresSaver.
    // For now, MemorySaver — no external dep beyond @langchain/langgraph.
    void this.configService; // used by the future postgres branch
    return new MemorySaver();
  }
}