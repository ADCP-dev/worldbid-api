import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';
import { CrmClientEntity } from '@ext/crm/infrastructure/persistence/entities/crm-client.entity';
import { CrmOriginEntity } from '@ext/crm/infrastructure/persistence/entities/crm-origin.entity';
import { AffiliatePartnerEntity } from './affiliate-partner.entity';
import { AffiliateCommissionEntity } from './affiliate-commission.entity';

@Entity('ext_affiliate_referral')
@Index(['partnerId'])
@Index(['clientId'], { unique: true })
export class AffiliateReferralEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  partnerId: number;

  @ManyToOne(() => AffiliatePartnerEntity, (partner) => partner.referrals, {
    eager: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'partnerId' })
  partner: AffiliatePartnerEntity;

  @Column({ type: 'int', unique: true })
  clientId: number;

  @ManyToOne(() => CrmClientEntity, {
    eager: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clientId' })
  client: CrmClientEntity;

  @Column({ type: 'int', nullable: true })
  originId: number | null;

  @ManyToOne(() => CrmOriginEntity, {
    eager: false,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'originId' })
  origin: CrmOriginEntity | null;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: string; // "pending" | "converted" | "rejected"

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  referredAt: Date;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(
    () => AffiliateCommissionEntity,
    (commission) => commission.referral,
  )
  commissions: AffiliateCommissionEntity[];
}
