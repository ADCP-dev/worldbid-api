import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { NoteRepository } from '../infrastructure/note.repository';

export interface EmbeddingJobData {
  noteId: string;
  contentMd: string;
}

/**
 * Embedding processor (Phase 1 stub).
 *
 * In Phase 1 this logs "embedding queued" and sets embedding=NULL.
 * The real OllamaEmbeddings integration is deferred to Phase 3
 * (DeepAgent runtime). This stub ensures the queue plumbing works
 * end-to-end and the save→embed async contract is verifiable.
 */
@Processor('ka-embedding')
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  constructor(
    @InjectQueue('ka-embedding')
    private readonly embeddingQueue: Queue,
    private readonly noteRepository: NoteRepository,
  ) {
    super();
  }

  async process(job: Job<EmbeddingJobData>): Promise<void> {
    if (job.name !== 'embed') {
      this.logger.warn(`Unknown job name: ${job.name}`);
      return;
    }

    const { noteId, contentMd } = job.data;
    this.logger.log(`Embedding queued for note ${noteId} (${contentMd.length} chars)`);

    // Phase 1 stub: no real embedding generation.
    // embedding stays NULL until Phase 3 (DeepAgent + OllamaEmbeddings).
    await this.noteRepository.updateEmbedding(noteId, null);
    this.logger.debug(`Embedding stub completed for note ${noteId} (set to NULL — Phase 3 will implement real embeddings)`);
  }
}