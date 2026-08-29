/**
 * TraceStore — in-memory ring buffer of finished spec-engine traces.
 *
 * Every TraceBuilder.finish() pushes its SpecTrace here (dev AND prod), so
 * any request's stage history can be looked up later by requestId via
 * GET /_spec/trace/:requestId (admin-only) or the spec:trace CLI.
 *
 * The buffer is bounded (default 500 entries): oldest traces are evicted
 * automatically when the cap is exceeded. Node's single event loop makes
 * plain array + Map operations safe without further synchronization.
 */

import type { SpecTrace } from './spec.types';

/** Default maximum number of traces kept in memory. */
export const TRACE_STORE_DEFAULT_LIMIT = 500;

/**
 * Bounded FIFO ring buffer of finished traces, keyed by requestId.
 */
export class TraceStore {
  private traces: Map<string, SpecTrace> = new Map();
  private order: string[] = [];
  private readonly limit: number;

  constructor(limit: number = TRACE_STORE_DEFAULT_LIMIT) {
    if (!Number.isFinite(limit) || limit < 1) {
      throw new Error(
        `TraceStore limit must be a positive number, got ${limit}`,
      );
    }
    this.limit = limit;
  }

  /**
   * Store a finished trace. When the buffer is full the oldest trace is
   * evicted. Re-adding an existing requestId refreshes its position.
   */
  add(trace: SpecTrace): void {
    if (!trace || !trace.requestId) return;

    // Refresh: drop any previous entry with the same requestId.
    if (this.traces.has(trace.requestId)) {
      this.traces.delete(trace.requestId);
      this.order = this.order.filter((id) => id !== trace.requestId);
    }

    this.traces.set(trace.requestId, trace);
    this.order.push(trace.requestId);

    while (this.order.length > this.limit) {
      const evicted = this.order.shift();
      if (evicted !== undefined) this.traces.delete(evicted);
    }
  }

  /**
   * Get a stored trace by requestId, or undefined when absent/evicted.
   */
  get(requestId: string): SpecTrace | undefined {
    if (!requestId) return undefined;
    return this.traces.get(requestId);
  }

  /**
   * List stored traces newest-first, optionally filtered by resource name.
   */
  list(filter?: { resource?: string; limit?: number }): SpecTrace[] {
    const newestFirst = [...this.order]
      .reverse()
      .map((id) => this.traces.get(id))
      .filter((t): t is SpecTrace => t !== undefined);

    const byResource = filter?.resource
      ? newestFirst.filter((t) => t.resource === filter.resource)
      : newestFirst;

    const limit =
      filter?.limit !== undefined && Number.isFinite(filter.limit)
        ? Math.max(0, Math.floor(filter.limit))
        : byResource.length;
    return byResource.slice(0, limit);
  }

  /**
   * Drop every stored trace (used by tests).
   */
  clear(): void {
    this.traces.clear();
    this.order = [];
  }

  /**
   * Number of traces currently stored.
   */
  size(): number {
    return this.order.length;
  }
}

/**
 * Module-level singleton used by TraceBuilder + the meta controller.
 */
export const traceStore = new TraceStore();

/**
 * Test seam — replaces the singleton with a fresh store (and restores the
 * default capacity). Returns the new instance.
 */
export function resetTraceStoreForTest(limit?: number): TraceStore {
  const fresh = new TraceStore(limit);
  Object.assign(traceStore, fresh);
  return traceStore;
}
