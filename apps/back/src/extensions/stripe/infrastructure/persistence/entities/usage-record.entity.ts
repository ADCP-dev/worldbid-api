import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { SubscriptionEntity } from './subscription.entity';

@Entity('ext_stripe_usage_record')
export class UsageRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  subscriptionId: string;

  @OneToOne(() => SubscriptionEntity)
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
