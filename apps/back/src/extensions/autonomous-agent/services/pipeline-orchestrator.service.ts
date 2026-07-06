import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AgentConfigService } from '@ext/autonomous-agent/services/agent-config.service';
import {
  AgentRunService,
  RunType,
} from '@ext/autonomous-agent/services/agent-run.service';

export const AUTONOMOUS_AGENT_QUEUE = 'autonomous-agent';

export interface ResearchJobData {
  projectId: string;
  runId: string;
}

export interface GenerateJobData {
  projectId: string;
  ideaId: string;
  runId: string;
}

export interface PublishJobData {
  projectId: string;
  draftId: string;
  runId: string;
}

export interface MetricsJobData {
  projectId: string;
  runId: string;
}

export type AutonomousAgentJobData =
  | ResearchJobData
  | GenerateJobData
  | PublishJobData
  | MetricsJobData;

@Injectable()
export class PipelineOrchestratorService {
  private readonly logger = new Logger(PipelineOrchestratorService.name);

  constructor(
    @InjectQueue(AUTONOMOUS_AGENT_QUEUE)
    private readonly queue: Queue,
    private readonly configService: AgentConfigService,
    private readonly runService: AgentRunService,
  ) {}

  /**
   * Enqueue a research job for a project. Creates a pending run record
   * and adds the job to the BullMQ queue.
   */
  async enqueueResearch(projectId: string): Promise<string> {
    const config = await this.configService.findByProjectId(projectId);
    if (!config || config.status !== 'active') {
      this.logger.warn(
        `enqueueResearch: no active config for project ${projectId} — skipping`,
      );
      return '';
    }

    const run = await this.runService.create({
      configId: config.id,
      projectId,
      runType: 'research' as RunType,
    });

    const job = await this.queue.add(
      'research',
      { projectId, runId: run.id } satisfies ResearchJobData,
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 86_400 },
        removeOnFail: { age: 86_400 * 7 },
      },
    );

    this.logger.log(
      `Enqueued research job ${job.id} for project ${projectId} (run ${run.id})`,
    );
    return run.id;
  }

  /**
   * Enqueue a generate job for a specific idea.
   */
  async enqueueGenerate(projectId: string, ideaId: string): Promise<string> {
    const config = await this.configService.findByProjectId(projectId);
    if (!config || config.status !== 'active') {
      this.logger.warn(
        `enqueueGenerate: no active config for project ${projectId} — skipping`,
      );
      return '';
    }

    const run = await this.runService.create({
      configId: config.id,
      projectId,
      runType: 'generate' as RunType,
    });

    const job = await this.queue.add(
      'generate',
      { projectId, ideaId, runId: run.id } satisfies GenerateJobData,
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { age: 86_400 },
        removeOnFail: { age: 86_400 * 7 },
      },
    );

    this.logger.log(
      `Enqueued generate job ${job.id} for idea ${ideaId} (run ${run.id})`,
    );
    return run.id;
  }

  /**
   * Enqueue a publish job for a specific draft.
   */
  async enqueuePublish(projectId: string, draftId: string): Promise<string> {
    const config = await this.configService.findByProjectId(projectId);
    if (!config || config.status !== 'active') {
      this.logger.warn(
        `enqueuePublish: no active config for project ${projectId} — skipping`,
      );
      return '';
    }

    const run = await this.runService.create({
      configId: config.id,
      projectId,
      runType: 'publish' as RunType,
    });

    const job = await this.queue.add(
      'publish',
      { projectId, draftId, runId: run.id } satisfies PublishJobData,
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { age: 86_400 },
        removeOnFail: { age: 86_400 * 7 },
      },
    );

    this.logger.log(
      `Enqueued publish job ${job.id} for draft ${draftId} (run ${run.id})`,
    );
    return run.id;
  }

  /**
   * Enqueue a metrics-gathering job for a project.
   */
  async enqueueMetrics(projectId: string): Promise<string> {
    const config = await this.configService.findByProjectId(projectId);
    if (!config || config.status !== 'active') {
      this.logger.warn(
        `enqueueMetrics: no active config for project ${projectId} — skipping`,
      );
      return '';
    }

    const run = await this.runService.create({
      configId: config.id,
      projectId,
      runType: 'metrics' as RunType,
    });

    const job = await this.queue.add(
      'metrics',
      { projectId, runId: run.id } satisfies MetricsJobData,
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 15_000 },
        removeOnComplete: { age: 86_400 * 7 },
        removeOnFail: { age: 86_400 * 30 },
      },
    );

    this.logger.log(
      `Enqueued metrics job ${job.id} for project ${projectId} (run ${run.id})`,
    );
    return run.id;
  }
}
