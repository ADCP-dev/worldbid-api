import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ProductEntity } from './product.entity';

@Entity('ext_stripe_price')
@Index(['productId'])
export class PriceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  stripeId: string;

  @Column()
  productId: string;

  @ManyToOne(() => ProductEntity, { eager: false })
  @JoinColumn({ name: 'productId' })
  product: ProductEntity;

  @Column({ default: 'eur' })
  currency: string;

  @Column()
  unitAmount: number;

  @Column({
    type: 'enum',
    enum: ['one_time', 'recurring'],
    default: 'recurring',
  })
  type: string;

  @Column({ type: 'enum', enum: ['month', 'year'], nullable: true })
  interval: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
