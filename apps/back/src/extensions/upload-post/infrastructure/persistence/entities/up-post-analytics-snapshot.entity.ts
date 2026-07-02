import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Periodic snapshot of social analytics metrics — one row per platform per day.
 * Populated by the AnalyticsService daily cron and consumed by WeeklyReportService.
 */
@Entity('ext_uploadpost_analytics_snapshot')
@Index(['platform', 'snapshotDate'], { unique: true })
export class UpPostAnalyticsSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  platform: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  profileUsername: string;

  @Column({ type: 'date' })
  snapshotDate: string;

  @Column({ type: 'bigint', default: 0 })
  followers: number;

  @Column({ type: 'bigint', default: 0 })
  reach: number;

  @Column({ type: 'bigint', default: 0 })
  views: number;

  @Column({ type: 'bigint', default: 0 })
  impressions: number;

  @Column({ type: 'bigint', default: 0 })
  likes: number;

  @Column({ type: 'bigint', default: 0 })
  comments: number;

  @Column({ type: 'bigint', default: 0 })
  shares: number;

  @Column({ type: 'bigint', default: 0 })
  saves: number;

  @Column({ type: 'bigint', default: 0 })
  profileViews: number;

  @Column({ type: 'jsonb', nullable: true })
  timeSeries: Array<{ date: string; value: number }>;

  @CreateDateColumn()
  createdAt: Date;
}