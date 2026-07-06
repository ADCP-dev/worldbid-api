import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { UploadPostClientService } from '@ext/upload-post/services/upload-post-client.service';
import { UpPostAnalyticsSnapshotEntity } from '@ext/upload-post/infrastructure/persistence/entities/up-post-analytics-snapshot.entity';

const ALL_PLATFORMS = [
  'instagram',
  'tiktok',
  'linkedin',
  'facebook',
  'x',
  'youtube',
  'threads',
  'pinterest',
  'reddit',
  'bluesky',
];

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly client: UploadPostClientService,
    @InjectRepository(UpPostAnalyticsSnapshotEntity)
    private readonly snapshotRepo: Repository<UpPostAnalyticsSnapshotEntity>,
  ) {}

  /**
   * Fetch live analytics for the configured profile across all platforms.
   */
  async getAnalytics(profileUsername?: string, platforms?: string[]) {
    const user = profileUsername ?? this.client.profileUsername;
    if (!user) throw new Error('profileUsername is required (not configured)');
    return this.client.getAnalytics(user, platforms ?? ALL_PLATFORMS);
  }

  async getTotalImpressions(profileUsername?: string) {
    const user = profileUsername ?? this.client.profileUsername;
    if (!user) throw new Error('profileUsername is required (not configured)');
    return this.client.getTotalImpressions(user);
  }

  async getPostAnalytics(requestId: string) {
    return this.client.getPostAnalytics(requestId);
  }

  async getPlatformMetrics() {
    return this.client.getPlatformMetrics();
  }

  /**
   * Daily cron: snapshot analytics to DB for the weekly report.
   * Runs at 23:00 every day.
   */
  @Cron('0 23 * * *')
  async dailySnapshot() {
    if (!this.client.isConfigured) return;

    const user = this.client.profileUsername;
    if (!user) return;

    this.logger.log('Running daily analytics snapshot…');
    try {
      const data = await this.client.getAnalytics(user, ALL_PLATFORMS);

      if (!data || typeof data !== 'object') {
        this.logger.warn('Analytics API returned no data — skipping snapshot');
        return;
      }

      const today = new Date().toISOString().slice(0, 10);

      // Batch fetch existing snapshots for today (avoids N+1 queries)
      const existingRows = await this.snapshotRepo.find({
        where: { snapshotDate: today },
      });
      const existingMap = new Map(existingRows.map((r) => [r.platform, r]));

      const toSave: UpPostAnalyticsSnapshotEntity[] = [];
      let saved = 0;

      for (const [platform, metrics] of Object.entries(data)) {
        // Skip non-platform keys (success, message, etc.)
        if (platform === 'success' || platform === 'message') continue;
        if (!metrics || typeof metrics !== 'object') continue;

        const m = metrics as {
          followers?: number;
          reach?: number;
          views?: number;
          impressions?: number;
          likes?: number;
          comments?: number;
          shares?: number;
          saves?: number;
          profileViews?: number;
          reach_timeseries?: Array<{ date: string; value: number }>;
        };

        const row = existingMap.get(platform) ?? this.snapshotRepo.create({
          platform,
          snapshotDate: today,
          profileUsername: user,
        });

        row.followers = Number(m.followers ?? 0);
        row.reach = Number(m.reach ?? 0);
        row.views = Number(m.views ?? 0);
        row.impressions = Number(m.impressions ?? 0);
        row.likes = Number(m.likes ?? 0);
        row.comments = Number(m.comments ?? 0);
        row.shares = Number(m.shares ?? 0);
        row.saves = Number(m.saves ?? 0);
        row.profileViews = Number(m.profileViews ?? 0);
        row.timeSeries = m.reach_timeseries ?? null;

        toSave.push(row);
        saved++;
      }

      // Batch save all rows in one transaction
      if (toSave.length > 0) {
        await this.snapshotRepo.save(toSave);
      }

      this.logger.log(`Daily analytics snapshot saved (${saved} platforms)`);
    } catch (err: unknown) {
      this.logger.error(
        `Daily snapshot failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Get the last N days of snapshots for the weekly report.
   */
  async getSnapshotsForLastDays(days: number): Promise<UpPostAnalyticsSnapshotEntity[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().slice(0, 10);

    return this.snapshotRepo
      .createQueryBuilder('s')
      .where('s.snapshotDate >= :since', { since: sinceStr })
      .orderBy('s.snapshotDate', 'ASC')
      .getMany();
  }

  /**
   * Weekly cron: clean up snapshots older than 90 days.
   * Runs every Sunday at 02:00.
   */
  @Cron('0 2 * * 0')
  async cleanupOldSnapshots() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const result = await this.snapshotRepo
      .createQueryBuilder('s')
      .delete()
      .where('s.snapshotDate < :cutoff', { cutoff: cutoffStr })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(`Cleaned up ${result.affected} snapshots older than ${cutoffStr}`);
    }
  }
}