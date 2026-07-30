/**
 * SpecJobRunner — runs scheduled jobs defined in spec files.
 *
 * Uses setInterval for the spike (no Redis dependency required).
 * Production version would use BullMQ repeatable jobs.
 *
 * Jobs are defined in spec YAML:
 *   jobs:
 *     - name: stale-tasks-detector
 *       schedule: interval
 *       value: 60s
 *       handler: ./handlers/stale-tasks.handler.ts
 *
 * The job handler receives a HookContext — same interface as lifecycle hooks.
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as path from 'path';
import type { LoadedSpec } from './spec-loader';
import type { JobSpec, HookContext } from './spec.types';
import { SpecEngineBootService } from './spec-engine-boot';
import { HookContextImpl } from './hook-context';
import { TraceBuilder } from './spec-trace';

interface LoadedJobHandler {
  default: (ctx: HookContext) => Promise<void>;
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
    const intervalMs = this.parseInterval(job.value);

    if (intervalMs <= 0) {
      this.logger.warn(`⚠️  Invalid interval for job "${job.name}": ${job.value}`);
      return;
    }

    // Load the handler
    let handler: LoadedJobHandler['default'] | null = null;
    try {
      const handlerPath = path.resolve(loaded.dir, job.handler);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(handlerPath) as LoadedJobHandler;
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
      const moduleRef = SpecEngineBootService.getModuleRef();
      const configService = SpecEngineBootService.getConfigService();
      const trace = new TraceBuilder(
        resourceName,
        'list',
        null,
        this.logger,
        false,
      );

      const ctx = new HookContextImpl(
        moduleRef,
        configService,
        null,
        resourceName,
        'job',
        trace,
      ) as unknown as HookContext;

      await handler(ctx);
    } catch (err) {
      this.logger.error(`Job "${job.name}" failed: ${(err as Error).message}`);
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
      case 'ms': return num;
      case 's': return num * 1000;
      case 'm': return num * 60 * 1000;
      case 'h': return num * 60 * 60 * 1000;
      default: return 0;
    }
  }
}