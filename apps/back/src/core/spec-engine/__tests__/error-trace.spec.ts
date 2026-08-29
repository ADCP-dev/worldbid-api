/**
 * error-trace helper + filter integration.
 *
 * Verifies:
 *  - attachTraceToError marks the error (non-enumerable symbol) and
 *    extractTraceFromError recovers the exact trace object.
 *  - extract returns null for plain errors / non-errors.
 *  - GlobalExceptionFilter persists the attached trace in ErrorTracker
 *    metadata (status ≥ 500 path) instead of nothing.
 *  - HookAbortError ActionableError shaping uses the real trace when one
 *    is attached (requestId preserved instead of a synthesized one).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  attachTraceToError,
  extractTraceFromError,
  SPEC_TRACE_MARKER,
} from '@src/core/spec-engine/error-trace';
import { GlobalExceptionFilter } from '@src/modules/error-tracker/filters/global-exception.filter';
import { HookAbortError } from '@src/core/spec-engine/spec.types';
import type { SpecTrace } from '@src/core/spec-engine/spec.types';

const realTrace: SpecTrace = {
  requestId: 'req_join_me_1',
  resource: 'task',
  operation: 'create',
  user: null,
  stages: [
    { stage: 'auth', status: 'pass', durationMs: 2 },
    { stage: 'db', status: 'fail', durationMs: 10 },
  ],
  totalDurationMs: 12,
  layer: 'controller_factory',
  step: 'create → transaction',
};

// ─── Helper unit tests ──────────────────────────────────────────────────────

describe('error-trace — attach/extract helpers', () => {
  it('should attach a trace and extract the same object back', () => {
    const err = new Error('db exploded');
    attachTraceToError(err, realTrace);

    const extracted = extractTraceFromError(err);
    expect(extracted).toBe(realTrace);
  });

  it('should attach via the exported symbol and stay non-enumerable', () => {
    const err = new Error('boom');
    attachTraceToError(err, realTrace);

    expect((err as never as Record<PropertyKey, unknown>)[SPEC_TRACE_MARKER]).toBeDefined();
    expect(Object.keys(err as never as Record<PropertyKey, unknown>)).not.toContain(
      String(SPEC_TRACE_MARKER),
    );
    // JSON serialization is unaffected.
    expect(() => JSON.stringify(err)).not.toThrow();
  });

  it('should return null for errors without a trace', () => {
    expect(extractTraceFromError(new Error('plain'))).toBeNull();
  });

  it('should return null for non-error values', () => {
    expect(extractTraceFromError(null)).toBeNull();
    expect(extractTraceFromError(undefined)).toBeNull();
    expect(extractTraceFromError('string')).toBeNull();
    expect(extractTraceFromError(42)).toBeNull();
  });

  it('should overwrite a previously attached trace', () => {
    const err = new Error('dup');
    const t2: SpecTrace = { ...realTrace, requestId: 'second' };
    attachTraceToError(err, realTrace);
    attachTraceToError(err, t2);
    expect(extractTraceFromError(err)?.requestId).toBe('second');
  });
});

// ─── GlobalExceptionFilter integration ──────────────────────────────────────

function makeHost(headers: Record<string, string> = {}) {
  const captured: {
    statusCode?: number;
    body?: Record<string, unknown>;
    logErrorArg?: Record<string, unknown>;
  } = {};
  const res: Record<string, unknown> = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      captured.body = body;
      return this;
    },
  };
  const req: Record<string, unknown> = {
    method: 'POST',
    url: '/tasks',
    body: { title: 'x' },
    query: {},
    ip: '127.0.0.1',
    headers,
  };
  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => req,
      }),
    },
    captured,
  };
}

function makeFilterWithSpy() {
  const logError = vi.fn().mockResolvedValue(undefined);
  const filter = new GlobalExceptionFilter({
    logError,
  } as never);
  return { filter, logError };
}

describe('GlobalExceptionFilter — real trace extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include the attached trace in ErrorTracker metadata on 5xx', () => {
    const { filter, logError } = makeFilterWithSpy();
    const { host, captured } = makeHost();
    const err = attachTraceToError(new Error('insert failed'), realTrace);

    filter.catch(err, host as never);

    expect(captured.statusCode).toBe(500);
    expect(logError).toHaveBeenCalledTimes(1);
    const arg = logError.mock.calls[0][0] as {
      metadata: Record<string, unknown>;
    };
    expect(arg.metadata.trace).toEqual(realTrace);
  });

  it('should not add a trace key when the error carries none (legacy shape)', () => {
    const { filter, logError } = makeFilterWithSpy();
    const { host } = makeHost();

    filter.catch(new Error('no trace here'), host as never);

    const arg = logError.mock.calls[0][0] as {
      metadata: Record<string, unknown>;
    };
    expect(arg.metadata.trace).toBeUndefined();
  });

  it('should use the real attached trace for HookAbortError ActionableError body', () => {
    const { filter } = makeFilterWithSpy();
    const { host, captured } = makeHost();
    const abort = attachTraceToError(
      new HookAbortError('hook said no', 400),
      realTrace,
    );

    filter.catch(abort, host as never);

    const body = captured.body as Record<string, unknown>;
    const actionable = body.error as Record<string, unknown>;
    expect(actionable).toBeDefined();
    // Real trace's requestId flows through instead of a synthesized one.
    expect(actionable.requestId).toBe('req_join_me_1');
  });
});