/**
 * DbBranchEntity — tracking table for schema-level branches.
 *
 * Lives in the `public` schema so the DbBranchManager can track branches even
 * when operating against a different search_path. The BranchManager uses raw
 * SQL against this table (not the repository) for full control; this entity
 * exists solely so `pnpm migration:generate` detects the table.
 *
 * @see prds/agent-native/04-database-branching.md
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('_db_branches')
@Index('idx_db_branches_status', ['status'])
export class DbBranchEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  schema: string;

  @Column({ type: 'varchar', length: 120, name: 'parent_schema', default: 'public' })
  parentSchema: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ type: 'boolean', name: 'copy_data', default: true })
  copyData: boolean;

  @Column({ type: 'varchar', length: 100, name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', name: 'merged_at', nullable: true })
  mergedAt: Date | null;

  @Column({ type: 'timestamp', name: 'discarded_at', nullable: true })
  discardedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}