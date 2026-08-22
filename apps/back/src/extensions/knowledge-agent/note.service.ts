import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NoteRepository } from './infrastructure/note.repository';
import { Note } from './domain/note';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

const DEFAULT_OKF_FRONTMATTER = {
  okf_version: '1.0',
  type: 'note',
  generated: false,
} as const;

const LINK_PATTERN = /\[\[([^\]]+)\]\]/g;

@Injectable()
export class NoteService {
  private readonly logger = new Logger(NoteService.name);

  constructor(
    private readonly repository: NoteRepository,
    @InjectQueue('ka-embedding')
    private readonly embeddingQueue: Queue,
  ) {}

  async create(dto: CreateNoteDto & { userId?: number | null }): Promise<Note> {
    const data = {
      ...dto,
      frontmatter: dto.frontmatter ?? { ...DEFAULT_OKF_FRONTMATTER },
      tags: dto.tags ?? [],
    };

    const note = await this.repository.create(data);

    const links = this.extractLinks(dto.contentMd);
    if (links.length > 0) {
      await this.repository.upsertLinks(note.id, links).catch((err) => {
        this.logger.warn(`Failed to upsert links for note ${note.id}: ${err?.message ?? err}`);
      });
    }

    void this.enqueueEmbedding(note.id, dto.contentMd);

    return note;
  }

  async findById(id: string): Promise<Note | null> {
    return this.repository.findById(id);
  }

  /**
   * List all notes (global knowledge base). Optional `search` filters by
   * title or content.
   */
  async findAll(filters?: { search?: string }): Promise<Note[]> {
    return this.repository.findAll(filters);
  }

  async findByCategoryPath(categoryPath: string, depth = 0): Promise<Note[]> {
    return this.repository.findByCategoryPath(categoryPath, depth);
  }

  async update(id: string, dto: UpdateNoteDto): Promise<Note> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Note ${id} not found`);
    }

    const note = await this.repository.update(id, dto);

    if (dto.contentMd !== undefined && dto.contentMd !== existing.contentMd) {
      const links = this.extractLinks(dto.contentMd);
      if (links.length > 0) {
        await this.repository.upsertLinks(note.id, links).catch((err) => {
          this.logger.warn(`Failed to upsert links for note ${note.id}: ${err?.message ?? err}`);
        });
      }
      void this.enqueueEmbedding(note.id, dto.contentMd);
    }

    return note;
  }

  async softDelete(id: string): Promise<void> {
    const note = await this.repository.findById(id);
    if (!note) {
      throw new NotFoundException(`Note ${id} not found`);
    }
    await this.repository.softDelete(id);
  }

  async findBacklinks(noteId: string): Promise<Note[]> {
    return this.repository.findBacklinks(noteId);
  }

  private extractLinks(contentMd: string): string[] {
    const matches = [...contentMd.matchAll(LINK_PATTERN)];
    return matches.map((m) => m[1].trim()).filter((t) => t.length > 0);
  }

  private async enqueueEmbedding(noteId: string, contentMd: string): Promise<void> {
    try {
      await this.embeddingQueue.add(
        'embed',
        { noteId, contentMd },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      );
    } catch (err) {
      this.logger.warn(
        `Failed to enqueue embedding for note ${noteId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}