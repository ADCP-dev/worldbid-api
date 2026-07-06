import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';

/**
 * CTA video clip stored as a URL (S3 presigned or public CDN).
 * At most one row should have isActive=true (the default CTA used by templates).
 * Managed via the CtaVideoController CRUD endpoints.
 */
@Entity('ext_cp_cta_video')
@Index(['isActive'])
export class ContentPipelineCtaVideoEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** S3 presigned URL or public CDN URL to the MP4 clip. */
  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'varchar', length: 20, default: 'mp4' })
  format: string;

  @Column({ type: 'int', nullable: true })
  durationSec: number | null;

  /** Only one CTA video should be active at a time (the default). */
  @Column({ type: 'boolean', default: false })
  isActive: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
