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
import { ModelProviderEntity } from './model-provider.entity';

/**
 * ext_ka_models — models available under a provider.
 *
 * `model_id` is the provider-specific identifier (e.g. "glm-5.2",
 * "north-mini-code-1.0"). `active` marks the currently selected model for a
 * provider (only one active per provider is enforced at the service layer).
 */
@Entity('ext_ka_models')
export class ModelEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Index('idx_ka_models_provider_id')
  @Column({ type: 'uuid', name: 'provider_id' })
  providerId: string;

  @ManyToOne(() => ModelProviderEntity, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'provider_id' })
  provider: ModelProviderEntity;

  @Column({ type: 'varchar', length: 255, name: 'model_id' })
  modelId: string;

  @Column({ type: 'varchar', length: 255, name: 'display_name' })
  displayName: string;

  @Column({ type: 'int', name: 'context_window' })
  contextWindow: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}