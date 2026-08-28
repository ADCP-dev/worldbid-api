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
      // Global knowledge base: userId is creator provenance only. Default
      // to null so the repository write path always gets a defined value.
      userId: dto.userId ?? null,
      frontmatter: dto.frontmatter ?? { ...DEFAULT_OKF_FRONTMATTER },
      tags: dto.tags ?? [],
    };

    const note = await this.repository.create(data);

    const links = this.extractLinks(dto.contentMd);
    if (links.length > 0) {
      await this.repository.replaceLinks(note.id, links).catch((err) => {
        this.logger.warn(`Failed to replace links for note ${note.id}: ${err?.message ?? err}`);
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
      // Replace outgoing links atomically: delete all existing links from
      // this note, then insert the freshly extracted ones. Avoids stale
      // edges lingering after a wikilink is removed from the content.
      await this.repository.replaceLinks(note.id, links).catch((err) => {
        this.logger.warn(`Failed to replace links for note ${note.id}: ${err?.message ?? err}`);
      });
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

  /**
   * Keyword / full-text search (FTS spanish + ILIKE fallback). Used by the
   * semantic tool and RAG injection as a fallback when the vector store is
   * unavailable — guarantees the agent can always find notes by keywords.
   */
  async keywordSearch(
    query: string,
    topK = 5,
  ): Promise<
    Array<{
      id: string;
      title: string;
      categoryPath: string | null;
      tags: string[];
      snippet: string;
    }>
  > {
    return this.repository.keywordSearch(query, topK);
  }

  /**
   * Rename a category folder. Updates category_path on all notes whose path
   * equals `oldPath` or starts with `oldPath.`. Returns the number of notes
   * affected. Also re-extracts wikilinks for each updated note so backlinks
   * stay in sync.
   */
  async renameCategory(oldPath: string, newPath: string): Promise<number> {
    if (!oldPath || !newPath || oldPath === newPath) return 0;
    // Sanitize: only alphanumerics, dots, underscores.
    const cleanOld = oldPath.replace(/[^a-zA-Z0-9_.]/g, '');
    const cleanNew = newPath.replace(/[^a-zA-Z0-9_.]/g, '');
    if (!cleanOld || !cleanNew) return 0;

    const affected = await this.repository.renameCategoryPath(cleanOld, cleanNew);

    // Re-extract links for each affected note (category change may affect
    // path-aware wikilink resolution).
    const notes = await this.repository.findByCategoryPath(cleanNew);
    for (const note of notes) {
      const links = this.extractLinks(note.contentMd);
      if (links.length > 0) {
        await this.repository.replaceLinks(note.id, links).catch((err) => {
          this.logger.warn(`Failed to replace links for note ${note.id}: ${err?.message ?? err}`);
        });
      }
    }

    return affected;
  }

  /**
   * Delete a category folder: moves all notes in that folder (and subfolders)
   * to uncategorized (category_path = null). Notes are NOT deleted.
   */
  async deleteCategory(path: string): Promise<number> {
    if (!path) return 0;
    const clean = path.replace(/[^a-zA-Z0-9_.]/g, '');
    if (!clean) return 0;
    return this.repository.deleteCategoryPath(clean);
  }

  private extractLinks(contentMd: string): string[] {
    const matches = [...contentMd.matchAll(LINK_PATTERN)];
    // Each captured group may be "note title" OR "category.path.note title".
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