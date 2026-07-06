import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Local cache of AutoDM monitors running on Upload-Post.
 * The monitor ID is the one returned by Upload-Post — we store it
 * so we can pause/resume/stop without polling the API.
 */
@Entity('ext_uploadpost_autodm_monitor')
@Index(['monitorId'], { unique: true })
export class UpPostAutodmMonitorEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  monitorId: string;

  @Column({ type: 'text' })
  postUrl: string;

  @Column({ type: 'text' })
  replyMessage: string;

  @Column({ type: 'jsonb', default: [] })
  triggerKeywords: string[];

  @Column({ type: 'int', default: 15 })
  monitoringInterval: number;

  @Column({
    type: 'varchar',
    length: 30,
    default: 'running',
  })
  status: 'running' | 'paused' | 'stopped' | 'expired';

  @Column({ type: 'int', default: 0 })
  dmsSent: number;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  stoppedAt: Date;

  @Column({ type: 'text', nullable: true })
  stopReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
