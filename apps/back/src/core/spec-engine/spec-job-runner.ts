/**
 * SpecJobRunner — runs scheduled jobs defined in spec files.
 *
 * For the spike, we use setInterval (no Redis dependency required).
 * Production version would use BullMQ repeatable jobs.
 *
 * Jobs are defined in spec YAML:
 *   jobs:
 *     - name: stale-tasks-detector
 *       schedule: interval
 *       value: 60s
 *       handler: ./handlers/stale-tasks.handler.ts
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as path from 'path';
import type { LoadedSpec } from './spec-loader';
import type { JobSpec } from './spec.types';

export interface JobHandler {
  default: (ctx: JobContext) => Promise<void>;
}

export interface JobContext {
  logger: Logger;
  specName: string;
  jobName: string;
}

@Injectable()
export class SpecJobRunner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('SpecJobRunner');
  private intervals: NodeJS.Timeout[] = [];
  private loadedSpecs: LoadedSpec[] = [];

  constructor() {}

  setLoadedSpecs(specs: LoadedSpec[]) {
    this.loadedSpecs = specs;
  }

  async onModuleInit() {
    // Load the specs that were passed via the DI context
    // For now, we accept them via a setter — the module sets this up
    for (const loaded of this.loadedSpecs) {
      for (const resource of loaded.spec.resources) {
        if (!resource.jobs || resource.jobs.length === 0) continue;

        for (const job of resource.jobs) {
          this.scheduleJob(loaded, job);
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

  private scheduleJob(loaded: LoadedSpec, job: JobSpec) {
    const intervalMs = this.parseInterval(job.value);

    if (intervalMs <= 0) {
      this.logger.warn(`⚠️  Invalid interval for job "${job.name}": ${job.value}`);
      return;
    }

    // Load the handler
    let handler: JobHandler['default'] | null = null;
    try {
      const handlerPath = path.resolve(loaded.dir, job.handler);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(handlerPath) as JobHandler;
      handler = mod.default;
    } catch (err) {
      this.logger.warn(
        `⚠️  Could not load job handler "${job.handler}" for "${job.name}": ${(err as Error).message}`,
      );
      return;
    }

    if (!handler) {
      this.logger.warn(`⚠️  Job handler "${job.handler}" has no default export`);
      return;
    }

    const ctx: JobContext = {
      logger: new Logger(`SpecJob:${job.name}`),
      specName: loaded.spec.name,
      jobName: job.name,
    };

    // Run immediately once, then on interval
    this.runHandler(handler, ctx, job);
    const interval = setInterval(() => this.runHandler(handler!, ctx, job), intervalMs);
    this.intervals.push(interval);

    this.logger.log(
      `⏰ Scheduled job "${job.name}" every ${job.value} (handler: ${job.handler})`,
    );
  }

  private async runHandler(
    handler: JobHandler['default'],
    ctx: JobContext,
    job: JobSpec,
  ) {
    try {
      await handler(ctx);
    } catch (err) {
      ctx.logger.error(
        `Job "${job.name}" failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Parse interval string to milliseconds
   * Supports: "60s", "5m", "1h", "500ms"
   */
  private parseInterval(value: string): number {
    const match = value.match(/^(\d+)(ms|s|m|h)$/);
    if (!match) return 0;

    const num = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'ms':
        return num;
      case 's':
        return num * 1000;
      case 'm':
        return num * 60 * 1000;
      case 'h':
        return num * 60 * 60 * 1000;
      default:
        return 0;
    }
  }
}