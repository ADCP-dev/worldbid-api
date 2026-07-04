import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UploadPostClientService } from '@ext/upload-post/services/upload-post-client.service';
import { UpPostAnalyticsSnapshotEntity } from '@ext/upload-post/infrastructure/persistence/entities/up-post-analytics-snapshot.entity';
import { UpPostEntity } from '@ext/upload-post/infrastructure/persistence/entities/up-post.entity';
import { QueuedMailerService } from '@comms/email-queue/queued-mailer.service';
import { AllConfigType } from '@src/config/config.type';

export interface MonthlySummary {
  month: string;
  platforms: Array<{
    platform: string;
    followers: number;
    followersStart: number;
    followersEnd: number;
    followersDelta: number;
    avgReach: number;
    avgViews: number;
    totalReach: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalSaves: number;
    bestDay: { date: string; reach: number; views: number } | null;
  }>;
  totalImpressions: number;
  totalFollowersGrowth: number;
}

export interface MonthlyHistoryEntry {
  month: string;
  totalImpressions: number;
  totalFollowers: number;
  followersGrowth: number;
  platforms: Array<{
    platform: string;
    followers: number;
    reach: number;
    views: number;
    engagement: number;
  }>;
}

@Injectable()
export class MonthlyAnalyticsService {
  private readonly logger = new Logger(MonthlyAnalyticsService.name);

  constructor(
    private readonly client: UploadPostClientService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly queuedMailerService: QueuedMailerService,
    @InjectRepository(UpPostAnalyticsSnapshotEntity)
    private readonly snapshotRepo: Repository<UpPostAnalyticsSnapshotEntity>,
    @InjectRepository(UpPostEntity)
    private readonly postRepo: Repository<UpPostEntity>,
  ) {}

  /**
   * Get a summary for a specific month (YYYY-MM).
   * Aggregates all daily snapshots within that month.
   */
  async getMonthlySummary(month: string): Promise<MonthlySummary> {
    const startDate = `${month}-01`;
    const [year, mon] = month.split('-').map(Number);
    const endDay = new Date(year, mon, 0).getDate();
    const endDate = `${month}-${String(endDay).padStart(2, '0')}`;

    const snapshots = await this.snapshotRepo
      .createQueryBuilder('s')
      .where('s.snapshotDate >= :start', { start: startDate })
      .andWhere('s.snapshotDate <= :end', { end: endDate })
      .orderBy('s.snapshotDate', 'ASC')
      .getMany();

    if (snapshots.length === 0) {
      return {
        month,
        platforms: [],
        totalImpressions: 0,
        totalFollowersGrowth: 0,
      };
    }

    // Group by platform
    const byPlatform = new Map<string, UpPostAnalyticsSnapshotEntity[]>();
    for (const s of snapshots) {
      const arr = byPlatform.get(s.platform) ?? [];
      arr.push(s);
      byPlatform.set(s.platform, arr);
    }

    const platforms: MonthlySummary['platforms'] = [];

    for (const [platform, snaps] of byPlatform) {
      const first = snaps[0];
      const last = snaps[snaps.length - 1];

      const totalReach = snaps.reduce((sum, s) => sum + Number(s.reach), 0);
      const totalViews = snaps.reduce((sum, s) => sum + Number(s.views), 0);
      const totalLikes = snaps.reduce((sum, s) => sum + Number(s.likes), 0);
      const totalComments = snaps.reduce((sum, s) => sum + Number(s.comments), 0);
      const totalShares = snaps.reduce((sum, s) => sum + Number(s.shares), 0);
      const totalSaves = snaps.reduce((sum, s) => sum + Number(s.saves), 0);

      // Best day by reach + views
      let bestDay: { date: string; reach: number; views: number } | null = null;
      for (const s of snaps) {
        const score = Number(s.reach) + Number(s.views);
        if (!bestDay || score > bestDay.reach + bestDay.views) {
          bestDay = { date: s.snapshotDate, reach: Number(s.reach), views: Number(s.views) };
        }
      }

      platforms.push({
        platform,
        followers: Number(last.followers),
        followersStart: Number(first.followers),
        followersEnd: Number(last.followers),
        followersDelta: Number(last.followers) - Number(first.followers),
        avgReach: Math.round(totalReach / snaps.length),
        avgViews: Math.round(totalViews / snaps.length),
        totalReach,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        totalSaves,
        bestDay,
      });
    }

    platforms.sort((a, b) => b.totalReach + b.totalViews - (a.totalReach + a.totalViews));

    return {
      month,
      platforms,
      totalImpressions: platforms.reduce((sum, p) => sum + p.totalReach + p.totalViews, 0),
      totalFollowersGrowth: platforms.reduce((sum, p) => sum + p.followersDelta, 0),
    };
  }

  /**
   * Get a 12-month historical overview.
   * Returns one entry per month with aggregated metrics.
   */
  async getMonthlyHistory(months = 12): Promise<MonthlyHistoryEntry[]> {
    const now = new Date();
    const results: MonthlyHistoryEntry[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      const summary = await this.getMonthlySummary(monthStr);

      results.push({
        month: monthStr,
        totalImpressions: summary.totalImpressions,
        totalFollowers: summary.platforms.reduce((sum, p) => sum + p.followersEnd, 0),
        followersGrowth: summary.totalFollowersGrowth,
        platforms: summary.platforms.map((p) => ({
          platform: p.platform,
          followers: p.followersEnd,
          reach: p.totalReach,
          views: p.totalViews,
          engagement: p.totalLikes + p.totalComments + p.totalShares + p.totalSaves,
        })),
      });
    }

    return results;
  }

  /**
   * Get top performing posts from the local DB.
   * Sorted by views/likes/engagement if available in results JSON.
   */
  async getTopPosts(limit = 20, profileUsername?: string): Promise<UpPostEntity[]> {
    const qb = this.postRepo
      .createQueryBuilder('p')
      .where('p.status = :status', { status: 'success' });

    if (profileUsername) {
      qb.andWhere('p.profileUsername = :username', { username: profileUsername });
    }

    const posts = await qb
      .orderBy('p.createdAt', 'DESC')
      .take(limit * 3) // fetch more, then sort by engagement
      .getMany();

    // Sort by engagement extracted from results JSON
    return posts
      .map((p) => {
        const r = (p.results ?? {}) as Record<string, unknown>;
        const engagement =
          Number(r.likes ?? 0) +
          Number(r.comments ?? 0) +
          Number(r.shares ?? 0) +
          Number(r.saves ?? 0);
        return { post: p, engagement };
      })
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, limit)
      .map((x) => x.post);
  }

  /**
   * Get top performing posts for a specific month.
   */
  async getTopPostsByMonth(
    month: string,
    limit = 20,
    profileUsername?: string,
  ): Promise<UpPostEntity[]> {
    const startDate = `${month}-01`;
    const [year, mon] = month.split('-').map(Number);
    const nextMonthDate = new Date(year, mon - 1, 1);
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    const nextMonthStart = nextMonthDate.toISOString().slice(0, 10);

    const qb = this.postRepo
      .createQueryBuilder('p')
      .where('p.status = :status', { status: 'success' })
      .andWhere('p.publishedAt >= :start', { start: startDate })
      .andWhere('p.publishedAt < :nextStart', { nextStart: nextMonthStart });

    if (profileUsername) {
      qb.andWhere('p.profileUsername = :username', { username: profileUsername });
    }

    return qb.orderBy('p.publishedAt', 'DESC').take(limit).getMany();
  }

  /**
   * Send the monthly report via email.
   * If no month is provided, defaults to the previous month (YYYY-MM).
   */
  async sendMonthlyReport(month?: string): Promise<void> {
    if (!month) {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      month = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    }

    this.logger.log(`Generating monthly report for ${month}…`);

    const summary = await this.getMonthlySummary(month);
    const topPosts = await this.getTopPostsByMonth(month, 5);

    const body = this.renderMonthlyEmailBody(month, summary, topPosts);

    // Priority: extension-specific config → global NOTIFICATION_EMAIL
    const email =
      this.configService.get('upload-post', { infer: true })?.weeklyReportEmail ||
      this.configService.get('app', { infer: true })?.notificationEmail;

    if (!email) {
      this.logger.warn('No weeklyReportEmail/notificationEmail configured — skipping monthly report');
      this.logger.log(body);
      return;
    }

    const subject = `📊 Informe Mensual Social — ${month}`;
    await this.queuedMailerService.sendMail({ to: email, subject, text: body });
    this.logger.log(`Monthly report sent to ${email}`);
  }

  /**
   * Render the monthly summary as a plain-text email body.
   */
  private renderMonthlyEmailBody(
    month: string,
    summary: MonthlySummary,
    topPosts: UpPostEntity[],
  ): string {
    const lines: string[] = [];
    lines.push(`📊 Informe Mensual Social — ${month}`);
    lines.push(`Período: ${month}`);
    lines.push('');
    lines.push(`Impresiones totales: ${summary.totalImpressions.toLocaleString()}`);
    lines.push(`Crecimiento de seguidores: ${summary.totalFollowersGrowth.toLocaleString()}`);
    lines.push('');
    lines.push('Por plataforma:');
    lines.push('─'.repeat(60));

    for (const p of summary.platforms) {
      lines.push(`${p.platform.toUpperCase()}`);
      lines.push(
        `  Followers: ${p.followersStart.toLocaleString()} → ${p.followersEnd.toLocaleString()} (${p.followersDelta >= 0 ? '+' : ''}${p.followersDelta})`,
      );
      lines.push(`  Reach: ${p.totalReach.toLocaleString()} | Views: ${p.totalViews.toLocaleString()}`);
      lines.push(`  Likes: ${p.totalLikes.toLocaleString()} | Comments: ${p.totalComments.toLocaleString()}`);
      lines.push(`  Shares: ${p.totalShares.toLocaleString()} | Saves: ${p.totalSaves.toLocaleString()}`);
      lines.push(
        `  Best day: ${p.bestDay ? p.bestDay.date + ' (reach ' + p.bestDay.reach.toLocaleString() + ', views ' + p.bestDay.views.toLocaleString() + ')' : '—'}`,
      );
      lines.push('');
    }

    lines.push('Top 5 posts:');
    lines.push('─'.repeat(60));
    for (const post of topPosts) {
      lines.push(
        `• ${post.title ?? '(sin título)'} — ${post.platform ?? '?'} — ${post.publishedAt ?? '?'}`,
      );
    }

    return lines.join('\n');
  }

  /**
   * Scheduled monthly report — runs on the 1st of each month at 09:00.
   * Sends the report for the previous month.
   */
  @Cron('0 9 1 * *')
  async scheduledMonthlyReport() {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    try {
      await this.sendMonthlyReport(month);
    } catch (err) {
      this.logger.error(`scheduledMonthlyReport failed: ${err?.message ?? err}`);
    }
  }
}