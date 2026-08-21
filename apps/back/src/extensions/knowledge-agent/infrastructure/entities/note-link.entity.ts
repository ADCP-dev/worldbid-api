import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';
import { NoteEntity } from './note.entity';

@Entity('ext_ka_note_links')
@Unique('uq_ka_note_links_source_target', ['sourceNoteId', 'targetNoteId'])
export class NoteLinkEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ type: 'uuid', name: 'source_note_id' })
  sourceNoteId: string;

  @ManyToOne(() => NoteEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_note_id' })
  sourceNote: NoteEntity;

  @Column({ type: 'uuid', name: 'target_note_id' })
  targetNoteId: string;

  @ManyToOne(() => NoteEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_note_id' })
  targetNote: NoteEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}