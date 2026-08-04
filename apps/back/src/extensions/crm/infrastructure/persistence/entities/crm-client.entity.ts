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
import { CrmStatusEntity } from './crm-status.entity';
import { CrmOriginEntity } from './crm-origin.entity';
import type { CrmContactEntity } from './crm-contact.entity';
import type { CrmInteractionEntity } from './crm-interaction.entity';
import type { CrmProjectEntity } from './crm-project.entity';

@Entity('ext_crm_client')
@Index(['statusId'])
@Index(['originId'])
@Index(['email'])
@Index(['name'])
export class CrmClientEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  companyName: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  nif: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  region: string | null;

  @Column({ type: 'varchar', length: 100, default: 'España' })
  country: string;

  @Column({ type: 'int', default: 1 })
  statusId: number;

  @ManyToOne(() => CrmStatusEntity, { eager: false })
  @JoinColumn({ name: 'statusId' })
  status: CrmStatusEntity;

  @Column({ type: 'int', nullable: true })
  originId: number | null;

  @ManyToOne(() => CrmOriginEntity, {
    eager: false,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'originId' })
  origin: CrmOriginEntity | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  originDetail: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, unknown>;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @OneToMany(
    () => {
      const { CrmContactEntity } = require('./crm-contact.entity');
      return CrmContactEntity;
    },
    (contact: CrmContactEntity) => contact.client,
  )
  contacts: CrmContactEntity[];

  @OneToMany(
    () => {
      const { CrmInteractionEntity } = require('./crm-interaction.entity');
      return CrmInteractionEntity;
    },
    (interaction: CrmInteractionEntity) => interaction.client,
  )
  interactions: CrmInteractionEntity[];

  @OneToMany(
    () => {
      const { CrmProjectEntity } = require('./crm-project.entity');
      return CrmProjectEntity;
    },
    (project: CrmProjectEntity) => project.client,
  )
  projects: CrmProjectEntity[];
}
