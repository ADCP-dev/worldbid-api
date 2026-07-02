import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UploadPostClientService } from '@ext/upload-post/services/upload-post-client.service';
import { UpPostAnalyticsSnapshotEntity } from '@ext/upload-post/infrastructure/persistence/entities/up-post-analytics-snapshot.entity';
import { UpPostEntity } from '@ext/upload-post/infrastructure/persistence/entities/up-post.entity';

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
  async getTopPosts(limit = 20): Promise<UpPostEntity[]> {
    return this.postRepo
      .createQueryBuilder('p')
      .where('p.status = :status', { status: 'success' })
      .orderBy('p.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  /**
   * Get top performing posts for a specific month.
   */
  async getTopPostsByMonth(month: string, limit = 20): Promise<UpPostEntity[]> {
    const startDate = `${month}-01`;
    const [year, mon] = month.split('-').map(Number);
    const endDay = new Date(year, mon, 0).getDate();
    const endDate = `${month}-${String(endDay).padStart(2, '0')}`;

    return this.postRepo
      .createQueryBuilder('p')
      .where('p.status = :status', { status: 'success' })
      .andWhere('p.publishedAt >= :start', { start: startDate })
      .andWhere('p.publishedAt <= :end', { end: endDate + ' 23:59:59' })
      .orderBy('p.publishedAt', 'DESC')
      .take(limit)
      .getMany();
  }
}