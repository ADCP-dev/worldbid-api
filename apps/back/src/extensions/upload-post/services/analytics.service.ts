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
      let saved = 0;

      for (const [platform, metrics] of Object.entries(data)) {
        // Skip non-platform keys (success, message, etc.)
        if (platform === 'success' || platform === 'message') continue;
        if (!metrics || typeof metrics !== 'object') continue;

        const m = metrics as any;

        const existing = await this.snapshotRepo.findOne({
          where: { platform, snapshotDate: today },
        });

        const row = existing ?? this.snapshotRepo.create({
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

        await this.snapshotRepo.save(row);
        saved++;
      }

      this.logger.log(`Daily analytics snapshot saved (${saved} platforms)`);
    } catch (err: any) {
      this.logger.error(`Daily snapshot failed: ${err.message}`);
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
}