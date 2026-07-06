import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '@src/config/config.type';
import { AnalyticsService } from '@ext/upload-post/services/analytics.service';
import { UploadPostClientService } from '@ext/upload-post/services/upload-post-client.service';
import { QueuedMailerService } from '@comms/email-queue/queued-mailer.service';

export interface WeeklyReport {
  period: { start: string; end: string };
  platforms: Array<{
    platform: string;
    followers: number;
    followersDelta: number;
    reach: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  }>;
  totalImpressions: number;
  topPlatform: string;
  generatedAt: string;
}

@Injectable()
export class WeeklyReportService {
  private readonly logger = new Logger(WeeklyReportService.name);

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly client: UploadPostClientService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly queuedMailerService: QueuedMailerService,
  ) {}

  /**
   * Generate the weekly report from stored daily snapshots.
   * Compares last 7 days vs previous 7 days for delta calculations.
   */
  async generate(): Promise<WeeklyReport> {
    const last7 = await this.analyticsService.getSnapshotsForLastDays(7);

    if (last7.length === 0) {
      // Fallback: fetch live data
      this.logger.warn('No snapshots in DB — falling back to live API data');
      return this.generateFromLiveApi();
    }

    // Fetch the previous 7 days (days 8-14) for delta calculation.
    // Use string comparison (YYYY-MM-DD) to avoid timezone off-by-one errors.
    const last14 = await this.analyticsService.getSnapshotsForLastDays(14);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const cutoff7Str = cutoffDate.toISOString().slice(0, 10);
    const prev7 = last14.filter((s) => s.snapshotDate < cutoff7Str);

    // Group by platform
    const byPlatform = new Map<string, typeof last7>();
    for (const s of last7) {
      const arr = byPlatform.get(s.platform) ?? [];
      arr.push(s);
      byPlatform.set(s.platform, arr);
    }

    const prevByPlatform = new Map<string, typeof prev7>();
    for (const s of prev7) {
      const arr = prevByPlatform.get(s.platform) ?? [];
      arr.push(s);
      prevByPlatform.set(s.platform, arr);
    }

    const platforms: WeeklyReport['platforms'] = [];
    let totalImpressions = 0;

    for (const [platform, snapshots] of byPlatform) {
      const latest = snapshots[snapshots.length - 1];
      const prevSnapshots = prevByPlatform.get(platform) ?? [];
      // Previous week's latest snapshot (or fallback to current if no history)
      const prevLatest = prevSnapshots[prevSnapshots.length - 1];
      const prevFollowers = prevLatest
        ? Number(prevLatest.followers)
        : Number(latest.followers);

      const reach = snapshots.reduce((sum, s) => sum + Number(s.reach), 0);
      const views = snapshots.reduce((sum, s) => sum + Number(s.views), 0);
      const likes = snapshots.reduce((sum, s) => sum + Number(s.likes), 0);
      const comments = snapshots.reduce(
        (sum, s) => sum + Number(s.comments),
        0,
      );
      const shares = snapshots.reduce((sum, s) => sum + Number(s.shares), 0);
      const saves = snapshots.reduce((sum, s) => sum + Number(s.saves), 0);

      const impressions = reach + views;
      totalImpressions += impressions;

      platforms.push({
        platform,
        followers: Number(latest.followers),
        followersDelta: Number(latest.followers) - prevFollowers,
        reach,
        views,
        likes,
        comments,
        shares,
        saves,
      });
    }

    platforms.sort((a, b) => b.reach + b.views - (a.reach + a.views));
    const topPlatform = platforms[0]?.platform ?? '—';

    return {
      period: {
        start: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10),
      },
      platforms,
      totalImpressions,
      topPlatform,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Fallback when no DB snapshots exist — fetch live analytics.
   */
  private async generateFromLiveApi(): Promise<WeeklyReport> {
    const user = this.client.profileUsername;
    if (!user) throw new Error('profileUsername not configured');

    const data = await this.client.getAnalytics(user, [
      'instagram',
      'tiktok',
      'youtube',
      'linkedin',
      'x',
    ]);

    if (!data || typeof data !== 'object') {
      throw new Error('Analytics API returned no data');
    }

    const platforms: WeeklyReport['platforms'] = [];
    let totalImpressions = 0;

    for (const [platform, m] of Object.entries(data)) {
      if (platform === 'success' || platform === 'message') continue;
      if (!m || typeof m !== 'object') continue;
      const metrics = m as {
        followers?: number;
        reach?: number;
        views?: number;
        impressions?: number;
        likes?: number;
        comments?: number;
        shares?: number;
        saves?: number;
      };
      const impressions = Number(metrics.views ?? metrics.impressions ?? 0);
      totalImpressions += impressions;

      platforms.push({
        platform,
        followers: Number(metrics.followers ?? 0),
        followersDelta: 0,
        reach: Number(metrics.reach ?? 0),
        views: Number(metrics.views ?? 0),
        likes: Number(metrics.likes ?? 0),
        comments: Number(metrics.comments ?? 0),
        shares: Number(metrics.shares ?? 0),
        saves: Number(metrics.saves ?? 0),
      });
    }

    return {
      period: {
        start: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10),
      },
      platforms,
      totalImpressions,
      topPlatform: platforms[0]?.platform ?? '—',
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Render the report as a plain-text email body.
   */
  renderEmailBody(report: WeeklyReport): string {
    const lines: string[] = [];
    lines.push(`📊 Informe Semanal de Redes Sociales — SOM-OS`);
    lines.push(`Período: ${report.period.start} → ${report.period.end}`);
    lines.push('');
    lines.push(
      `Impresiones totales: ${report.totalImpressions.toLocaleString()}`,
    );
    lines.push(`Plataforma destacada: ${report.topPlatform}`);
    lines.push('');
    lines.push('Por plataforma:');
    lines.push('─'.repeat(60));

    for (const p of report.platforms) {
      lines.push(`${p.platform.toUpperCase()}`);
      lines.push(
        `  Followers: ${p.followers.toLocaleString()} (${p.followersDelta >= 0 ? '+' : ''}${p.followersDelta})`,
      );
      lines.push(
        `  Reach: ${p.reach.toLocaleString()} | Views: ${p.views.toLocaleString()}`,
      );
      lines.push(
        `  Likes: ${p.likes.toLocaleString()} | Comments: ${p.comments.toLocaleString()}`,
      );
      lines.push(
        `  Shares: ${p.shares.toLocaleString()} | Saves: ${p.saves.toLocaleString()}`,
      );
      lines.push('');
    }

    lines.push(`Generado: ${report.generatedAt}`);
    return lines.join('\n');
  }

  /**
   * Send the weekly report via email + optional Telegram.
   * Runs on the cron schedule configured in UPLOAD_POST_WEEKLY_REPORT_CRON (default: Mondays 09:00).
   */
  @Cron(process.env.UPLOAD_POST_WEEKLY_REPORT_CRON ?? '0 9 * * 1')
  async scheduledSendReport() {
    this.logger.log('Weekly report cron triggered');
    return this.sendReport();
  }

  /**
   * Send the weekly report via email + optional Telegram.
   */
  async sendReport() {
    if (!this.client.isConfigured) {
      this.logger.warn('Upload-Post not configured — skipping weekly report');
      return;
    }

    this.logger.log('Generating weekly report…');
    const report = await this.generate();
    const body = this.renderEmailBody(report);

    // Priority: extension-specific config → global NOTIFICATION_EMAIL → fallback
    const email =
      this.configService.get('upload-post', { infer: true })
        ?.weeklyReportEmail ||
      this.configService.get('app', { infer: true })?.notificationEmail;
    if (email) {
      try {
        await this.queuedMailerService.sendMail({
          to: email,
          subject: `📊 Informe Semanal Social — ${report.period.start} → ${report.period.end}`,
          text: body,
        });
        this.logger.log(`Weekly report sent to ${email}`);
      } catch (err: unknown) {
        this.logger.error(
          `Failed to send weekly report email: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      this.logger.warn('No weeklyReportEmail configured — logging report only');
      this.logger.log(body);
    }

    return report;
  }
}
