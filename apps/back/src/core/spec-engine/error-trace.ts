/**
 * error-trace — attach/extract a sanitized SpecTrace on thrown errors.
 *
 * When a pipeline stage throws, the controller/action/webhook factories
 * attach the finished trace to the error via a Symbol marker. The global
 * exception filter then extracts it when persisting 5xx errors to the
 * ErrorTracker, so the real stage history reaches the error DB instead of
 * a synthesized placeholder.
 *
 * A Symbol keeps the marker invisible to JSON serialization and to code
 * that enumerates error properties, while remaining retrievable within
 * the same process.
 */

import type { SpecTrace } from './spec.types';

/**
 * Symbol key under which a SpecTrace is attached to a thrown error.
 * Exported so tests can build/read the marker directly.
 */
export const SPEC_TRACE_MARKER: symbol = Symbol.for('spec-engine.trace');

/**
 * Shape carried on the error under SPEC_TRACE_MARKER.
 */
export interface AttachedTrace {
  trace: SpecTrace;
}

/**
 * Attach a (sanitized) trace to the error and return the same error so it
 * can be rethrown inline. Overwrites any previously attached trace.
 */
export function attachTraceToError<T extends Error>(
  err: T,
  trace: SpecTrace,
): T {
  if (err && typeof err === 'object') {
    Object.defineProperty(err, SPEC_TRACE_MARKER, {
      value: { trace } satisfies AttachedTrace,
      enumerable: false,
      writable: true,
      configurable: true,
    });
  }
  return err;
}

/**
 * Extract a trace previously attached with attachTraceToError, or null.
 */
export function extractTraceFromError(err: unknown): SpecTrace | null {
  if (!err || typeof err !== 'object') return null;
  const marker = (err as Record<PropertyKey, unknown>)[SPEC_TRACE_MARKER];
  if (
    marker &&
    typeof marker === 'object' &&
    'trace' in (marker as Record<string, unknown>)
  ) {
    const trace = (marker as AttachedTrace).trace;
    return trace ?? null;
  }
  return null;
}
