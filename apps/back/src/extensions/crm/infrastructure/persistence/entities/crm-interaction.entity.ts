import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';
import { CrmClientEntity } from './crm-client.entity';
import { CrmContactEntity } from './crm-contact.entity';

@Entity('ext_crm_interaction')
@Index(['clientId'])
export class CrmInteractionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  clientId: number;

  @ManyToOne(() => CrmClientEntity, (client) => client.interactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clientId' })
  client: CrmClientEntity;

  @Column({ type: 'int', nullable: true })
  contactId: number | null;

  @ManyToOne(() => CrmContactEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'contactId' })
  contact: CrmContactEntity | null;

  @Column({ type: 'varchar', length: 50 })
  type: 'meeting' | 'call' | 'email' | 'whatsapp' | 'note' | 'other';

  @Column({ type: 'varchar', length: 255, nullable: true })
  subject: string | null;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  interactionDate: Date;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}