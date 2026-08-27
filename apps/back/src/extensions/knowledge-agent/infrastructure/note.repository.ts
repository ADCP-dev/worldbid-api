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

@Injectable()
export class NoteRepository {
  constructor(
    @InjectRepository(NoteEntity)
    private readonly noteRepository: Repository<NoteEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async create(data: CreateNoteDto & { userId?: number | null }): Promise<Note> {
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
   * Uses `category_path <@ 'prefix.*'` via raw SQL.
   * `depth` limits the number of sublevel segments matched (0 = exact).
   *
   * Global: no user_id filter — notes are shared.
   */
  async findByCategoryPath(
    categoryPath: string,
    depth = 0,
  ): Promise<Note[]> {
    const sanitized = categoryPath.replace(/[^a-zA-Z0-9_.]/g, '');
    if (!sanitized) return [];

    const prefix = depth > 0 ? `${sanitized}.*{0,${depth}}` : sanitized;
    const sql = `
      SELECT * FROM ext_ka_notes
      WHERE deleted_at IS NULL
        AND category_path <@ $1::ltree
      ORDER BY created_at DESC
    `;
    const rows = await this.dataSource.query(sql, [prefix]);
    return rows.map((r: Record<string, unknown>) => this.rowToDomain(r));
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
    if (data.categoryPath !== undefined) entity.categoryPath = data.categoryPath;
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
  async replaceLinks(sourceNoteId: string, targetTitles: string[]): Promise<void> {
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
   * "tech.notes.async.My Note"). When a path is present we match the leaf
   * title AND the categoryPath prefix so a link can disambiguate two notes
   * with the same title in different folders. Bare titles fall back to a
   * single `title = ?` lookup (preserves previous behavior).
   */
  async upsertLinks(sourceNoteId: string, targetTitles: string[]): Promise<void> {
    if (targetTitles.length === 0) return;

    // Split each reference into (categoryPath?, title). We accept both "/" and
    // "." as path separators inside [[ ]] so users can write either
    // [[tech/notes/async]] or [[tech.notes.async]].
    interface ParsedRef {
      title: string;
      categoryPath: string | null;
    }
    const parsed: ParsedRef[] = targetTitles.map((raw) => {
      // Last segment is the title; the rest is the category path.
      const separators = /[/.]/;
      const segments = raw.split(separators).map((s) => s.trim()).filter(Boolean);
      if (segments.length <= 1) {
        return { title: raw.trim(), categoryPath: null };
      }
      const title = segments[segments.length - 1];
      const categoryPath = segments.slice(0, -1).join('.');
      return { title, categoryPath: categoryPath || null };
    });

    // Resolve each parsed ref to a note id. We do one query per ref because
    // path-aware matching needs different predicates than title-only, and the
    // number of refs per note is small.
    const resolvedIds = new Set<string>();
    for (const ref of parsed) {
      const qb = this.noteRepository
        .createQueryBuilder('note')
        .select(['note.id'])
        .where('note.title = :title', { title: ref.title })
        .andWhere('note.deletedAt IS NULL');
      if (ref.categoryPath) {
        // Exact path match has priority.
        qb.andWhere('note.categoryPath = :path', { path: ref.categoryPath });
      }
      const exact = await qb.getOne();
      if (exact) {
        if (exact.id !== sourceNoteId) resolvedIds.add(exact.id);
        continue;
      }
      // Fallback: title only when a path was specified but didn't match.
      // Helps while users are still migrating their wikilinks to the new
      // path-aware form.
      if (ref.categoryPath) {
        const loose = await this.noteRepository
          .createQueryBuilder('note')
          .select(['note.id'])
          .where('note.title = :title', { title: ref.title })
          .andWhere('note.deletedAt IS NULL')
          .getOne();
        if (loose && loose.id !== sourceNoteId) resolvedIds.add(loose.id);
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
  async findNotesForGraph(
    filters?: { categoryPath?: string; tag?: string },
  ): Promise<
    Array<{
      id: string;
      title: string;
      tags: string[];
      category_path: string | null;
    }>
  > {
    if (filters?.categoryPath) {
      const sanitized = filters.categoryPath.replace(/[^a-zA-Z0-9_.]/g, '');
      if (!sanitized) return [];

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
      return this.dataSource.query(sql, params).then((rows: Array<Record<string, unknown>>) =>
        rows.map((r) => ({
          id: r['id'] as string,
          title: r['title'] as string,
          tags: (r['tags'] as string[]) ?? [],
          category_path: (r['category_path'] as string) ?? null,
        })),
      );
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
    const vectorLiteral = embedding
      ? `[${embedding.join(',')}]`
      : null;
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
    note.frontmatter =
      (row['frontmatter'] as Record<string, unknown>) ?? {};
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