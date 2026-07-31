/**
 * Spec Engine — Scheduled Actions (entity-level)
 *
 * For resources that declare `scheduledActions`, every create/update of an
 * entity can schedule a delayed BullMQ job whose fire time is derived from a
 * field on the entity (ej: `dueDate`) plus an offset (ej: '-3d').
 *
 * Job ID convention: `${resource}_${entityId}_${actionName}` so a reschedule
 * (cancelOnUpdate) can reliably remove the previous job before adding a new
 * one.
 *
 * The handler signature mirrors the job runner:
 *   (ctx: HookContext, entity: Record<string, unknown>) => Promise<void>
 *
 * When Redis / BullMQ is unavailable, scheduling is skipped with a warning —
 * never throws (fire-and-forget from the controller's perspective).
 */
import { Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { EntitySchema, EntitySchemaColumnOptions } from 'typeorm';
import * as path from 'path';

import type { ResourceSpec, ScheduledActionSpec, HookContext } from './spec.types';
import { SpecEngineBootService } from './spec-engine-boot';
import { HookContextImpl } from './hook-context';
import { TraceBuilder } from './spec-trace';

/** Queue name shared with SpecJobRunner's BullMQ registration. */
const SPEC_QUEUE_NAME = 'spec-jobs';

/** Payload for a scheduled-action BullMQ job. */
export interface ScheduledActionJobData {
  resourceName: string;
  actionName: string;
  entityId: number;
  handler: string;
  extensionDir: string;
  entity: Record<string, unknown>;
}

// ─── interval parser (shared shape with spec-job-runner) ────────────────────

/**
 * Parse an offset string like '-3d', '+1h', '+7d', '-30m', '-500ms' into
 * milliseconds. Negative numbers move the trigger earlier in time.
 */
function parseOffset(value: string): number {
  const match = value.match(/^([+-]?)(\d+)(ms|s|m|h|d)$/);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const num = parseInt(match[2], 10);
  const unit = match[3];
  const mult =
    unit === 'ms' ? 1
    : unit === 's' ? 1000
    : unit === 'm' ? 60 * 1000
    : unit === 'h' ? 60 * 60 * 1000
    : unit === 'd' ? 24 * 60 * 60 * 1000
    : 0;
  return sign * num * mult;
}

function isRedisAvailable(): boolean {
  const workerHost = process.env.WORKER_HOST;
  return (
    typeof workerHost === 'string' &&
    workerHost.length > 0 &&
    workerHost !== 'undefined' &&
    workerHost !== 'null'
  );
}

// ─── subscription schema for dynamic webhook subscriptions ─────────────────
// (Defined here so the scheduled-actions file stays self-contained; the
//  outbound-webhooks file re-uses the same schema token.)
export interface SpecWebhookSubscriptionRow {
  id: number;
  event: string;
  url: string;
  secret?: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const SPEC_WEBHOOK_SUBSCRIPTION_SCHEMA_NAME = 'SpecWebhookSubscription';

export function createSpecWebhookSubscriptionSchema(): EntitySchema<any> {
  const columns: Record<string, EntitySchemaColumnOptions> = {
    id: { type: Number, primary: true, generated: true },
    event: { type: String, length: 255, nullable: false },
    url: { type: String, length: 1024, nullable: false },
    secret: { type: String, length: 255, nullable: true },
    active: { type: Boolean, default: true, nullable: false },
    createdAt: { type: Date, createDate: true },
    updatedAt: { type: Date, updateDate: true },
  };
  return new EntitySchema<any>({
    name: SPEC_WEBHOOK_SUBSCRIPTION_SCHEMA_NAME,
    tableName: 'spec_webhook_subscriptions',
    columns,
    indices: [
      { columns: ['event'] },
    ],
  });
}

// ─── manager ───────────────────────────────────────────────────────────────

export class SpecScheduledActionManager {
  private static readonly logger = new Logger('SpecScheduledActions');

  /**
   * Schedule (or reschedule) a delayed BullMQ job for a single scheduled
   * action on a single entity. Never throws — failures are logged.
   *
   * Params:
   *   - entity: the persisted (or updated) entity row
   *   - spec: the resource spec
   *   - action: the scheduled action spec
   *   - ctx: hook context (for building the handler's context later)
   */
  static async schedule(params: {
    entity: Record<string, unknown>;
    spec: ResourceSpec;
    action: ScheduledActionSpec;
    ctx: HookContext;
  }): Promise<void> {
    const { entity, spec, action, ctx } = params;

    const entityId = Number(entity?.id);
    if (!Number.isFinite(entityId)) {
      this.logger.warn(
        `Skipping scheduled action "${action.name}" — entity has no numeric id`,
      );
      return;
    }

    if (!isRedisAvailable()) {
      // No Redis → no delayed jobs. Skip silently; the spec-job-runner's
      // setInterval fallback doesn't support one-shot delayed jobs.
      this.logger.debug(
        `Redis unavailable — skipping scheduled action "${action.name}" for ${spec.name}#${entityId}`,
      );
      return;
    }

    const queue = this.resolveQueue();
    if (!queue) {
      this.logger.warn(
        `spec-jobs queue not resolved — cannot schedule action "${action.name}"`,
      );
      return;
    }

    // Resolve the trigger field value from the entity.
    const triggerRaw = entity[action.trigger];
    if (triggerRaw === undefined || triggerRaw === null) {
      this.logger.debug(
        `Scheduled action "${action.name}" skipped — trigger field "${action.trigger}" is empty on ${spec.name}#${entityId}`,
      );
      return;
    }

    const triggerDate = this.toDate(triggerRaw);
    if (!triggerDate) {
      this.logger.warn(
        `Scheduled action "${action.name}" — trigger "${action.trigger}" is not a date: ${String(triggerRaw)}`,
      );
      return;
    }

    const offsetMs = parseOffset(action.offset || '0');
    const fireAt = new Date(triggerDate.getTime() + offsetMs);
    const now = Date.now();
    const delayMs = fireAt.getTime() - now;

    // Job id convention: stable, unique per (resource, entity, action).
    const jobId = `${spec.name}_${entityId}_${action.name}`;

    // cancelOnUpdate: remove any previously scheduled job for this entity+action.
    if (action.cancelOnUpdate) {
      try {
        const existing = await queue.getJob(jobId);
        if (existing) {
          await existing.remove();
          this.logger.debug(
            `Cancelled previous scheduled action "${action.name}" for ${spec.name}#${entityId} (job ${jobId})`,
          );
        }
      } catch (err) {
        // Job may already be completed/removed — best effort.
        this.logger.debug(
          `Could not cancel previous job ${jobId}: ${(err as Error).message}`,
        );
      }
    }

    // If the fire time is in the past, fire immediately (delay 0) so the
    // handler still runs. BullMQ treats delay <= 0 as "now".
    const delay = delayMs > 0 ? delayMs : 0;

    // Resolve the extension dir from the boot service so we can pass it to
    // the job payload. The controller passes it via ctx, but we keep a
    // fallback by deriving it from the spec loader's conventions.
    const extensionDir =
      (entity as any).__extensionDir ||
      this.guessExtensionDir(spec.name);

    const jobData: ScheduledActionJobData = {
      resourceName: spec.name,
      actionName: action.name,
      entityId,
      handler: action.handler,
      extensionDir,
      entity,
    };

    try {
      await queue.add(jobId, jobData, {
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      });
      this.logger.log(
        `⏰ Scheduled action "${action.name}" for ${spec.name}#${entityId} — fires at ${fireAt.toISOString()} (delay ${delay}ms, job ${jobId})`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to schedule action "${action.name}" for ${spec.name}#${entityId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Load and execute a scheduled action handler (called by the BullMQ
   * processor). The handler receives a freshly built HookContext and the
   * entity snapshot from when the job was scheduled.
   */
  static async execute(params: {
    data: ScheduledActionJobData;
    logger: Logger;
  }): Promise<void> {
    const { data, logger } = params;
    const handler = this.loadHandler(data.extensionDir, data.handler, data.actionName, logger);
    if (!handler) {
      throw new Error(
        `Scheduled action handler "${data.handler}" for "${data.actionName}" could not be loaded`,
      );
    }
    const ctx = this.buildContext(data.resourceName, logger);
    await handler(ctx, data.entity);
  }

  // ─── helpers ────────────────────────────────────────────────────────────

  private static resolveQueue(): Queue<ScheduledActionJobData> | null {
    try {
      const moduleRef = SpecEngineBootService.getModuleRef();
      const token = getQueueToken(SPEC_QUEUE_NAME);
      return moduleRef.get<Queue<ScheduledActionJobData>>(token, { strict: false }) || null;
    } catch {
      return null;
    }
  }

  private static buildContext(resourceName: string, logger: Logger): HookContext {
    const moduleRef = SpecEngineBootService.getModuleRef();
    const configService = SpecEngineBootService.getConfigService();
    const trace = new TraceBuilder(
      resourceName,
      'job',
      null,
      logger,
      process.env.NODE_ENV !== 'production',
    );
    return new HookContextImpl(
      moduleRef,
      configService,
      null,
      resourceName,
      'scheduledAction',
      trace,
    ) as unknown as HookContext;
  }

  private static loadHandler(
    extensionDir: string,
    handlerPath: string,
    actionName: string,
    logger: Logger,
  ): ((ctx: HookContext, entity: Record<string, unknown>) => Promise<void>) | null {
    try {
      const resolved = path.resolve(extensionDir, handlerPath);
      const normalizedDir = path.resolve(extensionDir) + path.sep;
      if (!resolved.startsWith(normalizedDir)) {
        logger.warn(`Scheduled action handler "${handlerPath}" escapes extension directory`);
        return null;
      }
      const requirePath =
        process.env.NODE_ENV === 'production'
          ? resolved.replace(/\.ts$/, '.js')
          : resolved;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(requirePath);
      const handler =
        mod && typeof mod === 'object' && 'default' in mod ? mod.default : mod;
      if (typeof handler !== 'function') {
        logger.warn(
          `⚠️  Scheduled action "${actionName}" handler has no default export function`,
        );
        return null;
      }
      return handler;
    } catch (err) {
      logger.warn(
        `⚠️  Could not load scheduled action handler "${handlerPath}" for "${actionName}": ${(err as Error).message}`,
      );
      return null;
    }
  }

  private static toDate(value: unknown): Date | null {
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  /**
   * Best-effort guess of the extension dir from the resource name. The spec
   * loader scans `<extensionsDir>/<ext>/` for .spec.yaml files, so we look
   * for a directory whose spec contains this resource. If the boot service
   * has loaded specs, we use those.
   */
  private static guessExtensionDir(resourceName: string): string {
    try {
      const moduleRef = SpecEngineBootService.getModuleRef();
      const loadedSpecs = moduleRef.get<any[]>('SPEC_LOADED_SPECS', { strict: false });
      if (Array.isArray(loadedSpecs)) {
        for (const loaded of loadedSpecs) {
          if (
            loaded?.spec?.resources?.some((r: any) => r.name === resourceName)
          ) {
            return loaded.dir || '';
          }
        }
      }
    } catch {
      // boot not ready — fall through
    }
    return '';
  }
}