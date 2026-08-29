/**
 * HookExecutor — loads, validates, and executes lifecycle hooks.
 *
 * At materialization time: loads hook handlers via the shared extension
 * module loader (require cache semantics preserved), validates they export
 * a default function, and caches them.
 *
 * At runtime: wraps hook execution with trace + error handling.
 *
 * Hook contracts:
 *   BeforeHook: (data, ctx) → { data, proceed, error? }
 *   AfterHook:  (entity, ctx) → void
 */

import {
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FindManyOptions } from 'typeorm';
import * as path from 'path';

import type {
  BeforeHook,
  BeforeHookResult,
  BeforeQueryHook,
  AfterHook,
  HookContext,
  SpecTrace,
  ResourceSpec,
} from './spec.types';
import { HookAbortError } from './spec.types';
import type { VectorFieldSpec } from './spec.types';
import type { SpecErrorReporter } from './spec-error-reporter';
import { computeSpecErrorHash } from './spec-error-reporter';
import type { TraceBuilder } from './spec-trace';
import {
  resolveHookModulePath,
  loadExtensionModule,
} from './extension-module-loader';

export type HookType =
  | 'beforeCreate'
  | 'afterCreate'
  | 'beforeUpdate'
  | 'afterUpdate'
  | 'beforeDelete'
  | 'afterDelete'
  | 'beforeQuery';

export interface LoadedHook {
  handler: BeforeHook | AfterHook | BeforeQueryHook;
  path: string;
}

export class HookExecutor {
  private readonly logger = new Logger('HookExecutor');
  private hookCache: Map<string, LoadedHook> = new Map();
  private errorReporter: SpecErrorReporter | null = null;

  setErrorReporter(reporter: SpecErrorReporter): void {
    this.errorReporter = reporter;
  }

  /**
   * Load a hook handler at materialization time.
   * Returns null if the handler can't be loaded (with a warning).
   */
  loadHook(
    hookPath: string | undefined,
    extensionDir: string,
    resourceName: string,
    hookType: HookType,
  ): LoadedHook | null {
    if (!hookPath) return null;

    // Path containment + prod .ts/.js resolution live in the shared loader.
    const absolutePath = path.resolve(extensionDir, hookPath);
    const requirePath = resolveHookModulePath(absolutePath, extensionDir);
    if (!requirePath) {
      this.logger.warn(
        `⚠️  Hook path "${hookPath}" escapes extension directory — skipping`,
      );
      return null;
    }
    const cacheKey = `${resourceName}:${hookType}:${absolutePath}`;

    // Check cache
    const cached = this.hookCache.get(cacheKey);
    if (cached) return cached;

    try {
      const mod = loadExtensionModule(requirePath);
      const handler = mod.default;

      if (typeof handler !== 'function') {
        this.logger.warn(
          `⚠️  Hook "${hookPath}" for ${resourceName}.${hookType} has no default export function — skipping`,
        );
        return null;
      }

      const loaded: LoadedHook = { handler, path: absolutePath };
      this.hookCache.set(cacheKey, loaded);

      this.logger.log(
        `🪩 Loaded hook: ${resourceName}.${hookType} → ${hookPath}`,
      );

      return loaded;
    } catch (err) {
      this.logger.warn(
        `⚠️  Could not load hook "${hookPath}" for ${resourceName}.${hookType}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Execute a before hook.
   * Returns the (possibly modified) data and whether to proceed.
   * Throws BadRequestException on abort, InternalServerErrorException on unexpected error.
   */
  async executeBeforeHook(
    hook: LoadedHook,
    data: Record<string, unknown>,
    ctx: HookContext,
    trace: TraceBuilder,
  ): Promise<{
    data: Record<string, unknown>;
    proceed: boolean;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const result = await (hook.handler as BeforeHook)(data, ctx);

      const modifiedFields = this.getModifiedFields(data, result.data);

      if (!result.proceed) {
        // Log abort to trace and throw — single endStage call
        trace.endStage('beforeHook', 'fail', {
          hook: hook.path,
          modified: modifiedFields,
          proceed: false,
          error: result.error,
        });
        throw new HookAbortError(
          result.error || 'Hook aborted the operation',
          400,
        );
      }

      trace.endStage('beforeHook', 'pass', {
        hook: hook.path,
        modified: modifiedFields,
        proceed: true,
      });

      return { data: result.data, proceed: true };
    } catch (err) {
      // If the error is from proceed=false, trace was already recorded above.
      // Only record trace for UNEXPECTED errors (not BadRequestException from abort).
      if (err instanceof BadRequestException) {
        // Trace already recorded in the proceed=false path above — just re-throw
        throw err;
      }

      if (err instanceof HookAbortError) {
        trace.endStage(
          'beforeHook',
          'fail',
          {
            hook: hook.path,
            error: err.message,
          },
          undefined,
          undefined,
          { message: err.message, code: 'HOOK_ABORT' },
        );
        throw new BadRequestException(err.message);
      }

      // Unexpected error — log and throw 500
      const duration = Date.now() - startTime;
      this.logger.error(
        `Before hook "${hook.path}" failed after ${duration}ms: ${(err as Error).message}`,
      );

      trace.endStage(
        'beforeHook',
        'fail',
        {
          hook: hook.path,
          error: (err as Error).message,
        },
        undefined,
        undefined,
        { message: (err as Error).message, code: 'HOOK_ERROR' },
      );

      // ─── Trace enrichment (PRD 01): report with an enriched SpecTrace ──
      if (this.errorReporter) {
        const message = (err as Error).message;
        const stack = (err as Error).stack ?? '';
        this.errorReporter
          .report({
            message,
            source: `spec-engine/hook:${hook.path}`,
            stack,
            resource: ctx.resource,
            operation: ctx.operation,
            stage: 'beforeHook',
            hash: computeSpecErrorHash(message, `spec-engine/hook:${hook.path}`, stack),
            occurrences: 1,
            inputData: data,
            trace: {
              requestId: trace.getRequestId(),
              resource: ctx.resource,
              operation: ctx.operation as SpecTrace['operation'],
              user: null,
              stages: [],
              totalDurationMs: duration,
              extension: undefined,
              specFile: undefined,
              layer: 'hook_executor',
              step: `executing ${ctx.operation} beforeHook`,
              input: data,
              userId: ctx.user?.id ?? null,
              userRole: ctx.user?.role?.name ?? null,
              handlerFile: hook.path,
              handlerFunction: 'default',
            },
          })
          .catch(() => {
            /* reporting never throws */
          });
      }

      throw new InternalServerErrorException(
        `Hook execution failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Execute an after hook.
   * Errors are logged but NOT thrown (fire-and-forget).
   */
  async executeAfterHook(
    hook: LoadedHook,
    entity: Record<string, unknown>,
    ctx: HookContext,
    trace: TraceBuilder,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      await (hook.handler as AfterHook)(entity, ctx);

      trace.endStage('afterHook', 'pass', {
        hook: hook.path,
        durationMs: Date.now() - startTime,
      });
    } catch (err) {
      // After hooks are fire-and-forget — log but don't throw
      this.logger.error(
        `After hook "${hook.path}" failed: ${(err as Error).message}`,
        (err as Error).stack,
      );

      // Report to ErrorTracker + SpecErrorReporter (Telegram + GitHub)
      try {
        await ctx.logError(
          `After hook failed: ${(err as Error).message}`,
          `spec-engine:${ctx.resource}:${ctx.operation}`,
          {
            hookPath: hook.path,
            entityId: entity.id,
            error: (err as Error).stack,
          },
        );
      } catch {
        // ErrorTracker not available — already logged above
      }

      // Also report via SpecErrorReporter for Telegram + GitHub issue
      if (this.errorReporter) {
        try {
          // Use the static import of computeSpecErrorHash (top of file)
          this.errorReporter.report({
            message: `After hook failed: ${(err as Error).message}`,
            source: `spec-engine:${ctx.resource}:${ctx.operation}`,
            stack: (err as Error).stack,
            resource: ctx.resource,
            operation: ctx.operation,
            stage: 'afterHook',
            hookPath: hook.path,
            hash: computeSpecErrorHash(
              `After hook failed: ${(err as Error).message}`,
              `spec-engine:${ctx.resource}:${ctx.operation}`,
              (err as Error).stack,
            ),
            occurrences: 1,
          });
        } catch {
          // Best effort — don't let reporting fail the pipeline
        }
      }

      trace.endStage(
        'afterHook',
        'fail',
        {
          hook: hook.path,
          error: (err as Error).message,
        },
        undefined,
        undefined,
        { message: (err as Error).message, code: 'HOOK_ERROR' },
      );
    }
  }

  /**
   * Execute a beforeQuery hook.
   * The hook receives the current FindManyOptions and may modify them
   * (add WHERE clauses, joins, relations, etc.).
   * Returns the (possibly modified) options.
   * Errors are caught and logged — the hook fails gracefully and the
   * original options are returned so the query can still run.
   */
  async executeBeforeQueryHook(
    hook: LoadedHook,
    options: FindManyOptions,
    ctx: HookContext,
    trace: TraceBuilder,
  ): Promise<FindManyOptions> {
    const startTime = Date.now();

    try {
      const modified = await (hook.handler as BeforeQueryHook)(options, ctx);

      trace.endStage('beforeHook', 'pass', {
        hook: hook.path,
        modified: true,
        durationMs: Date.now() - startTime,
      });

      return modified;
    } catch (err) {
      // beforeQuery hooks fail gracefully — log but return original options
      this.logger.error(
        `beforeQuery hook "${hook.path}" failed: ${(err as Error).message}`,
        (err as Error).stack,
      );

      try {
        await ctx.logError(
          `beforeQuery hook failed: ${(err as Error).message}`,
          `spec-engine:${ctx.resource}:${ctx.operation}`,
          { hookPath: hook.path, error: (err as Error).stack },
        );
      } catch {
        // ErrorTracker not available — already logged above
      }

      trace.endStage(
        'beforeHook',
        'fail',
        {
          hook: hook.path,
          error: (err as Error).message,
        },
        undefined,
        undefined,
        { message: (err as Error).message, code: 'HOOK_ERROR' },
      );

      return options;
    }
  }

  /**
   * Determine which fields were modified by a before hook
   */
  private getModifiedFields(
    original: Record<string, unknown>,
    modified: Record<string, unknown>,
  ): string[] {
    const changed: string[] = [];
    for (const key of Object.keys(modified)) {
      if (!(key in original) || original[key] !== modified[key]) {
        changed.push(key);
      }
    }
    return changed;
  }

  // ─── PRD 06: pgvector auto-embed ─────────────────────────────────────

  /**
   * Execute auto-embed after create. Generates an embedding from the
   * source field and updates the entity. Never throws — failures are
   * logged and optionally enqueued for retry.
   */
  async executeAutoEmbed(
    entity: Record<string, unknown>,
    ctx: HookContext,
    resource: ResourceSpec,
  ): Promise<void> {
    const vectorField = resource.fields.find(
      (f) => f.type === 'vector',
    ) as VectorFieldSpec | undefined;

    if (!vectorField?.autoEmbed) return;

    const { source, model, provider } = vectorField.autoEmbed;
    const sourceValue = entity[source];

    if (!sourceValue) return;

    const entityId = (entity as { id: number }).id;

    try {
      const embedding = await ctx.embed(String(sourceValue), model, provider);
      await ctx.getRepository(resource.name).update(entityId, {
        [vectorField.name]: embedding,
      });
    } catch (err) {
      ctx.logger.warn(
        `autoEmbed failed for ${resource.name}:${entityId}: ${(err as Error).message}`,
      );
      // Retry async if queue is available
      const ctxWithQueue = ctx as HookContext & {
        queue?: { add: (name: string, data: unknown, opts?: unknown) => Promise<void> };
      };
      if (ctxWithQueue.queue) {
        await ctxWithQueue.queue.add(
          'embed-retry',
          {
            resourceId: entityId,
            resource: resource.name,
            field: vectorField.name,
            source,
            model,
            provider,
          },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          },
        );
      }
    }
  }

  /**
   * Execute auto-embed after update. Only regenerates the embedding when
   * the source field changed in the update.
   */
  async executeAutoEmbedOnUpdate(
    entity: Record<string, unknown>,
    ctx: HookContext,
    resource: ResourceSpec,
    changes?: Record<string, unknown>,
  ): Promise<void> {
    const vectorField = resource.fields.find(
      (f) => f.type === 'vector',
    ) as VectorFieldSpec | undefined;

    if (!vectorField?.autoEmbed) return;

    // Only re-embed if the source field was actually changed
    if (!changes || !(vectorField.autoEmbed.source in changes)) return;

    // Delegate to the same logic as afterCreate
    return this.executeAutoEmbed(entity, ctx, resource);
  }
}
