import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Content ideas for the internal editorial calendar.
 * Managed via kanban board (idea → drafting → ready → published).
 * Purely internal — not tied to Upload-Post API.
 */
@Entity('ext_uploadpost_content_idea')
@Index(['status', 'order'])
export class UpPostContentIdeaEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: 'idea',
  })
  status: 'idea' | 'drafting' | 'ready' | 'scheduled' | 'published';

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  priority: 'low' | 'medium' | 'high';

  @Column({ type: 'jsonb', default: [] })
  platforms: string[];

  @Column({ type: 'jsonb', default: [] })
  tags: string[];

  @Column({ type: 'jsonb', nullable: true })
  checklist: Array<{ id: string; text: string; done: boolean }>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  mediaUrl: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  caption: string;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
