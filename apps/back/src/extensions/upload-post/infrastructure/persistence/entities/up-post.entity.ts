import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Local record of every upload dispatched via Upload-Post.
 * Mirrors the async job lifecycle: pending → processing → success / error.
 */
@Entity('ext_uploadpost_post')
@Index(['status'])
@Index(['profileUsername'])
export class UpPostEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  jobId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  requestId: string | null;

  @Column({ type: 'varchar', length: 50 })
  mediaType: 'video' | 'photo' | 'text';

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  caption: string;

  @Column({ type: 'jsonb', default: [] })
  platforms: string[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  profileUsername: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  mediaUrl: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: 'pending',
  })
  status: 'pending' | 'processing' | 'success' | 'error' | 'scheduled';

  @Column({ type: 'jsonb', nullable: true })
  results: Record<
    string,
    { success: boolean; url?: string; error?: string; publishId?: string }
  > | null;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
