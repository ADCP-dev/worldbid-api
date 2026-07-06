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
import { ContentPipelineProjectEntity } from './project.entity';

@Entity('ext_cp_idea')
@Index(['projectId'])
@Index(['status'])
export class ContentPipelineIdeaEntity extends EntityRelationalHelper {
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

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  angle: string | null;

  @Column({ type: 'jsonb', default: [] })
  keywords: string[];

  @Column({ type: 'jsonb', default: [] })
  targetPlatforms: string[]; // ["blog", "instagram", "pinterest", "tiktok"]

  @Column({ type: 'varchar', length: 50, default: 'recipe' })
  contentType: string; // "recipe" | "comparison" | "tips" | "review" | "listicle" | "guide"

  @Column({ type: 'varchar', length: 50, default: 'manual' })
  source: string; // "manual" | "ai_research" | "trend" | "competitor_analysis"

  /** Research data: { trendingTopics, searchVolume, difficulty, competitorUrls, relatedKeywords } */
  @Column({ type: 'jsonb', default: '{}' })
  researchData: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20, default: 'idea' })
  status: string; // "idea" | "approved" | "generating" | "generated" | "rejected"

  @Column({ type: 'int', default: 3 })
  priority: number; // 1-5

  @Column({ type: 'float', default: 0 })
  order: number; // kanban ordering

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
