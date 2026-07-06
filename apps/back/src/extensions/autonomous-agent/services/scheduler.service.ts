import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AgentConfigService } from '@ext/autonomous-agent/services/agent-config.service';
import { PipelineOrchestratorService } from '@ext/autonomous-agent/services/pipeline-orchestrator.service';
import { FeedbackService } from '@ext/autonomous-agent/services/feedback.service';
import { NotificationService } from '@ext/autonomous-agent/services/notification.service';
import { AutonomousAgentConfig } from '@ext/autonomous-agent/config/autonomous-agent-config.type';

/**
 * Schedules the autonomous-agent pipeline phases via @Cron.
 *
 * Each phase ticks on its own cron schedule. On every tick we load all
 * active configs and, for each one, enqueue the corresponding job via
 * the PipelineOrchestratorService. The per-project config may override
 * the default cron expression — but @Cron decorators are evaluated at
 * bootstrap, so the decorator-bound expression is the global default
 * and the per-config override is applied by short-circuiting projects
 * whose config cron differs from the fired tick.
 *
 * The metrics tick additionally runs the feedback loop and emits a
 * weekly report notification per project.
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly agentConfigService: AgentConfigService,
    private readonly pipelineOrchestratorService: PipelineOrchestratorService,
    private readonly feedbackService: FeedbackService,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {}

  /** Default cron expressions, overridable via autonomous-agent config. */
  private get defaults(): Required<
    Pick<
      AutonomousAgentConfig,
      | 'defaultResearchCron'
      | 'defaultGenerateCron'
      | 'defaultPublishCron'
      | 'defaultMetricsCron'
    >
  > {
    const cfg = this.configService.get<AutonomousAgentConfig>(
      'autonomous-agent',
      { infer: true },
    );
    return {
      defaultResearchCron: cfg?.defaultResearchCron ?? '0 9 * * *',
      defaultGenerateCron: cfg?.defaultGenerateCron ?? '0 10 * * *',
      defaultPublishCron: cfg?.defaultPublishCron ?? '0 18 * * *',
      defaultMetricsCron: cfg?.defaultMetricsCron ?? '0 9 * * 1',
    };
  }

  /**
   * Research phase — daily at 09:00 by default.
   * Enqueues a research job for every active config whose researchCron
   * matches the fired default (per-project overrides are skipped here).
   */
  @Cron('0 9 * * *')
  async scheduleResearch(): Promise<void> {
    const fired = this.defaults.defaultResearchCron;
    this.logger.log(`Research cron tick fired (${fired})`);
    try {
      const configs = await this.agentConfigService.findActive();
      for (const config of configs) {
        if (config.researchCron && config.researchCron !== fired) continue;
        await this.pipelineOrchestratorService.enqueueResearch(
          config.projectId,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `scheduleResearch failed: ${err?.message ?? err}`,
      );
    }
  }

  /**
   * Generate phase — daily at 10:00 by default.
   * Enqueues a generate job for every active config whose generateCron
   * matches the fired default.
   */
  @Cron('0 10 * * *')
  async scheduleGenerate(): Promise<void> {
    const fired = this.defaults.defaultGenerateCron;
    this.logger.log(`Generate cron tick fired (${fired})`);
    try {
      const configs = await this.agentConfigService.findActive();
      for (const config of configs) {
        if (config.generateCron && config.generateCron !== fired) continue;
        // Generate operates per-idea; without a specific ideaId we
        // enqueue a generate job with an empty ideaId so the processor
        // can pick the next approved idea for the project.
        await this.pipelineOrchestratorService.enqueueGenerate(
          config.projectId,
          '',
        );
      }
    } catch (err: any) {
      this.logger.error(
        `scheduleGenerate failed: ${err?.message ?? err}`,
      );
    }
  }

  /**
   * Publish phase — daily at 18:00 by default.
   * Enqueues a publish job for every active config whose publishCron
   * matches the fired default.
   */
  @Cron('0 18 * * *')
  async schedulePublish(): Promise<void> {
    const fired = this.defaults.defaultPublishCron;
    this.logger.log(`Publish cron tick fired (${fired})`);
    try {
      const configs = await this.agentConfigService.findActive();
      for (const config of configs) {
        if (config.publishCron && config.publishCron !== fired) continue;
        // Publish operates per-draft; without a specific draftId we
        // enqueue a publish job with an empty draftId so the processor
        // can pick the next approved draft for the project.
        await this.pipelineOrchestratorService.enqueuePublish(
          config.projectId,
          '',
        );
      }
    } catch (err: any) {
      this.logger.error(
        `schedulePublish failed: ${err?.message ?? err}`,
      );
    }
  }

  /**
   * Metrics phase — weekly on Monday at 09:00 by default.
   * For each active config: enqueues a metrics job, runs the feedback
   * loop, and emits a weekly report notification.
   */
  @Cron('0 9 * * 1')
  async scheduleMetrics(): Promise<void> {
    const fired = this.defaults.defaultMetricsCron;
    this.logger.log(`Metrics cron tick fired (${fired})`);
    try {
      const configs = await this.agentConfigService.findActive();
      for (const config of configs) {
        if (config.metricsCron && config.metricsCron !== fired) continue;

        // Enqueue the metrics-gathering job.
        await this.pipelineOrchestratorService.enqueueMetrics(
          config.projectId,
        );

        // Run the feedback loop and emit the weekly report.
        try {
          const feedback = await this.feedbackService.runFeedbackLoop(
            config.projectId,
          );
          if (feedback) {
            await this.notificationService.notifyWeeklyReport(
              config.projectId,
              {
                metricsByPlatform: feedback.metricsByPlatform,
                boostedKeywords: feedback.boostedKeywords,
                demotedPlatforms: feedback.demotedPlatforms,
                signals: feedback.signals,
              },
            );
          }
        } catch (err: any) {
          this.logger.warn(
            `Metrics feedback/report for project ${config.projectId} failed: ${err?.message ?? err}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(
        `scheduleMetrics failed: ${err?.message ?? err}`,
      );
    }
  }
}