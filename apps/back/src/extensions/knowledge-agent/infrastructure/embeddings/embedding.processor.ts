import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { NoteRepository } from '../note.repository';
import { EmbeddingsService } from './embeddings.service';

export interface EmbeddingJobData {
  noteId: string;
  contentMd: string;
}

/**
 * Embedding processor (Phase 4 — real OllamaEmbeddings).
 *
 * Consumes `embed` jobs from the `ka-embedding` Bull queue. Generates the
 * embedding vector via `EmbeddingsService.embed()` (OllamaEmbeddings) and
 * persists it back into `ext_ka_notes.embedding`. On failure the embedding
 * stays NULL and the note is excluded from semantic search (Q-13: always
 * async, non-blocking).
 */
@Processor('ka-embedding')
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  constructor(
    @InjectQueue('ka-embedding')
    private readonly embeddingQueue: Queue,
    private readonly noteRepository: NoteRepository,
    private readonly embeddingsService: EmbeddingsService,
  ) {
    super();
  }

  async process(job: Job<EmbeddingJobData>): Promise<void> {
    if (job.name !== 'embed') {
      this.logger.warn(`Unknown job name: ${job.name}`);
      return;
    }

    const { noteId, contentMd } = job.data;
    this.logger.log(`Embedding job for note ${noteId} (${contentMd.length} chars)`);

    try {
      const vector = await this.embeddingsService.embed(contentMd);
      await this.noteRepository.updateEmbedding(noteId, vector);
      this.logger.debug(`Embedding stored for note ${noteId} (dim=${vector.length})`);
    } catch (err) {
      // Non-blocking: leave embedding NULL so the note is excluded from
      // semantic search but remains accessible via tree search / CRUD.
      this.logger.warn(
        `Embedding failed for note ${noteId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      await this.noteRepository.updateEmbedding(noteId, null);
    }
  }
}