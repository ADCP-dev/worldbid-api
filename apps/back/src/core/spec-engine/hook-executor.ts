/**
 * HookExecutor — loads, validates, and executes lifecycle hooks.
 *
 * At materialization time: loads hook handlers via require(), validates
 * they export a default function, and caches them.
 *
 * At runtime: wraps hook execution with trace + error handling.
 *
 * Hook contracts:
 *   BeforeHook: (data, ctx) → { data, proceed, error? }
 *   AfterHook:  (entity, ctx) → void
 */

import { Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { FindManyOptions } from 'typeorm';
import * as path from 'path';

import type {
  BeforeHook,
  BeforeHookResult,
  BeforeQueryHook,
  AfterHook,
  HookContext,
} from './spec.types';
import { HookAbortError } from './spec.types';
import type { SpecErrorReporter } from './spec-error-reporter';
import type { TraceBuilder } from './spec-trace';

export type HookType = 'beforeCreate' | 'afterCreate' | 'beforeUpdate' | 'afterUpdate' | 'beforeDelete' | 'afterDelete' | 'beforeQuery';

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

    const absolutePath = path.resolve(extensionDir, hookPath);
    // Path containment: prevent directory traversal
    const normalizedDir = path.resolve(extensionDir) + path.sep;
    if (!absolutePath.startsWith(normalizedDir)) {
      this.logger.warn(
        `⚠️  Hook path "${hookPath}" escapes extension directory — skipping`,
      );
      return null;
    }
    // In production, .ts files are compiled to .js — strip extension
    const requirePath = process.env.NODE_ENV === 'production'
      ? absolutePath.replace(/\.ts$/, '.js')
      : absolutePath;
    const cacheKey = `${resourceName}:${hookType}:${absolutePath}`;

    // Check cache
    const cached = this.hookCache.get(cacheKey);
    if (cached) return cached;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(requirePath);
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
  ): Promise<{ data: Record<string, unknown>; proceed: boolean }> {
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
        throw new BadRequestException(
          result.error || 'Hook aborted the operation',
        );
      }

      trace.endStage('beforeHook', 'pass', {
        hook: hook.path,
        modified: modifiedFields,
        proceed: true,
      });

      return { data: result.data, proceed: true };
    } catch (err) {
      if (err instanceof BadRequestException) {
        // Hook returned proceed: false — this is expected
        trace.endStage('beforeHook', 'fail', {
          hook: hook.path,
          error: err.message,
        }, undefined, undefined, { message: err.message, code: 'HOOK_ABORT' });
        throw err;
      }

      if (err instanceof HookAbortError) {
        trace.endStage('beforeHook', 'fail', {
          hook: hook.path,
          error: err.message,
        }, undefined, undefined, { message: err.message, code: 'HOOK_ABORT' });
        throw new BadRequestException(err.message);
      }

      // Unexpected error — log and throw 500
      const duration = Date.now() - startTime;
      this.logger.error(
        `Before hook "${hook.path}" failed after ${duration}ms: ${(err as Error).message}`,
      );

      trace.endStage('beforeHook', 'fail', {
        hook: hook.path,
        error: (err as Error).message,
      }, undefined, undefined, { message: (err as Error).message, code: 'HOOK_ERROR' });

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
          { hookPath: hook.path, entityId: entity.id, error: (err as Error).stack },
        );
      } catch {
        // ErrorTracker not available — already logged above
      }

      // Also report via SpecErrorReporter for Telegram + GitHub issue
      if (this.errorReporter) {
        try {
          const { computeSpecErrorHash } = require('./spec-error-reporter');
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

      trace.endStage('afterHook', 'fail', {
        hook: hook.path,
        error: (err as Error).message,
      }, undefined, undefined, { message: (err as Error).message, code: 'HOOK_ERROR' });
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

      trace.endStage('beforeHook', 'fail', {
        hook: hook.path,
        error: (err as Error).message,
      }, undefined, undefined, { message: (err as Error).message, code: 'HOOK_ERROR' });

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
}