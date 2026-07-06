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
import { ContentPipelineIdeaEntity } from './idea.entity';

@Entity('ext_cp_draft')
@Index(['projectId'])
@Index(['ideaId'])
@Index(['status'])
export class ContentPipelineDraftEntity extends EntityRelationalHelper {
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
  ideaId: string | null;

  @ManyToOne(() => ContentPipelineIdeaEntity, {
    eager: false,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'ideaId' })
  idea: ContentPipelineIdeaEntity | null;

  /** Blog content in HTML — ready for CMS BlogPost body */
  @Column({ type: 'text', nullable: true })
  blogContent: string | null;

  /** SEO: { metaTitle, metaDescription, focusKeyword, jsonLd, slug } */
  @Column({ type: 'jsonb', default: '{}' })
  seoMetadata: Record<string, unknown>;

  /** Social variants: [{ platform, mediaType, caption, hashtags, mediaPrompt }] */
  @Column({ type: 'jsonb', default: [] })
  socialVariants: Record<string, unknown>[];

  /** Generated images: [{ url, type, alt }] */
  @Column({ type: 'jsonb', default: [] })
  images: Record<string, unknown>[];

  /** Affiliate links injected: [{ url, anchorText, productId, program, asin }] */
  @Column({ type: 'jsonb', default: [] })
  affiliateLinks: Record<string, unknown>[];

  /** Generation log: { model, tokensUsed, imagesGenerated, generationTime } */
  @Column({ type: 'jsonb', default: '{}' })
  generationLog: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: string; // "draft" | "in_review" | "approved" | "publishing" | "published" | "rejected"

  @Column({ type: 'text', nullable: true })
  reviewNotes: string | null;

  /** Published refs: { blogPostId, socialPosts: [{ platform, uploadPostId, scheduledAt }] } */
  @Column({ type: 'jsonb', default: '{}' })
  publishedTo: Record<string, unknown>;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}