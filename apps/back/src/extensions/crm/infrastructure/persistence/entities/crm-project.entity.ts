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
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';
import { CrmClientEntity } from './crm-client.entity';

@Entity('ext_crm_project')
@Index(['clientId'])
@Index(['status'])
@Index(['paymentStatus'])
export class CrmProjectEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  clientId: number;

  @ManyToOne(() => CrmClientEntity, (client) => client.projects, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clientId' })
  client: CrmClientEntity;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  type: 'pack_1' | 'pack_2' | 'pack_3' | 'pack_4' | 'custom' | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price: number | null;

  @Column({ type: 'varchar', length: 50, default: 'quoted' })
  status: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  paymentStatus: string;

  @Column({ type: 'date', nullable: true })
  startDate: string | null;

  @Column({ type: 'date', nullable: true })
  endDate: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
