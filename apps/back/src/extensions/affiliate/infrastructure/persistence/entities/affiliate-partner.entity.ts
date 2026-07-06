import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';
import { CrmClientEntity } from '@ext/crm/infrastructure/persistence/entities/crm-client.entity';
import { UserEntity } from '@users/infrastructure/entities/user.entity';
import { AffiliateReferralEntity } from './affiliate-referral.entity';

@Entity('ext_affiliate_partner')
@Index(['email'], { unique: true })
@Index(['userId'])
export class AffiliatePartnerEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  clientId: number | null;

  @ManyToOne(() => CrmClientEntity, {
    eager: false,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'clientId' })
  client: CrmClientEntity | null;

  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => UserEntity, {
    eager: false,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity | null;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  companyName: string | null;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  iban: string | null;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0.05,
  })
  commissionRate: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @OneToMany(() => AffiliateReferralEntity, (referral) => referral.partner)
  referrals: AffiliateReferralEntity[];
}
