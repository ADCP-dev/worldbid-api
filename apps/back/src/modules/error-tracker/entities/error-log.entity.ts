import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';
import type {
  ErrorCategory,
  ErrorSeverity,
  FailurePoint,
  RelatedSpecRef,
  SuggestedFix,
} from '@src/core/spec-engine/spec.types';

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

  // ─── ActionableError enrichment (PRD 01) ───────────────────────────────
  // All columns are nullable so existing rows survive the migration
  // unchanged; new errors populate them via buildActionableError().

  @Index()
  @Column({ type: 'varchar', nullable: true })
  category: ErrorCategory | null;

  @Column({ type: 'varchar', nullable: true })
  severity: ErrorSeverity | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  extension: string | null;

  @Column({ type: 'varchar', nullable: true })
  resource: string | null;

  @Column({ type: 'varchar', nullable: true })
  specFile: string | null;

  @Column({ type: 'varchar', nullable: true })
  operation: string | null;

  @Column({ type: 'varchar', nullable: true })
  handlerFile: string | null;

  @Column({ type: 'jsonb', nullable: true })
  failurePoint: FailurePoint | null;

  @Column({ type: 'jsonb', nullable: true })
  suggestedFix: SuggestedFix | null;

  @Column({ type: 'jsonb', nullable: true })
  relatedSpec: RelatedSpecRef | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  requestId: string | null;

  @Column({ type: 'int', nullable: true })
  userId: number | null;
}
