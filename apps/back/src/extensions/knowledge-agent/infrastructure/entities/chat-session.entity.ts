import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';
import { UserEntity } from '@users/infrastructure/entities/user.entity';
import { AgentConfigEntity } from './agent-config.entity';

/**
 * ext_ka_chat_sessions — per-user chat session over a DeepAgent config.
 *
 * `agent_config_id` is nullable so a session can fall back to the user's
 * default agent config. `user_id` scopes every session — the ChatService
 * enforces ownership (403 cross-user) before any read/write.
 */
@Entity('ext_ka_chat_sessions')
export class ChatSessionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Index('idx_ka_chat_sessions_user_id')
  @Column({ type: 'int', name: 'user_id' })
  userId: number;

  @ManyToOne(() => UserEntity, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ type: 'uuid', name: 'agent_config_id', nullable: true })
  agentConfigId: string | null;

  @ManyToOne(() => AgentConfigEntity, { eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'agent_config_id' })
  agentConfig: AgentConfigEntity | null;

  @Column({ type: 'varchar', length: 255, default: 'New Chat' })
  title: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}