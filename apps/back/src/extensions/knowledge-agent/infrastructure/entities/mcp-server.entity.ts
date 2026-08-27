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
import { AgentConfigEntity } from './agent-config.entity';

/**
 * ext_ka_mcp_servers — MCP server registry.
 *
 * `agent_config_id` is nullable: a server can be global (shared by configs via
 * `ext_ka_agent_configs.mcp_server_ids`) or scoped to a single config. Transport
 * is "http" (remote URL) or "stdio" (local subprocess; `url` holds the command).
 */
@Entity('ext_ka_mcp_servers')
export class McpServerEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Index('idx_ka_mcp_servers_agent_config_id')
  @Column({ type: 'uuid', name: 'agent_config_id', nullable: true })
  agentConfigId: string | null;

  @ManyToOne(() => AgentConfigEntity, {
    eager: false,
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'agent_config_id' })
  agentConfig: AgentConfigEntity | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 16 })
  transport: string;

  @Column({ type: 'varchar', length: 512 })
  url: string;

  @Column({ type: 'varchar', length: 255, name: 'api_key_ref', nullable: true })
  apiKeyRef: string | null;

  /** Extra HTTP headers (auth-proxies, gateway tenant routing). JSON object. */
  @Column({ type: 'jsonb', nullable: true })
  headers: Record<string, string> | null;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
