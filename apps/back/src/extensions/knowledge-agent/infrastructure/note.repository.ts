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

  async create(data: CreateNoteDto & { userId: number }): Promise<Note> {
    const entity = this.noteRepository.create({
      title: data.title,
      contentMd: data.contentMd,
      categoryPath: data.categoryPath ?? null,
      tags: data.tags ?? [],
      frontmatter: data.frontmatter ?? {},
      embedding: null,
      userId: data.userId,
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

  async findByUserId(
    userId: number,
    filters?: { search?: string },
  ): Promise<Note[]> {
    const qb = this.noteRepository
      .createQueryBuilder('note')
      .where('note.userId = :userId', { userId })
      .andWhere('note.deletedAt IS NULL');

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
   */
  async findByCategoryPath(
    userId: number,
    categoryPath: string,
    depth = 0,
  ): Promise<Note[]> {
    const sanitized = categoryPath.replace(/[^a-zA-Z0-9_.]/g, '');
    if (!sanitized) return [];

    const prefix = depth > 0 ? `${sanitized}.*{0,${depth}}` : sanitized;
    const sql = `
      SELECT * FROM ext_ka_notes
      WHERE user_id = $1
        AND deleted_at IS NULL
        AND category_path <@ $2::ltree
      ORDER BY created_at DESC
    `;
    const rows = await this.dataSource.query(sql, [userId, prefix]);
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

  async upsertLinks(sourceNoteId: string, targetTitles: string[]): Promise<void> {
    if (targetTitles.length === 0) return;

    const targets = await this.noteRepository
      .createQueryBuilder('note')
      .select(['note.id', 'note.title'])
      .where('note.title IN (:...titles)', { titles: targetTitles })
      .andWhere('note.deletedAt IS NULL')
      .getMany();

    for (const target of targets) {
      if (target.id === sourceNoteId) continue;
      await this.dataSource
        .createQueryBuilder()
        .insert()
        .into(NoteLinkEntity)
        .values({ sourceNoteId, targetNoteId: target.id })
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
   * Graph query: notes belonging to the user, optionally filtered by
   * category_path (ltree prefix) or a single tag (jsonb contains).
   * Returns the minimal columns needed by the graph viewer.
   *
   * Uses raw SQL when category_path filter is present because TypeORM's
   * query builder does not handle the ltree `<@` operator + `::ltree` cast.
   */
  async findNotesForGraph(
    userId: number,
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

      const params: unknown[] = [userId, sanitized];
      let sql = `
        SELECT id, title, tags, category_path
        FROM ext_ka_notes
        WHERE user_id = $1
          AND deleted_at IS NULL
          AND category_path <@ $2::ltree
      `;
      if (filters.tag) {
        params.push(JSON.stringify([filters.tag]));
        sql += ` AND tags @> $3::jsonb`;
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
      .where('note.userId = :userId', { userId })
      .andWhere('note.deletedAt IS NULL');

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
   * the given set of note ids. Avoids leaking links that point to other users'
   * notes or to deleted notes outside the visible set.
   */
  async findLinksForNotes(
    userId: number,
    noteIds: string[],
  ): Promise<Array<{ source_note_id: string; target_note_id: string }>> {
    if (noteIds.length === 0) return [];
    const sql = `
      SELECT l.source_note_id, l.target_note_id
      FROM ext_ka_note_links l
      JOIN ext_ka_notes s ON s.id = l.source_note_id
      JOIN ext_ka_notes t ON t.id = l.target_note_id
      WHERE s.user_id = $1
        AND t.user_id = $1
        AND s.deleted_at IS NULL
        AND t.deleted_at IS NULL
        AND l.source_note_id = ANY($2::uuid[])
        AND l.target_note_id = ANY($2::uuid[])
    `;
    return this.dataSource.query(sql, [userId, noteIds]);
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
    note.userId = Number(row['user_id']);
    note.createdAt = new Date(row['created_at'] as string);
    note.updatedAt = new Date(row['updated_at'] as string);
    note.deletedAt = row['deleted_at']
      ? new Date(row['deleted_at'] as string)
      : null;
    return note;
  }
}