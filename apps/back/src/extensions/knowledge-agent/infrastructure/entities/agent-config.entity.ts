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

/**
 * ext_ka_agent_configs — DeepAgent configuration.
 *
 * Stores the system_prompt, model reference, sandbox permissions, and the
 * set of MCP servers the agent should connect to. Owned by a user.
 */
@Entity('ext_ka_agent_configs')
export class AgentConfigEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', name: 'system_prompt' })
  systemPrompt: string;

  /**
   * Model string accepted by `createDeepAgent({ model })`.
   * Examples: "openrouter:z-ai/glm-5.2", "ollama:north-mini-code-1.0".
   */
  @Column({ type: 'varchar', length: 255 })
  model: string;

  /**
   * Provider tag derived from the model string prefix.
   * "ollama" | "openrouter".
   */
  @Column({ type: 'varchar', length: 64 })
  provider: string;

  /**
   * Sandbox permissions block merged into `createDeepAgent({ permissions })`.
   * Shape: { allow: string[]; deny: string[] }.
   */
  @Column({ type: 'jsonb', name: 'permissions', default: { allow: [], deny: [] } })
  permissions: { allow: string[]; deny: string[] };

  /**
   * Array of ext_ka_mcp_servers ids the agent should load tools from.
   */
  @Column({ type: 'jsonb', name: 'mcp_server_ids', default: [] })
  mcpServerIds: string[];

  @Index('idx_ka_agent_configs_user_id')
  @Column({ type: 'int', name: 'user_id' })
  userId: number;

  @ManyToOne(() => UserEntity, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}