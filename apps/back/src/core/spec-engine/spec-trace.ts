/**
 * SpecTrace — observability for the spec engine pipeline.
 *
 * Every request through a spec-driven resource produces a structured trace.
 * The trace captures what happened at each of the 7 pipeline stages:
 * auth → validation → beforeHook → db → afterHook → notifications → response.
 *
 * In dev mode: trace is attached to response via X-Spec-Trace header or ?_trace=true.
 * In prod mode: trace is logged at debug level; on failure, sent to ErrorTracker.
 */

import { Logger } from '@nestjs/common';
import type {
  SpecTrace,
  TraceStage,
  TraceStageName,
  TraceStageStatus,
  TraceWriter,
} from './spec.types';
import { traceStore } from './trace-store';

/**
 * TraceBuilder — builds a SpecTrace as the request flows through the pipeline.
 *
 * Usage:
 *   const trace = new TraceBuilder('task', 'create', user);
 *   trace.startStage('auth');
 *   // ... do auth ...
 *   trace.endStage('auth', 'pass', { guard: 'jwt' });
 *   // ... more stages ...
 *   trace.finish();
 *   const result = trace.toJSON();
 *
 * Every finished trace is pushed into the process-wide traceStore ring
 * buffer (dev AND prod) so it can be fetched later by requestId. Dev-only
 * extras (X-Spec-Trace header) are unchanged.
 */
export class TraceBuilder implements TraceWriter {
  private trace: SpecTrace;
  private stageStartTimes: Map<TraceStageName, number> = new Map();
  private readonly startTime: number;
  private _active: boolean;

  constructor(
    resource: string,
    operation:
      | 'create'
      | 'read'
      | 'update'
      | 'delete'
      | 'list'
      | 'webhook'
      | 'job',
    user: { id: number; role: string } | null,
    private readonly logger: Logger,
    isDev: boolean,
    requestId?: string,
  ) {
    this._active = isDev;
    this.startTime = Date.now();
    this.trace = {
      // Adopt the incoming x-request-id when provided so traces join with
      // error-tracker rows that already record it.
      requestId:
        requestId && requestId.trim().length > 0
          ? requestId.trim()
          : `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      resource,
      operation,
      user,
      stages: [],
      totalDurationMs: 0,
    };
  }

  /**
   * Start timing a stage
   */
  startStage(stage: TraceStageName): void {
    // Stage timing is cheap — always record it so prod traces carry the
    // full stage history in the ring buffer (bounded, so no leak).
    this.stageStartTimes.set(stage, Date.now());
  }

  /**
   * End a stage with a result
   */
  endStage(
    stage: TraceStageName,
    status: TraceStageStatus,
    meta?: Record<string, unknown>,
    input?: unknown,
    output?: unknown,
    error?: { message: string; code: string },
  ): void {
    // All stages are always recorded (dev AND prod): the ring buffer is
    // bounded, and full stage history on prod failures is the point. The
    // X-Spec-Trace header remains dev-only via isActive() in attachTrace.
    const startTime = this.stageStartTimes.get(stage) ?? Date.now();
    const durationMs = Date.now() - startTime;

    const traceStage: TraceStage = {
      stage,
      status,
      durationMs,
    };

    if (meta) traceStage.meta = meta;
    if (input !== undefined) traceStage.input = this.sanitize(input);
    if (output !== undefined) traceStage.output = this.sanitize(output);
    if (error) traceStage.error = error;

    this.trace.stages.push(traceStage);

    this.stageStartTimes.delete(stage);
  }

  /**
   * Skip a stage (no work to do)
   */
  skipStage(stage: TraceStageName, reason: string): void {
    this.trace.stages.push({
      stage,
      status: 'skip',
      durationMs: 0,
      meta: { reason },
    });
  }

  /**
   * Write custom metadata to the trace (used by hooks via ctx.trace.add)
   */
  add(stage: string, meta: Record<string, unknown>): void {
    if (!this._active) return;

    // Find the last stage matching this name, or add a meta entry
    const existing = [...this.trace.stages]
      .reverse()
      .find((s) => s.stage === stage);
    if (existing) {
      existing.meta = { ...existing.meta, ...meta };
    } else {
      // If no stage exists yet, store it as a pending meta that will be merged
      // when the stage is finalized
      this.trace.stages.push({
        stage: stage as TraceStageName,
        status: 'pass',
        durationMs: 0,
        meta,
      });
    }
  }

  /**
   * Check if tracing is active (dev mode or error capture)
   */
  isActive(): boolean {
    return this._active;
  }

  /**
   * Deprecated no-op. Traces are now always stored in the bounded ring
   * buffer (traceStore) regardless of mode, so forcing activation for
   * error capture is unnecessary. Kept for backwards compatibility with
   * any code that calls it.
   */
  activate(): void {
    // no-op
  }

  /**
   * Finalize the trace and store it in the process-wide ring buffer.
   */
  finish(): void {
    this.trace.totalDurationMs = Date.now() - this.startTime;
    try {
      traceStore.add(this.trace);
    } catch {
      // Storing must never break the request pipeline.
    }
  }

  /**
   * Get the completed trace as a plain object
   */
  toJSON(): SpecTrace {
    return { ...this.trace, stages: [...this.trace.stages] };
  }

  /**
   * Get a specific stage's result
   */
  getStage(stage: TraceStageName): TraceStage | undefined {
    return this.trace.stages.find((s) => s.stage === stage);
  }

  /**
   * Get the request ID
   */
  getRequestId(): string {
    return this.trace.requestId;
  }

  /**
   * Get the trace as a base64-encoded JSON string (for X-Spec-Trace header)
   */
  toBase64(): string {
    return Buffer.from(JSON.stringify(this.trace)).toString('base64');
  }

  /**
   * Pretty-print the trace to console (used by spec:trace CLI)
   */
  print(logger: Logger): void {
    const statusIcon = (s: TraceStageStatus) => {
      switch (s) {
        case 'pass':
          return '✅';
        case 'fail':
          return '❌';
        case 'skip':
          return '⏭️';
      }
    };

    const stages = this.trace.stages;
    logger.log(`spec:trace — ${this.trace.resource}.${this.trace.operation}`);
    logger.log(`${'─'.repeat(54)}`);
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      const num = `[${i + 1}]`;
      const icon = statusIcon(s.status);
      const dur = `${s.durationMs}ms`;
      logger.log(
        `${num.padEnd(5)} ${s.stage.padEnd(14)} ${icon}  ${dur.padStart(5)}`,
      );

      if (s.meta) {
        const metaStr = Object.entries(s.meta)
          .map(([k, v]) => {
            if (k === 'reason') return `  └─ ${k}: ${v}`;
            if (k === 'modified' && Array.isArray(v))
              return `  └─ modified: ${(v as string[]).join(', ')}`;
            if (k === 'fired' && Array.isArray(v))
              return `  └─ fired: ${(v as any[]).map((f) => f.name).join(', ')}`;
            if (k === 'skipped' && Array.isArray(v))
              return `  └─ skipped: ${(v as any[]).map((f) => f.name).join(', ')}`;
            return `  └─ ${k}: ${JSON.stringify(v)}`;
          })
          .join('\n');
        // Log each meta line individually for proper formatting
        for (const line of metaStr.split('\n')) {
          logger.log(`     ${line}`);
        }
      }

      if (s.error) {
        logger.log(`     └─ error: ${s.error.message}`);
      }
    }
    logger.log(`${'─'.repeat(54)}`);
    logger.log(`Total: ${this.trace.totalDurationMs}ms`);
  }

  /**
   * Sanitize sensitive data before storing in trace
   */
  private sanitize(data: unknown): unknown {
    if (data === null || data === undefined) return data;
    if (typeof data === 'string') {
      // Mask Authorization headers
      if (data.startsWith('Bearer ')) return 'Bearer ***';
      return data;
    }
    if (typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (
          key.toLowerCase() === 'authorization' ||
          key.toLowerCase() === 'password'
        ) {
          sanitized[key] = '***';
        } else if (
          key.toLowerCase() === 'headers' &&
          typeof value === 'object'
        ) {
          sanitized[key] = '***';
        } else {
          sanitized[key] = this.sanitize(value);
        }
      }
      return sanitized;
    }
    return data;
  }
}
