import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';
import { UserEntity } from '@users/infrastructure/entities/user.entity';

/**
 * ext_ka_notes — knowledge base note.
 *
 * Notes are a GLOBAL shared knowledge base: every authenticated user sees
 * every note. `user_id` is kept as nullable metadata of who CREATED the
 * note (provenance only); it is NOT used for scoping queries.
 *
 * Special column types (defined in migration, not by TypeORM sync):
 * - `category_path` is `ltree` in Postgres. Declared as text here for
 *   TypeORM mapping; raw SQL is used for tree queries.
 * - `embedding` is `vector(1536)` via pgvector. Declared as text here;
 *   the Bull processor updates it via raw SQL (`<=>` cosine operator).
 */
@Entity('ext_ka_notes')
export class NoteEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', name: 'content_md' })
  contentMd: string;

  @Column({ type: 'text', name: 'category_path', nullable: true })
  categoryPath: string | null;

  @Column({ type: 'jsonb', name: 'tags', default: [] })
  tags: string[];

  @Column({ type: 'jsonb', name: 'frontmatter', default: {} })
  frontmatter: Record<string, unknown>;

  @Column({ type: 'text', name: 'embedding', nullable: true })
  embedding: string | null;

  /**
   * Creator provenance — nullable metadata only. NOT used for scoping.
   * The FK is kept (ON DELETE SET NULL) so deleting a user keeps their
   * notes in the shared knowledge base.
   */
  @Index('idx_ka_notes_user_id')
  @Column({ type: 'int', name: 'user_id', nullable: true })
  userId: number | null;

  @ManyToOne(() => UserEntity, { eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}