import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';

/**
 * Execution record for a single pipeline phase invocation.
 * Table: ext_aa_run
 */
@Entity('ext_aa_run')
@Index(['configId'])
@Index(['projectId'])
export class AaRunEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  configId: string;

  @Index()
  @Column({ type: 'uuid' })
  projectId: string;

  /** research | generate | publish | metrics */
  @Index()
  @Column({ type: 'varchar', length: 20 })
  runType: string;

  /** pending | running | completed | failed */
  @Index()
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  /** Run duration in milliseconds. */
  @Column({ type: 'int', nullable: true })
  duration: number | null;

  /** Free-form job output / payload. */
  @Column({ type: 'jsonb', default: {} })
  output: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;
}