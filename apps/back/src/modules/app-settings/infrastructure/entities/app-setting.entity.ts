import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';

@Entity({
  name: 'app_setting',
})
export class AppSettingEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  key: string;

  @Column({ type: 'jsonb', default: '{}' })
  value: Record<string, unknown>;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  section: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}