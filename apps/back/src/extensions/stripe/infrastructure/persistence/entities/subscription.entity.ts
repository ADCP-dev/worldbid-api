import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlanEntity } from './plan.entity';

@Entity('ext_stripe_subscription')
export class SubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  stripeId: string;

  @Column()
  userId: number;

  @Column()
  planId: string;

  @OneToOne(() => PlanEntity)
  @JoinColumn({ name: 'planId' })
  plan: PlanEntity;

  @Column({
    type: 'enum',
    enum: ['active', 'past_due', 'canceled', 'incomplete', 'trialing'],
    default: 'incomplete',
  })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  currentPeriodStart: Date;

  @Column({ type: 'timestamp', nullable: true })
  currentPeriodEnd: Date;

  @Column({ type: 'timestamp', nullable: true })
  trialEnd: Date;

  @Column({ default: false })
  cancelAtPeriodEnd: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
