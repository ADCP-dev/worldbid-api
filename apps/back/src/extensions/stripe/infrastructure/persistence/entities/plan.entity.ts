import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { PriceEntity } from './price.entity';

@Entity('ext_stripe_plan')
@Index(['priceId'])
export class PlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  priceId: string;

  @OneToOne(() => PriceEntity)
  @JoinColumn({ name: 'priceId' })
  price: PriceEntity;

  @Column({ type: 'int', nullable: true })
  maxUsers: number;

  @Column({ type: 'bigint', nullable: true })
  maxStorage: number;

  @Column({ type: 'jsonb', nullable: true })
  features: string[];

  @Column({ default: false })
  isDefault: boolean;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
