import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { NoteEntity } from './entities/note.entity';
import { NoteLinkEntity } from './entities/note-link.entity';
import { NullableType } from '@infra/utils/types/nullable.type';
import { Note } from '../domain/note';
import { CreateNoteDto } from '../dto/create-note.dto';
import { UpdateNoteDto } from '../dto/update-note.dto';
import { normalizeTitleForMatch } from '../wikilink.util';

@Injectable()
export class NoteRepository {
  constructor(
    @InjectRepository(NoteEntity)
    private readonly noteRepository: Repository<NoteEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    data: CreateNoteDto & { userId?: number | null },
  ): Promise<Note> {
    const entity = this.noteRepository.create({
      title: data.title,
      contentMd: data.contentMd,
      categoryPath: data.categoryPath ?? null,
      tags: data.tags ?? [],
      frontmatter: data.frontmatter ?? {},
      embedding: null,
      userId: data.userId ?? null,
    });
    const saved = await this.noteRepository.save(entity);
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<NullableType<Note>> {
    const entity = await this.noteRepository.findOne({
      where: { id },
      withDeleted: false,
    });
    return entity ? this.toDomain(entity) : null;
  }

  /**
   * List all notes (global knowledge base). Optional `search` filters by
   * title or content. Never scoped by user — notes are shared.
   */
  async findAll(filters?: { search?: string }): Promise<Note[]> {
    const qb = this.noteRepository
      .createQueryBuilder('note')
      .where('note.deletedAt IS NULL');

    if (filters?.search) {
      qb.andWhere('(note.title ILIKE :q OR note.contentMd ILIKE :q)', {
        q: `%${filters.search}%`,
      });
    }

    qb.orderBy('note.updatedAt', 'DESC');
    const entities = await qb.getMany();
    return entities.map((e) => this.toDomain(e));
  }

  /**
   * Tree search by category_path (ltree).
   *
   * Uses `category_path ~ 'path.*{0,depth}'::lquery` — the `<@` operator only
   * accepts ltree (NOT lquery), and casting an lquery pattern to ::ltree
   * throws "ltree syntax error". `~` is the lquery-matching operator.
   *
   * Root ('/', '', '.') → returns ALL non-deleted notes (no path filter).
   * Global: no user_id filter — notes are shared.
   */
  async findByCategoryPath(categoryPath: string, depth = 0): Promise<Note[]> {
    const sanitized = categoryPath
      .replace(/[^a-zA-Z0-9_.]/g, '')
      .replace(/^\.+|\.+$/g, '');

    // Root request → everything.
    if (!sanitized || sanitized === '.') {
      const rows = await this.dataSource.query(
        `SELECT * FROM ext_ka_notes WHERE deleted_at IS NULL ORDER BY created_at DESC`,
      );
      return rows.map((r: Record<string, unknown>) => this.rowToDomain(r));
    }

    const pattern = `${sanitized}.*{0,${Math.max(1, depth)}}`;
    const sql = `
      SELECT * FROM ext_ka_notes
      WHERE deleted_at IS NULL
        AND category_path ~ $1::lquery
      ORDER BY created_at DESC
    `;
    const rows = await this.dataSource.query(sql, [pattern]);
    return rows.map((r: Record<string, unknown>) => this.rowToDomain(r));
  }

  /**
   * Distinct category paths with note counts (non-deleted, non-null path).
   * Powers the list_categories agent tool and any future folder overview UI.
   */
  async listCategories(): Promise<
    Array<{ categoryPath: string; count: number }>
  > {
    const rows = await this.dataSource.query(
      `
        SELECT category_path AS "categoryPath", count(*)::int AS count
        FROM ext_ka_notes
        WHERE deleted_at IS NULL AND category_path IS NOT NULL
        GROUP BY category_path
        ORDER BY count DESC, category_path ASC
      `,
    );
    return rows.map((r: Record<string, unknown>) => ({
      categoryPath: String(r['categoryPath'] ?? ''),
      count: Number(r['count'] ?? 0),
    }));
  }

  /**
   * Keyword / full-text search fallback for when the vector store is
   * unavailable (embeddings provider down) or has no indexed rows.
   *
   * Uses Postgres FTS (spanish config, websearch syntax) ranked by ts_rank;
   * falls back to ILIKE matching when FTS yields nothing (handles partial
   * words and non-Spanish content). Returns title + a headline snippet.
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
    const clean = query.trim();
    if (!clean) return [];

    const ftsSql = `
      SELECT id, title, tags, category_path,
             ts_headline('spanish', content_md,
               websearch_to_tsquery('spanish', $1),
               'MaxWords=20, MinWords=8, StartSel=…, StopSel=…') AS snippet,
             ts_rank(to_tsvector('spanish', title || ' ' || content_md),
               websearch_to_tsquery('spanish', $1)) AS rank
      FROM ext_ka_notes
      WHERE deleted_at IS NULL
        AND to_tsvector('spanish', title || ' ' || content_md)
              @@ websearch_to_tsquery('spanish', $1)
      ORDER BY rank DESC
      LIMIT $2
    `;
    let rows: Array<Record<string, unknown>> = [];
    try {
      rows = await this.dataSource.query(ftsSql, [clean, topK]);
    } catch {
      rows = [];
    }

    // ILIKE fallback — covers partial words, accents drift, non-Spanish text.
    if (rows.length === 0) {
      const words = clean
        .split(/\s+/)
        .filter((w) => w.length >= 3)
        .slice(0, 5);
      if (words.length === 0) return [];
      const conditions = words
        .map((_, i) => `(title ILIKE $${i + 1} OR content_md ILIKE $${i + 1})`)
        .join(' OR ');
      const params = words.map((w) => `%${w}%`);
      rows = await this.dataSource.query(
        `SELECT id, title, tags, category_path,
                left(regexp_replace(content_md, '<[^>]*>|\\s+', ' ', 'g'), 240) AS snippet
         FROM ext_ka_notes
         WHERE deleted_at IS NULL AND (${conditions})
         ORDER BY updated_at DESC
         LIMIT $${words.length + 1}`,
        [...params, topK],
      );
    }

    return rows.map((r) => ({
      id: r['id'] as string,
      title: r['title'] as string,
      categoryPath: (r['category_path'] as string) ?? null,
      tags: (r['tags'] as string[]) ?? [],
      snippet: (r['snippet'] as string) ?? '',
    }));
  }

  /**
   * Rename a category folder: updates category_path on all notes whose path
   * equals `oldPath` or starts with `oldPath.`. Uses SQL REPLACE for the prefix
   * swap. Returns the number of affected rows.
   */
  async renameCategoryPath(oldPath: string, newPath: string): Promise<number> {
    // Notes with exact path: category_path = oldPath → newPath
    // Notes with subpath: category_path LIKE 'oldPath.%' → newPath + suffix
    const sql = `
      UPDATE ext_ka_notes
      SET category_path = CASE
        WHEN category_path = $1 THEN $2
        WHEN category_path LIKE $3 THEN $2 || '.' || substring(category_path from length($1) + 2)
      END
      WHERE deleted_at IS NULL
        AND (category_path = $1 OR category_path LIKE $3)
    `;
    const result = await this.dataSource.query(sql, [
      oldPath,
      newPath,
      `${oldPath}.%`,
    ]);
    return Array.isArray(result) ? result.length : (result?.affectedRows ?? 0);
  }

  /**
   * Delete a category folder: moves all notes in that folder (and subfolders)
   * to uncategorized (category_path = null). Returns the number of affected rows.
   */
  async deleteCategoryPath(path: string): Promise<number> {
    const sql = `
      UPDATE ext_ka_notes
      SET category_path = NULL
      WHERE deleted_at IS NULL
        AND (category_path = $1 OR category_path LIKE $2)
    `;
    const result = await this.dataSource.query(sql, [path, `${path}.%`]);
    return Array.isArray(result) ? result.length : (result?.affectedRows ?? 0);
  }

  async update(id: string, data: UpdateNoteDto): Promise<Note> {
    const entity = await this.noteRepository.findOne({
      where: { id },
      withDeleted: false,
    });
    if (!entity) {
      throw new Error('Record not found');
    }

    if (data.title !== undefined) entity.title = data.title;
    if (data.contentMd !== undefined) entity.contentMd = data.contentMd;
    if (data.categoryPath !== undefined)
      entity.categoryPath = data.categoryPath;
    if (data.tags !== undefined) entity.tags = data.tags;
    if (data.frontmatter !== undefined) entity.frontmatter = data.frontmatter;

    const saved = await this.noteRepository.save(entity);
    return this.toDomain(saved);
  }

  async softDelete(id: string): Promise<void> {
    await this.noteRepository.softDelete(id);
  }

  /**
   * Atomically replace outgoing links for a note: delete all existing edges
   * from this source, then insert the freshly extracted ones via
   * {@link upsertLinks}. Callers should pass the full current link set
   * (including refs that may already exist).
   */
  async replaceLinks(
    sourceNoteId: string,
    targetTitles: string[],
  ): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .delete()
      .from(NoteLinkEntity)
      .where('source_note_id = :id', { id: sourceNoteId })
      .execute();
    await this.upsertLinks(sourceNoteId, targetTitles);
  }

  /**
   * Upsert outgoing links for `sourceNoteId`.
   *
   * Each `targetTitle` may be either a bare note title ("My Note") or a
   * dotted category-path + title ("tech.notes.async/My Note" /
   * "tech.notes.async.My Note"). Resolution order per ref — first hit wins:
   * (1) category path + leaf title, (2) the FULL raw string as a title
   * (fixes dotted titles like [[Node.js]] that the path split would mangle),
   * (3) leaf title alone. All comparisons are case-insensitive
   * (lowered equality) and whitespace-normalized, and a note never links
   * to itself.
   */
  async upsertLinks(
    sourceNoteId: string,
    targetTitles: string[],
  ): Promise<void> {
    if (targetTitles.length === 0) return;

    // Split each reference into (categoryPath?, title). We accept both "/" and
    // "." as path separators inside [[ ]] so users can write either
    // [[tech/notes/async]] or [[tech.notes.async]]. The full raw string is
    // kept for the title fallback so refs like [[Node.js]] can still match a
    // note literally titled "Node.js".
    interface ParsedRef {
      title: string;
      categoryPath: string | null;
      fullRef: string;
    }
    const parsed: ParsedRef[] = targetTitles.map((raw) => {
      const trimmed = raw.trim();
      const segments = trimmed
        .split(/[/.]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (segments.length <= 1) {
        return { title: trimmed, categoryPath: null, fullRef: trimmed };
      }
      const title = segments[segments.length - 1];
      const categoryPath = segments.slice(0, -1).join('.') || null;
      return { title, categoryPath, fullRef: trimmed };
    });

    const findNote = async (
      title: string,
      categoryPath: string | null,
    ): Promise<NoteEntity | null> => {
      const qb = this.noteRepository
        .createQueryBuilder('note')
        .select(['note.id'])
        .where('LOWER(note.title) = LOWER(:title)', {
          title: normalizeTitleForMatch(title),
        })
        .andWhere('note.deletedAt IS NULL');
      if (categoryPath) {
        qb.andWhere('note.categoryPath = :path', { path: categoryPath });
      }
      return qb.getOne();
    };

    // Resolve each parsed ref to a note id. We do one query per candidate
    // match because path-aware matching needs different predicates than
    // title-only, and the number of refs per note is small.
    const resolvedIds = new Set<string>();
    for (const ref of parsed) {
      // (1) Exact path + leaf title — highest priority, disambiguates same
      // titled notes across folders.
      if (ref.categoryPath) {
        const withPath = await findNote(ref.title, ref.categoryPath);
        if (withPath) {
          if (withPath.id !== sourceNoteId) resolvedIds.add(withPath.id);
          continue;
        }
      }

      // (2) FULL raw string as title — matches dotted refs like [[Node.js]]
      // where splitting on "." yields a bogus leaf title.
      const fullRaw = await findNote(ref.fullRef, null);
      if (fullRaw) {
        if (fullRaw.id !== sourceNoteId) resolvedIds.add(fullRaw.id);
        continue;
      }

      // (3) Leaf title only. Bare refs already matched in step (2)
      // (fullRef === title there), so this only runs for path refs.
      if (ref.categoryPath) {
        const leafOnly = await findNote(ref.title, null);
        if (leafOnly && leafOnly.id !== sourceNoteId) {
          resolvedIds.add(leafOnly.id);
        }
      }
    }

    for (const targetId of resolvedIds) {
      await this.dataSource
        .createQueryBuilder()
        .insert()
        .into(NoteLinkEntity)
        .values({ sourceNoteId, targetNoteId: targetId })
        .orIgnore()
        .execute();
    }
  }

  /**
   * All non-deleted notes whose stored content still contains at least one
   * wikilink ([[...]]). Used by the forward-reference resolution hook to
   * re-resolve links that pointed at a note title before that note existed.
   */
  async findNotesContainingWikilinks(): Promise<Note[]> {
    const entities = await this.noteRepository
      .createQueryBuilder('note')
      .select(['note.id', 'note.title', 'note.contentMd'])
      .where('note.deletedAt IS NULL')
      .andWhere('note.contentMd ~ :pattern', { pattern: '\\[\\[' })
      .getMany();
    return entities.map((e) => this.toDomain(e));
  }

  async findBacklinks(noteId: string): Promise<Note[]> {
    const sql = `
      SELECT n.* FROM ext_ka_notes n
      JOIN ext_ka_note_links l ON l.source_note_id = n.id
      WHERE l.target_note_id = $1
        AND n.deleted_at IS NULL
      ORDER BY n.updated_at DESC
    `;
    const rows = await this.dataSource.query(sql, [noteId]);
    return rows.map((r: Record<string, unknown>) => this.rowToDomain(r));
  }

  /**
   * Graph query: ALL notes, optionally filtered by category_path (ltree
   * prefix) or a single tag (jsonb contains). Returns the minimal columns
   * needed by the graph viewer.
   *
   * Uses raw SQL when category_path filter is present because TypeORM's
   * query builder does not handle the ltree `<@` operator + `::ltree` cast.
   *
   * Global: no user_id filter — notes are shared.
   */
  async findNotesForGraph(filters?: {
    categoryPath?: string;
    tag?: string;
  }): Promise<
    Array<{
      id: string;
      title: string;
      tags: string[];
      category_path: string | null;
    }>
  > {
    if (filters?.categoryPath) {
      const sanitized = filters.categoryPath
        .replace(/[^a-zA-Z0-9_.]/g, '')
        .replace(/^\.+|\.+$/g, '');

      // Root request → no path filter (all notes), fall through below.
      if (sanitized && sanitized !== '.') {
        const params: unknown[] = [sanitized];
        let sql = `
          SELECT id, title, tags, category_path
          FROM ext_ka_notes
          WHERE deleted_at IS NULL
            AND category_path <@ $1::ltree
        `;
        if (filters.tag) {
          params.push(JSON.stringify([filters.tag]));
          sql += ` AND tags @> $2::jsonb`;
        }
        return this.dataSource
          .query(sql, params)
          .then((rows: Array<Record<string, unknown>>) =>
            rows.map((r) => ({
              id: r['id'] as string,
              title: r['title'] as string,
              tags: (r['tags'] as string[]) ?? [],
              category_path: (r['category_path'] as string) ?? null,
            })),
          );
      }
    }

    // No category_path filter — safe to use the query builder.
    const qb = this.noteRepository
      .createQueryBuilder('note')
      .select(['note.id', 'note.title', 'note.tags', 'note.categoryPath'])
      .where('note.deletedAt IS NULL');

    if (filters?.tag) {
      qb.andWhere('note.tags @> CAST(:tag AS jsonb)', {
        tag: JSON.stringify([filters.tag]),
      });
    }

    return qb.getMany().then((rows) =>
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        tags: r.tags ?? [],
        category_path: r.categoryPath,
      })),
    );
  }

  /**
   * Graph query: edges (note links) where BOTH source and target belong to
   * the given set of note ids. Avoids links to deleted notes outside the
   * visible set.
   *
   * Global: no user_id filter — links are shared.
   */
  async findLinksForNotes(
    noteIds: string[],
  ): Promise<Array<{ source_note_id: string; target_note_id: string }>> {
    if (noteIds.length === 0) return [];
    const sql = `
      SELECT l.source_note_id, l.target_note_id
      FROM ext_ka_note_links l
      JOIN ext_ka_notes s ON s.id = l.source_note_id
      JOIN ext_ka_notes t ON t.id = l.target_note_id
      WHERE s.deleted_at IS NULL
        AND t.deleted_at IS NULL
        AND l.source_note_id = ANY($1::uuid[])
        AND l.target_note_id = ANY($1::uuid[])
    `;
    return this.dataSource.query(sql, [noteIds]);
  }

  async updateEmbedding(id: string, embedding: number[] | null): Promise<void> {
    const vectorLiteral = embedding ? `[${embedding.join(',')}]` : null;
    await this.dataSource.query(
      `UPDATE ext_ka_notes SET embedding = $2::vector WHERE id = $1`,
      [id, vectorLiteral],
    );
  }

  private toDomain(entity: NoteEntity): Note {
    return plainToInstance(Note, entity, { excludeExtraneousValues: true });
  }

  private rowToDomain(row: Record<string, unknown>): Note {
    const note = new Note();
    note.id = row['id'] as string;
    note.title = row['title'] as string;
    note.contentMd = row['content_md'] as string;
    note.categoryPath = (row['category_path'] as string) ?? null;
    note.tags = (row['tags'] as string[]) ?? [];
    note.frontmatter = (row['frontmatter'] as Record<string, unknown>) ?? {};
    note.embedding = null;
    note.userId = row['user_id'] != null ? Number(row['user_id']) : null;
    note.createdAt = new Date(row['created_at'] as string);
    note.updatedAt = new Date(row['updated_at'] as string);
    note.deletedAt = row['deleted_at']
      ? new Date(row['deleted_at'] as string)
      : null;
    return note;
  }
}
