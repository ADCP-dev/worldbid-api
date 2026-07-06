import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';
import { CrmProjectEntity } from '@ext/crm/infrastructure/persistence/entities/crm-project.entity';
import { AffiliateReferralEntity } from './affiliate-referral.entity';

@Entity('ext_affiliate_commission')
@Index(['referralId'])
@Index(['projectId'])
@Index(['referralId', 'projectId'], { unique: true })
export class AffiliateCommissionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  referralId: number;

  @ManyToOne(
    () => AffiliateReferralEntity,
    (referral) => referral.commissions,
    {
      eager: false,
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'referralId' })
  referral: AffiliateReferralEntity;

  @Column({ type: 'int' })
  projectId: number;

  @ManyToOne(() => CrmProjectEntity, {
    eager: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'projectId' })
  project: CrmProjectEntity;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  baseAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  commissionRate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  commissionAmount: number;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: string; // "pending" | "approved" | "paid"

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
