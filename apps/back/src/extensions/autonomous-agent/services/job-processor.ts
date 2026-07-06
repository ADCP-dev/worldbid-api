import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger, ModuleRef } from '@nestjs/common';
import { AgentRunService } from '@ext/autonomous-agent/services/agent-run.service';
import { AUTONOMOUS_AGENT_QUEUE } from '@ext/autonomous-agent/services/pipeline-orchestrator.service';
import {
  TrendResearchService,
  ResearchResult,
} from '@ext/content-pipeline/services/trend-research.service';
import {
  ContentGeneratorService,
} from '@ext/content-pipeline/services/content-generator.service';
import {
  PublishingService,
} from '@ext/content-pipeline/services/publishing.service';
import { MetricsService } from '@ext/content-pipeline/services/metrics.service';
import { ProjectService } from '@ext/content-pipeline/services/project.service';
import { IdeaService } from '@ext/content-pipeline/services/idea.service';
import { DraftService } from '@ext/content-pipeline/services/draft.service';

/**
 * BullMQ worker that processes autonomous-agent jobs.
 *
 * The actual pipeline services (TrendResearchService, ContentGeneratorService,
 * PublishingService, MetricsService) live in the content-pipeline extension,
 * which may or may not be loaded at runtime. They are therefore resolved
 * lazily via ModuleRef with `{ strict: false }` — the same pattern used by
 * PublishingService for the CMS / Upload-Post clients. If content-pipeline
 * is not loaded, the job is marked as failed with a clear warning rather
 * than crashing the worker.
 */
@Processor(AUTONOMOUS_AGENT_QUEUE)
@Injectable()
export class AutonomousAgentJobProcessor extends WorkerHost {
  private readonly logger = new Logger(AutonomousAgentJobProcessor.name);

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly agentRunService: AgentRunService,
  ) {
    super();
  }

  /** Lazily resolve a content-pipeline service class, or null if absent. */
  private resolve<T>(token: any): T | null {
    try {
      return this.moduleRef.get<T>(token, { strict: false });
    } catch {
      return null;
    }
  }

  async process(job: Job): Promise<void> {
    const type = (job.data?.type ?? job.name) as
      | 'research'
      | 'generate'
      | 'publish'
      | 'metrics';
    const runId: string = job.data?.runId ?? '';
    const projectId: string = job.data?.projectId ?? '';

    this.logger.log(
      `Processing ${type} job ${job.id} (run ${runId}) for project ${projectId}`,
    );

    if (!runId) {
      this.logger.warn(
        `Job ${job.id} (${type}) has no runId — cannot update run status`,
      );
    }

    try {
      let output: Record<string, unknown> = {};

      switch (type) {
        case 'research': {
          output = await this.handleResearch(projectId);
          break;
        }
        case 'generate': {
          const ideaId: string = job.data?.ideaId ?? '';
          output = await this.handleGenerate(projectId, ideaId);
          break;
        }
        case 'publish': {
          const draftId: string = job.data?.draftId ?? '';
          output = await this.handlePublish(projectId, draftId);
          break;
        }
        case 'metrics': {
          output = await this.handleMetrics(projectId);
          break;
        }
        default: {
          throw new Error(`Unknown job type: ${type}`);
        }
      }

      if (runId) {
        await this.agentRunService.updateStatus(runId, 'completed', {
          output,
        });
      }
      this.logger.log(
        `Job ${job.id} (${type}) completed for run ${runId}`,
      );
    } catch (err: any) {
      const message = err?.message ?? String(err);
      this.logger.error(
        `Job ${job.id} (${type}) failed for run ${runId}: ${message}`,
      );
      if (runId) {
        try {
          await this.agentRunService.updateStatus(runId, 'failed', {
            errorMessage: message,
          });
        } catch (updateErr: any) {
          this.logger.error(
            `Failed to mark run ${runId} as failed: ${updateErr?.message ?? updateErr}`,
          );
        }
      }
      // Re-throw so BullMQ applies its retry/backoff policy.
      throw err;
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  //  Phase handlers
  // ───────────────────────────────────────────────────────────────────────

  private async handleResearch(projectId: string): Promise<ResearchResult> {
    const trendResearch = this.resolve<TrendResearchService>(
      TrendResearchService,
    );
    const projectService = this.resolve<ProjectService>(ProjectService);

    if (!trendResearch) {
      this.logger.warn(
        'TrendResearchService not available (content-pipeline not loaded) — research job cannot run',
      );
      throw new Error('content-pipeline extension is not loaded');
    }

    let project: any = null;
    if (projectService) {
      try {
        project = await projectService.findById(projectId);
      } catch {
        project = null;
      }
    }
    if (!project) {
      throw new Error(`Project ${projectId} not found for research`);
    }

    return trendResearch.research(project);
  }

  private async handleGenerate(
    projectId: string,
    ideaId: string,
  ): Promise<Record<string, unknown>> {
    const contentGenerator = this.resolve<ContentGeneratorService>(
      ContentGeneratorService,
    );
    const projectService = this.resolve<ProjectService>(ProjectService);
    const ideaService = this.resolve<IdeaService>(IdeaService);

    if (!contentGenerator) {
      this.logger.warn(
        'ContentGeneratorService not available (content-pipeline not loaded) — generate job cannot run',
      );
      throw new Error('content-pipeline extension is not loaded');
    }

    const project = projectService
      ? await projectService.findById(projectId)
      : null;
    if (!project) {
      throw new Error(`Project ${projectId} not found for generate`);
    }

    let idea: any = null;
    if (ideaId && ideaService) {
      try {
        idea = await ideaService.findById(ideaId);
      } catch {
        idea = null;
      }
    }
    // Fallback: pick the first approved idea for the project.
    if (!idea && ideaService) {
      try {
        const approved = await ideaService.findApprovedByProject(projectId);
        idea = approved?.[0] ?? null;
      } catch {
        idea = null;
      }
    }
    if (!idea) {
      throw new Error(
        `No idea ${ideaId || '(approved)'} found for project ${projectId}`,
      );
    }

    const result = await contentGenerator.generate(project, idea);
    return {
      ideaId: idea.id,
      model: result.generationLog.model,
      promptTokens: result.generationLog.promptTokens,
      completionTokens: result.generationLog.completionTokens,
      generationTimeMs: result.generationLog.generationTimeMs,
    };
  }

  private async handlePublish(
    projectId: string,
    draftId: string,
  ): Promise<Record<string, unknown>> {
    const publishingService = this.resolve<PublishingService>(
      PublishingService,
    );
    const projectService = this.resolve<ProjectService>(ProjectService);
    const draftService = this.resolve<DraftService>(DraftService);

    if (!publishingService) {
      this.logger.warn(
        'PublishingService not available (content-pipeline not loaded) — publish job cannot run',
      );
      throw new Error('content-pipeline extension is not loaded');
    }

    const project = projectService
      ? await projectService.findById(projectId)
      : null;
    if (!project) {
      throw new Error(`Project ${projectId} not found for publish`);
    }

    let draft: any = null;
    if (draftId && draftService) {
      try {
        draft = await draftService.findById(draftId);
      } catch {
        draft = null;
      }
    }
    // Fallback: pick the first approved draft for the project.
    if (!draft && draftService) {
      try {
        const approved = await draftService.findApprovedByProject(projectId);
        draft = approved?.[0] ?? null;
      } catch {
        draft = null;
      }
    }
    if (!draft) {
      throw new Error(
        `No draft ${draftId || '(approved)'} found for project ${projectId}`,
      );
    }

    const result = await publishingService.publish(draft, project);
    return {
      draftId: draft.id,
      blogPostId: result.blogPostId ?? null,
      blogPostUrl: result.blogPostUrl ?? null,
      socialPosts: result.socialPosts,
    };
  }

  private async handleMetrics(
    projectId: string,
  ): Promise<Record<string, unknown>> {
    const metricsService = this.resolve<MetricsService>(MetricsService);

    if (!metricsService) {
      this.logger.warn(
        'MetricsService not available (content-pipeline not loaded) — metrics job cannot run',
      );
      throw new Error('content-pipeline extension is not loaded');
    }

    // Gather recent metrics for the project as the job's output.
    const result = await metricsService.findAllByProject(projectId, 1, 100);
    return {
      total: result.total,
      snapshotCount: result.data.length,
      latestSnapshot: result.data[0]?.snapshotDate ?? null,
    };
  }
}