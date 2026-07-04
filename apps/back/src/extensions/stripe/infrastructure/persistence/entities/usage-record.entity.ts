import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { SubscriptionEntity } from './subscription.entity';

@Entity('ext_stripe_usage_record')
@Index(['subscriptionId'])
export class UsageRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  subscriptionId: string;

  @ManyToOne(() => SubscriptionEntity, { eager: false })
  @JoinColumn({ name: 'subscriptionId' })
  subscription: SubscriptionEntity;

  @Column({ nullable: true })
  stripeId: string;

  @Column()
  quantity: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @Column({ type: 'enum', enum: ['set', 'increment'], default: 'set' })
  action: string;

  @CreateDateColumn()
  createdAt: Date;
}
