import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';

/**
 * Per-project autonomous-agent configuration.
 * Table: ext_aa_config
 */
@Entity('ext_aa_config')
export class AaConfigEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'varchar', length: 100, default: '0 9 * * *' })
  researchCron: string;

  @Column({ type: 'varchar', length: 100, default: '0 10 * * *' })
  generateCron: string;

  @Column({ type: 'varchar', length: 100, default: '0 18 * * *' })
  publishCron: string;

  @Column({ type: 'varchar', length: 100, default: '0 9 * * 1' })
  metricsCron: string;

  @Column({ type: 'boolean', default: false })
  autoApproveIdeas: boolean;

  @Column({ type: 'boolean', default: false })
  autoApproveDrafts: boolean;

  @Column({ type: 'boolean', default: true })
  notifyEmail: boolean;

  @Column({ type: 'boolean', default: false })
  notifyTelegram: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  telegramChatId: string | null;

  /**
   * Feedback loop state — accumulated priorities / weights / signals
   * produced by the feedback service. Shape is intentionally open.
   */
  @Column({ type: 'jsonb', default: {} })
  feedbackData: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string; // 'active' | 'paused' | 'archived'

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}