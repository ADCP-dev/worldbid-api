/**
 * SpecJobRunner — runs scheduled jobs defined in spec files.
 *
 * When Redis is available (WORKER_HOST env var is set), uses BullMQ
 * repeatable jobs for durable, retryable scheduling.
 * When Redis is not available, falls back to setInterval (no-Redis mode).
 *
 * Jobs are defined in spec YAML:
 *   jobs:
 *     - name: stale-tasks-detector
 *       schedule: interval          # or 'cron'
 *       value: 60s                   # or cron expression like "0/5 * * * *"
 *       handler: ./handlers/stale-tasks.handler.ts
 *       retries: 3                   # optional, default 3
 *       backoff: exponential         # optional, 'exponential' | 'fixed'
 *
 * The job handler receives a HookContext — same interface as lifecycle hooks.
 *
 * Registration follows the EmailQueueModule pattern:
 *   const { imports, providers } = SpecJobRunner.register(loadedSpecs);
 */

import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { BullModule, Processor, WorkerHost, getQueueToken } from '@nestjs/bullmq';
import { ModuleRef } from '@nestjs/core';
import { Queue, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

import type { LoadedSpec } from './spec-loader';
import type { JobSpec, HookContext } from './spec.types';
import { SpecEngineBootService } from './spec-engine-boot';
import { HookContextImpl } from './hook-context';
import { TraceBuilder } from './spec-trace';

// ─── Shared Types ───────────────────────────────────────────────────────────

interface LoadedJobHandler {
  default: (ctx: HookContext) => Promise<void>;
}

/** Payload sent to the BullMQ queue for each spec job. */
export interface SpecJobData {
  resourceName: string;
  handler: string;
  extensionDir: string;
  jobName: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse interval string to milliseconds.
 * Supports: "60s", "5m", "1h", "500ms"
 */
function parseInterval(value: string): number {
  const match = value.match(/^(\d+)(ms|s|m|h)$/);
  if (!match) return 0;
  const num = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 'ms': return num;
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    default: return 0;
  }
}

/**
 * Detect whether Redis is available by checking WORKER_HOST.
 * Follows the same pattern as EmailQueueModule.
 */
function isRedisAvailable(): boolean {
  const workerHost = process.env.WORKER_HOST;
  return (
    typeof workerHost === 'string' &&
    workerHost.length > 0 &&
    workerHost !== 'undefined' &&
    workerHost !== 'null'
  );
}

/**
 * Build a HookContext for a job handler.
 * Uses SpecEngineBootService to get ModuleRef and ConfigService.
 */
function buildJobContext(resourceName: string, logger: Logger): HookContext {
  const moduleRef = SpecEngineBootService.getModuleRef();
  const configService = SpecEngineBootService.getConfigService();
  const trace = new TraceBuilder(resourceName, 'list', null, logger, false);
  return new HookContextImpl(
    moduleRef,
    configService,
    null,
    resourceName,
    'job',
    trace,
  ) as unknown as HookContext;
}

/**
 * Load a job handler from the filesystem.
 * Returns null if the handler cannot be loaded.
 */
function loadJobHandler(
  extensionDir: string,
  handlerPath: string,
  logger: Logger,
  jobName: string,
): LoadedJobHandler['default'] | null {
  try {
    const resolved = path.resolve(extensionDir, handlerPath);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(resolved) as LoadedJobHandler;
    if (!mod.default) {
      logger.warn(
        `⚠️  Job handler "${handlerPath}" for "${jobName}" has no default export`,
      );
      return null;
    }
    return mod.default;
  } catch (err) {
    logger.warn(
      `⚠️  Could not load job handler "${handlerPath}" for "${jobName}": ${(err as Error).message}`,
    );
    return null;
  }
}

// ─── BullMQ Processor (Redis mode) ──────────────────────────────────────────

/**
 * SpecJobProcessor — BullMQ worker that processes spec-defined jobs.
 *
 * On module init, registers all spec jobs as repeatable BullMQ jobs.
 * In process(), loads the handler, builds a HookContext, and calls it.
 * Retries/backoff are configured per-job via BullMQ job options.
 */
@Processor('spec-jobs')
@Injectable()
export class SpecJobProcessor extends WorkerHost {
  private readonly logger = new Logger('SpecJobProcessor');
  private queue: Queue<SpecJobData> | null = null;
  private loadedSpecs: LoadedSpec[] = [];

  constructor(private readonly moduleRef: ModuleRef) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // Resolve the queue and loaded specs from the DI container
    const queueToken = getQueueToken('spec-jobs');
    try {
      this.queue = this.moduleRef.get<Queue<SpecJobData>>(queueToken, { strict: false });
    } catch {
      this.logger.warn('spec-jobs queue not found in DI container — jobs will not be scheduled');
    }
    try {
      this.loadedSpecs =
        this.moduleRef.get<LoadedSpec[]>('SPEC_JOB_LOADED_SPECS', { strict: false }) ?? [];
    } catch {
      this.logger.warn('SPEC_JOB_LOADED_SPECS not found in DI container');
    }

    if (!this.queue) {
      this.logger.error('Cannot schedule repeatable jobs — queue is unavailable');
      return;
    }

    // Register repeatable jobs from loaded specs
    for (const loaded of this.loadedSpecs) {
      for (const resource of loaded.spec.resources) {
        if (!resource.jobs || resource.jobs.length === 0) continue;
        for (const job of resource.jobs) {
          await this.scheduleRepeatableJob(loaded, job, resource.name);
        }
      }
    }
  }

  /**
   * Register a single repeatable job in the BullMQ queue.
   */
  private async scheduleRepeatableJob(
    loaded: LoadedSpec,
    job: JobSpec,
    resourceName: string,
  ): Promise<void> {
    const jobKey = `spec-job:${resourceName}:${job.name}`;
    const jobData: SpecJobData = {
      resourceName,
      handler: job.handler,
      extensionDir: loaded.dir,
      jobName: job.name,
    };

    const attempts = job.retries ?? 3;
    const backoff =
      job.backoff === 'exponential'
        ? { type: 'exponential' as const, delay: 5000 }
        : { type: 'fixed' as const, delay: 5000 };

    let repeat: Record<string, unknown>;

    if (job.schedule === 'cron') {
      repeat = { pattern: job.value };
    } else {
      const intervalMs = parseInterval(job.value);
      if (intervalMs <= 0) {
        this.logger.warn(`⚠️  Invalid interval for job "${job.name}": ${job.value}`);
        return;
      }
      repeat = { every: intervalMs };
    }

    try {
      await this.queue!.add(jobKey, jobData, {
        repeat,
        attempts,
        backoff,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      });
      this.logger.log(
        `⏰ Scheduled BullMQ job "${job.name}" (${job.schedule}: ${job.value}, handler: ${job.handler})`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to schedule job "${job.name}": ${(err as Error).message}`,
      );
    }
  }

  /**
   * Process a single job from the queue.
   * BullMQ handles retries automatically if this throws.
   */
  async process(job: Job<SpecJobData>): Promise<void> {
    const { resourceName, handler: handlerPath, extensionDir, jobName } = job.data;
    this.logger.log(`Processing job "${jobName}" (id: ${job.id}, attempt: ${job.attemptsMade + 1}/${job.opts.attempts})`);

    const handler = loadJobHandler(extensionDir, handlerPath, this.logger, jobName);
    if (!handler) {
      throw new Error(
        `Job handler "${handlerPath}" for "${jobName}" could not be loaded`,
      );
    }

    const ctx = buildJobContext(resourceName, this.logger);
    await handler(ctx);

    this.logger.log(`Job "${jobName}" completed successfully`);
  }
}

// ─── setInterval Runner (fallback, no Redis) ────────────────────────────────

/**
 * SpecJobRunner — fallback runner using setInterval when Redis is not available.
 *
 * Also serves as the backwards-compatible export for the module token.
 * The static register() method decides whether to use this class or BullMQ.
 */
@Injectable()
export class SpecJobRunner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('SpecJobRunner');
  private intervals: NodeJS.Timeout[] = [];
  private loadedSpecs: LoadedSpec[] = [];

  constructor() {}

  /**
   * Set the loaded specs (used by the module factory).
   */
  setLoadedSpecs(specs: LoadedSpec[]) {
    this.loadedSpecs = specs;
  }

  async onModuleInit() {
    for (const loaded of this.loadedSpecs) {
      for (const resource of loaded.spec.resources) {
        if (!resource.jobs || resource.jobs.length === 0) continue;
        for (const job of resource.jobs) {
          this.scheduleJob(loaded, job, resource.name);
        }
      }
    }
  }

  onModuleDestroy() {
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];
  }

  private scheduleJob(loaded: LoadedSpec, job: JobSpec, resourceName: string) {
    // Only interval scheduling is supported in fallback mode
    if (job.schedule === 'cron') {
      this.logger.warn(
        `⚠️  Cron schedule "${job.value}" for job "${job.name}" not supported in setInterval fallback mode; skipping`,
      );
      return;
    }

    const intervalMs = parseInterval(job.value);
    if (intervalMs <= 0) {
      this.logger.warn(`⚠️  Invalid interval for job "${job.name}": ${job.value}`);
      return;
    }

    const handler = loadJobHandler(loaded.dir, job.handler, this.logger, job.name);
    if (!handler) return;

    // Run immediately once, then on interval
    this.runHandler(handler, resourceName, job);
    const interval = setInterval(
      () => this.runHandler(handler!, resourceName, job),
      intervalMs,
    );
    this.intervals.push(interval);

    this.logger.log(
      `⏰ Scheduled job "${job.name}" every ${job.value} (handler: ${job.handler})`,
    );
  }

  private async runHandler(
    handler: LoadedJobHandler['default'],
    resourceName: string,
    job: JobSpec,
  ) {
    try {
      const ctx = buildJobContext(resourceName, this.logger);
      await handler(ctx);
    } catch (err) {
      this.logger.error(`Job "${job.name}" failed: ${(err as Error).message}`);
    }
  }

  // ─── Dynamic Module Registration ──────────────────────────────────────────

  /**
   * Returns the imports and providers needed to wire spec jobs.
   *
   * When Redis is available (WORKER_HOST set), configures BullMQ with
   * a 'spec-jobs' queue and registers the SpecJobProcessor.
   * When Redis is not available, registers the setInterval-based SpecJobRunner.
   *
   * Follows the EmailQueueModule pattern:
   *   const { imports, providers } = SpecJobRunner.register(loadedSpecs);
   */
  static register(
    loadedSpecs: LoadedSpec[],
  ): { imports: any[]; providers: any[] } {
    const redisEnabled = isRedisAvailable();

    // eslint-disable-next-line no-console -- startup log
    console.log(
      `[SpecJobRunner] Redis enabled: ${redisEnabled}${redisEnabled ? ` (${process.env.WORKER_HOST})` : ''}`,
    );

    const imports: any[] = [];
    const providers: any[] = [
      { provide: 'SPEC_JOB_LOADED_SPECS', useValue: loadedSpecs },
    ];

    if (redisEnabled) {
      // BullMQ mode: durable, retryable jobs via Redis
      imports.push(
        BullModule.forRootAsync({
          useFactory: (configService: ConfigService) => ({
            connection: {
              host: configService.get('worker.host'),
              port: configService.get('worker.port'),
              db: configService.get('worker.db'),
              username: configService.get('worker.username'),
              password: configService.get('worker.password'),
            },
          }),
          inject: [ConfigService],
        }),
        BullModule.registerQueue({ name: 'spec-jobs' }),
      );
      providers.push(SpecJobProcessor);
      // SpecJobRunner is still provided as a no-op for backwards compat
      // (other code may inject the token). When Redis is active, jobs
      // run through BullMQ, so the setInterval runner is inert.
      providers.push({
        provide: SpecJobRunner,
        useValue: new SpecJobRunner(),
      });
    } else {
      // Fallback mode: setInterval-based scheduling (no Redis dependency)
      providers.push({
        provide: SpecJobRunner,
        useFactory: () => {
          const runner = new SpecJobRunner();
          runner.setLoadedSpecs(loadedSpecs);
          return runner;
        },
      });
    }

    return { imports, providers };
  }
}