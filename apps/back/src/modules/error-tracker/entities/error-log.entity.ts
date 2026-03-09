import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';

@Entity({
  name: 'error_logs',
})
export class ErrorLogEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ unique: true })
  hash: string;

  @Column({ type: String })
  message: string;

  @Column({ type: String, nullable: true })
  source: string;

  @Column({ type: 'text', nullable: true })
  stack: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ type: 'int', default: 1 })
  occurrences: number;

  @Index()
  @Column({ type: 'boolean', default: false })
  resolved: boolean;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn()
  firstOccurredAt: Date;

  @UpdateDateColumn()
  lastOccurredAt: Date;
}
