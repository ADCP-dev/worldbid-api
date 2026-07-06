import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentConfigService } from '@ext/autonomous-agent/services/agent-config.service';
import { AgentRunService } from '@ext/autonomous-agent/services/agent-run.service';

/**
 * Soft dependency on the content-pipeline metrics entity.
 *
 * The content-pipeline extension may not be loaded at runtime, so the
 * module conditionally registers the entity in TypeOrmModule.forFeature
 * (guarded by a try/catch require). Here we import the class symbol
 * statically — it resolves as long as the content-pipeline source tree
 * is present in the monorepo (it is) — and mark the repository injection
 * @Optional() so that, when the entity isn't registered, the feedback
 * loop degrades to a no-op instead of crashing DI.
 */
import { ContentPipelineMetricsEntity } from '@ext/content-pipeline/infrastructure/persistence/entities/metrics.entity';

type MetricsRow = {
  platform: string;
  metrics: Record<string, unknown>;
  snapshotDate: string;
};

interface MetricsRollup {
  platform: string;
  totalViews: number;
  totalEngagement: number;
  snapshotCount: number;
  latestSnapshot: string | null;
}

interface FeedbackSummary {
  projectId: string;
  analyzedAt: string;
  metricsByPlatform: MetricsRollup[];
  /** Weighted keywords/topics derived from top-performing platforms. */
  boostedKeywords: string[];
  /** Platforms that underperformed — research should de-prioritise. */
  demotedPlatforms: string[];
  /** Raw signals persisted to config.feedbackData. */
  signals: Record<string, unknown>;
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    private readonly configService: AgentConfigService,
    private readonly runService: AgentRunService,
    @Optional()
    @InjectRepository(ContentPipelineMetricsEntity)
    private readonly metricsRepo?: Repository<MetricsRow>,
  ) {}

  /**
   * Analyze recent metrics from the content-pipeline, derive research
   * priorities, and persist the resulting `feedbackData` onto the
   * per-project aa_config record.
   *
   * Safe to call even when the content-pipeline extension is absent:
   * in that case the metrics repository is undefined and the loop
   * becomes a no-op that logs a warning.
   */
  async runFeedbackLoop(projectId: string): Promise<FeedbackSummary | null> {
    const config = await this.configService.findByProjectId(projectId);
    if (!config) {
      this.logger.warn(
        `runFeedbackLoop: no config for project ${projectId} — skipping`,
      );
      return null;
    }

    if (!this.metricsRepo) {
      this.logger.warn(
        `runFeedbackLoop: ContentPipelineMetricsEntity repository not available ` +
          `(content-pipeline not loaded?) — skipping feedback for project ${projectId}`,
      );
      return null;
    }

    // snapshotDate is a 'date' column (YYYY-MM-DD), so use a date string.
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 30);
    const since = sinceDate.toISOString().slice(0, 10);

    try {
      const recent = (await this.metricsRepo
        .createQueryBuilder('m')
        .where('m.projectId = :projectId', { projectId })
        .andWhere('m.snapshotDate >= :since', { since })
        .orderBy('m.snapshotDate', 'DESC')
        .getMany()) as MetricsRow[];

      if (recent.length === 0) {
        this.logger.log(
          `runFeedbackLoop: no recent metrics for project ${projectId} — nothing to learn`,
        );
        return null;
      }

      // Roll up per platform
      const byPlatform = new Map<string, MetricsRollup>();
      for (const row of recent) {
        const key = row.platform;
        const roll = byPlatform.get(key) ?? {
          platform: key,
          totalViews: 0,
          totalEngagement: 0,
          snapshotCount: 0,
          latestSnapshot: null,
        };
        const views = Number(row.metrics?.views ?? 0);
        const engagement =
          Number(row.metrics?.likes ?? 0) +
          Number(row.metrics?.comments ?? 0) +
          Number(row.metrics?.shares ?? 0);
        roll.totalViews += views;
        roll.totalEngagement += engagement;
        roll.snapshotCount += 1;
        if (
          !roll.latestSnapshot ||
          row.snapshotDate > roll.latestSnapshot
        ) {
          roll.latestSnapshot = row.snapshotDate;
        }
        byPlatform.set(key, roll);
      }

      const metricsByPlatform = [...byPlatform.values()].sort(
        (a, b) => b.totalViews + b.totalEngagement - (a.totalViews + a.totalEngagement),
      );

      // Derive boosted keywords from top platforms and demoted ones from bottom.
      const medianIdx = Math.floor(metricsByPlatform.length / 2);
      const topPerformers = metricsByPlatform.slice(
        0,
        Math.max(1, medianIdx),
      );
      const bottomPerformers = metricsByPlatform.slice(medianIdx + 1);

      const boostedKeywords = topPerformers.map((m) => `topic:${m.platform}`);
      const demotedPlatforms = bottomPerformers.map((m) => m.platform);

      const summary: FeedbackSummary = {
        projectId,
        analyzedAt: new Date().toISOString(),
        metricsByPlatform,
        boostedKeywords,
        demotedPlatforms,
        signals: {
          topPlatform: topPerformers[0]?.platform ?? null,
          totalSnapshots: recent.length,
          totalViews: metricsByPlatform.reduce((s, m) => s + m.totalViews, 0),
          totalEngagement: metricsByPlatform.reduce(
            (s, m) => s + m.totalEngagement,
            0,
          ),
        },
      };

      // Persist feedbackData onto the config record (merge with existing).
      // configService.update() reloads the entity, so no in-memory mutation needed.
      const merged = {
        ...(config.feedbackData ?? {}),
        lastFeedback: summary,
      };
      await this.configService.update(config.id, {
        feedbackData: merged,
      });

      this.logger.log(
        `runFeedbackLoop: project ${projectId} — ` +
          `${metricsByPlatform.length} platforms, ` +
          `${boostedKeywords.length} boosted, ${demotedPlatforms.length} demoted`,
      );
      return summary;
    } catch (err: any) {
      this.logger.warn(
        `runFeedbackLoop: query/rollup failed for project ${projectId}: ${err?.message ?? err} — returning null`,
      );
      return null;
    }
  }
}