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

@Entity('ext_cp_project')
export class ContentPipelineProjectEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  slug: string;

  @Column({ type: 'varchar', length: 100 })
  niche: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', default: [] })
  keywords: string[];

  @Column({ type: 'text', nullable: true })
  brandVoice: string | null;

  @Column({ type: 'text', nullable: true })
  targetAudience: string | null;

  @Column({ type: 'varchar', length: 10, default: 'es' })
  language: string;

  /** AI persona config: { name, bio, avatarUrl, credentials } */
  @Column({ type: 'jsonb', default: '{}' })
  authorPersona: Record<string, unknown>;

  /** Affiliate config: { enabled, programs: [{name, network, trackingId, commission}], autoInject, disclosureText } */
  @Column({ type: 'jsonb', default: '{}' })
  affiliateConfig: Record<string, unknown>;

  /** Social config: { platforms, profileUsername, postingSchedule, warmupPhase } */
  @Column({ type: 'jsonb', default: '{}' })
  socialConfig: Record<string, unknown>;

  /** CMS config: { enabled, autoPublish, categoryId, authorUserId } */
  @Column({ type: 'jsonb', default: '{}' })
  cmsConfig: Record<string, unknown>;

  /** Auto-publish gates: { blog: false, social: false } */
  @Column({ type: 'jsonb', default: { blog: false, social: false } })
  autoPublish: { blog: boolean; social: boolean };

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string; // "active" | "paused" | "archived"

  /** Brand design system document (DESIGN.md content) injected into LLM prompts. */
  @Column({ type: 'text', nullable: true })
  designDoc: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
