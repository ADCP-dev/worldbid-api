import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';

/**
 * ext_ka_model_providers — LLM provider registry.
 *
 * Stores connection details for Ollama / OpenRouter. `api_key_ref` is the NAME
 * of an environment variable (never the key itself). `base_url` is the runtime
 * endpoint used by embeddings and chat clients.
 */
@Entity('ext_ka_model_providers')
export class ModelProviderEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 64 })
  provider: string;

  @Column({ type: 'varchar', length: 255, name: 'api_key_ref', nullable: true })
  apiKeyRef: string | null;

  @Column({ type: 'varchar', length: 255, name: 'base_url', nullable: true })
  baseUrl: string | null;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}