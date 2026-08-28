import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import MarkdownIt from 'markdown-it';
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
  private readonly md: MarkdownIt = new MarkdownIt({ html: false, linkify: true });

  constructor(
    private readonly repository: NoteRepository,
    @InjectQueue('ka-embedding')
    private readonly embeddingQueue: Queue,
  ) {}

  /**
   * Normalize incoming content to HTML. TipTap (the editor) edits HTML, and
   * the agent's create/update tools write plain markdown — store HTML for
   * BOTH paths so the editor renders generated notes correctly.
   *
   * Heuristic: content that already starts with an HTML block tag is left
   * as-is; anything else goes through markdown-it. Wikilinks [[title]] are
   * preserved verbatim (they are extracted separately for the link graph),
   * but wrapped in <a> markers during conversion so markdown-it doesn't mangle
   * the brackets.
   */
  private normalizeToHtml(contentMd: string): string {
    if (!contentMd || /^\s*</.test(contentMd)) return contentMd;
    // Protect wikilinks from markdown-it emphasis/parsing quirks.
    const protectedMd = contentMd
      .replace(/\[\[([^\]]+)\]\]/g, (_m, title: string) => `[[${title}]]`.replace('[', '&#91;').replace(']', '&#93;'));
    let html = this.md.render(protectedMd);
    // Restore wikilinks as plain [[title]] text inside the HTML.
    html = html
      .replace(/&#91;&#91;/g, '[[')
      .replace(/&#93;&#93;/g, ']]');
    return html;
  }

  async create(dto: CreateNoteDto & { userId?: number | null }): Promise<Note> {
    // Agent tools send plain markdown; the editor consumes HTML. Normalize
    // once at the boundary so BOTH write paths store editor-ready HTML.
    const contentMd = this.normalizeToHtml(dto.contentMd);
    const data = {
      ...dto,
      contentMd,
      // Global knowledge base: userId is creator provenance only. Default
      // to null so the repository write path always gets a defined value.
      userId: dto.userId ?? null,
      frontmatter: dto.frontmatter ?? { ...DEFAULT_OKF_FRONTMATTER },
      tags: dto.tags ?? [],
    };

    const note = await this.repository.create(data);

    // Wikilinks are extracted from the ORIGINAL markdown (normalizeToHtml
    // preserves [[title]] verbatim, so extracting from the HTML works too).
    const links = this.extractLinks(contentMd);
    if (links.length > 0) {
      await this.repository.replaceLinks(note.id, links).catch((err) => {
        this.logger.warn(`Failed to replace links for note ${note.id}: ${err?.message ?? err}`);
      });
    }

    void this.enqueueEmbedding(note.id, contentMd);

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

  /**
   * Distinct category paths + note counts (for the list_categories tool).
   */
  async listCategories(): Promise<Array<{ categoryPath: string; count: number }>> {
    return this.repository.listCategories();
  }

  /**
   * Re-queue embedding jobs for every non-deleted note. Used by the admin
   * reindex endpoint after (re)configuring the embeddings provider so the
   * semantic search covers pre-existing notes.
   */
  async reindexEmbeddings(): Promise<number> {
    const notes = await this.repository.findAll();
    for (const note of notes) {
      void this.enqueueEmbedding(note.id, note.contentMd);
    }
    return notes.length;
  }

  async update(id: string, dto: UpdateNoteDto): Promise<Note> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Note ${id} not found`);
    }

    // Same boundary normalization as create: markdown coming from agent
    // tools becomes HTML before storage.
    let effectiveDto = dto;
    if (dto.contentMd !== undefined) {
      effectiveDto = {
        ...dto,
        contentMd: this.normalizeToHtml(dto.contentMd),
      };
    }

    const note = await this.repository.update(id, effectiveDto);

    if (effectiveDto.contentMd !== undefined && effectiveDto.contentMd !== existing.contentMd) {
      const links = this.extractLinks(effectiveDto.contentMd);
      // Replace outgoing links atomically: delete all existing links from
      // this note, then insert the freshly extracted ones. Avoids stale
      // edges lingering after a wikilink is removed from the content.
      await this.repository.replaceLinks(note.id, links).catch((err) => {
        this.logger.warn(`Failed to replace links for note ${note.id}: ${err?.message ?? err}`);
      });
      void this.enqueueEmbedding(note.id, effectiveDto.contentMd);
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