import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ContentPipelineMetricsEntity } from '@ext/content-pipeline/infrastructure/persistence/entities/metrics.entity';

export interface MetricsListResult {
  data: ContentPipelineMetricsEntity[];
  total: number;
  page: number;
  limit: number;
}

export interface DashboardSummary {
  totalSnapshots: number;
  byPlatform: Array<{
    platform: string;
    snapshots: number;
    totalViews: number;
  }>;
  totals: {
    views: number;
    clicks: number;
    engagement: number;
    affiliateClicks: number;
    affiliateConversions: number;
    revenue: number;
  };
}

const RETENTION_DAYS = 90;

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    @InjectRepository(ContentPipelineMetricsEntity)
    private readonly repo: Repository<ContentPipelineMetricsEntity>,
  ) {}

  async findAllByProject(
    projectId: string,
    page = 1,
    limit = 50,
    platform?: string,
  ): Promise<MetricsListResult> {
    const qb = this.repo.createQueryBuilder('m');
    qb.andWhere('m.projectId = :projectId', { projectId });
    if (platform) qb.andWhere('m.platform = :platform', { platform });
    qb.orderBy('m.snapshotDate', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findById(id: string): Promise<ContentPipelineMetricsEntity> {
    return this.repo.findOneOrFail({ where: { id } });
  }

  /**
   * Create a single metrics snapshot for a project/platform/draft.
   */
  async createSnapshot(data: {
    projectId: string;
    draftId?: string;
    platform: string;
    metrics: Record<string, unknown>;
    snapshotDate?: string;
  }): Promise<ContentPipelineMetricsEntity> {
    const snapshotDate =
      data.snapshotDate ?? new Date().toISOString().slice(0, 10);
    const entity = this.repo.create({
      projectId: data.projectId,
      draftId: data.draftId ?? null,
      platform: data.platform,
      snapshotDate,
      metrics: data.metrics,
    });
    const saved = await this.repo.save(entity);
    this.logger.debug(
      `Snapshot created: project=${data.projectId} platform=${data.platform} date=${snapshotDate}`,
    );
    return saved;
  }

  /**
   * Global aggregated dashboard across all projects/platforms.
   */
  async dashboard(): Promise<DashboardSummary> {
    const all = await this.repo.find({ order: { snapshotDate: 'DESC' } });

    const byPlatformMap = new Map<
      string,
      { snapshots: number; totalViews: number }
    >();
    const totals = {
      views: 0,
      clicks: 0,
      engagement: 0,
      affiliateClicks: 0,
      affiliateConversions: 0,
      revenue: 0,
    };

    for (const row of all) {
      const m = (row.metrics ?? {}) as Record<string, number>;
      const platformEntry = byPlatformMap.get(row.platform) ?? {
        snapshots: 0,
        totalViews: 0,
      };
      platformEntry.snapshots += 1;
      platformEntry.totalViews += Number(m.views ?? 0);
      byPlatformMap.set(row.platform, platformEntry);

      totals.views += Number(m.views ?? 0);
      totals.clicks += Number(m.clicks ?? 0);
      totals.engagement += Number(m.engagement ?? 0);
      totals.affiliateClicks += Number(m.affiliateClicks ?? 0);
      totals.affiliateConversions += Number(m.affiliateConversions ?? 0);
      totals.revenue += Number(m.revenue ?? 0);
    }

    return {
      totalSnapshots: all.length,
      byPlatform: Array.from(byPlatformMap.entries()).map(([platform, v]) => ({
        platform,
        snapshots: v.snapshots,
        totalViews: v.totalViews,
      })),
      totals,
    };
  }

  /**
   * Delete metrics snapshots older than 90 days. Returns count removed.
   */
  async cleanupOldMetrics(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const cutoffDate = cutoff.toISOString().slice(0, 10);

    const result = await this.repo
      .createQueryBuilder()
      .delete()
      .where('snapshotDate < :cutoff', { cutoff: cutoffDate })
      .execute();

    const removed = result.affected ?? 0;
    this.logger.log(
      `Cleanup: removed ${removed} metrics snapshots older than ${RETENTION_DAYS} days`,
    );
    return removed;
  }
}
