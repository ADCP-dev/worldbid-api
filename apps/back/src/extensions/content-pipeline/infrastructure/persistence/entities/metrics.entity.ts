import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';
import { ContentPipelineProjectEntity } from './project.entity';

@Entity('ext_cp_metrics')
@Index(['projectId'])
@Index(['snapshotDate'])
@Index(['draftId'])
export class ContentPipelineMetricsEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @ManyToOne(() => ContentPipelineProjectEntity, {
    eager: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'projectId' })
  project: ContentPipelineProjectEntity;

  @Column({ type: 'uuid', nullable: true })
  draftId: string | null;

  @Column({ type: 'varchar', length: 50 })
  platform: string; // "blog" | "instagram" | "tiktok" | "pinterest" | ...

  @Column({ type: 'date' })
  snapshotDate: string; // YYYY-MM-DD

  /** Metrics: { views, clicks, engagement, affiliateClicks, affiliateConversions, revenue } */
  @Column({ type: 'jsonb', default: '{}' })
  metrics: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}