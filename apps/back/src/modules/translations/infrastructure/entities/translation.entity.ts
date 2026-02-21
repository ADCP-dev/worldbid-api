import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../infrastructure/utils/relational-entity-helper';
import { LangEntity } from './lang.entity';

@Entity({
  name: 'translation',
})
export class TranslationEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ nullable: true })
  app?: string; // e.g. 'front', 'back', 'common'

  @Index()
  @Column()
  section: string;

  @Index()
  @Column()
  key: string;

  @Column({ type: 'text' })
  content: string;

  @ManyToOne(() => LangEntity, { eager: true })
  lang: LangEntity;

  @Index()
  @Column({ nullable: true })
  entityName?: string;

  @Index()
  @Column({ nullable: true })
  entityId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
