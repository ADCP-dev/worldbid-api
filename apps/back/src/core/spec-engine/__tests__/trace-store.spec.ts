/**
 * TraceStore + TraceBuilder store integration.
 *
 * Covers:
 *  - Ring eviction: inserts beyond the cap drop the oldest trace.
 *  - get() by requestId works for stored traces; misses return undefined.
 *  - list() returns newest-first with optional resource + limit filters.
 *  - Prod-mode TraceBuilder records ALL stages (not only failures) and
 *    finish() lands the trace in the store.
 *  - requestId adopted from the incoming x-request-id header value.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { Logger } from '@nestjs/common';

import {
  TraceStore,
  resetTraceStoreForTest,
  traceStore,
} from '@src/core/spec-engine/trace-store';
import { TraceBuilder } from '@src/core/spec-engine/spec-trace';
import type { SpecTrace } from '@src/core/spec-engine/spec.types';

function makeTrace(requestId: string, resource = 'task'): SpecTrace {
  return {
    requestId,
    resource,
    operation: 'create',
    user: null,
    stages: [
      { stage: 'auth', status: 'pass', durationMs: 1 },
    ],
    totalDurationMs: 5,
  };
}

const noopLogger = new Logger('TraceStoreSpec');

describe('TraceStore — ring buffer', () => {
  it('should evict the oldest trace when the cap is exceeded', () => {
    const store = new TraceStore(3);
    store.add(makeTrace('a'));
    store.add(makeTrace('b'));
    store.add(makeTrace('c'));
    expect(store.size()).toBe(3);

    store.add(makeTrace('d'));

    expect(store.size()).toBe(3);
    expect(store.get('a')).toBeUndefined();
    expect(store.get('b')).toBeDefined();
    expect(store.get('c')).toBeDefined();
    expect(store.get('d')).toBeDefined();
  });

  it('should return stored traces by requestId', () => {
    const store = new TraceStore(2);
    const trace = makeTrace('req-42');
    store.add(trace);
    expect(store.get('req-42')).toBe(trace);
    expect(store.get('missing')).toBeUndefined();
  });

  it('should list newest-first with resource and limit filters', () => {
    const store = new TraceStore(10);
    store.add(makeTrace('t1', 'task'));
    store.add(makeTrace('t2', 'user'));
    store.add(makeTrace('t3', 'task'));
    store.add(makeTrace('t4', 'task'));

    const all = store.list();
    expect(all.map((t) => t.requestId)).toEqual(['t4', 't3', 't2', 't1']);

    const onlyTasks = store.list({ resource: 'task' });
    expect(onlyTasks.map((t) => t.requestId)).toEqual(['t4', 't3', 't1']);

    const limited = store.list({ resource: 'task', limit: 1 });
    expect(limited.map((t) => t.requestId)).toEqual(['t4']);
  });

  it('should refresh position when the same requestId is re-added', () => {
    const store = new TraceStore(3);
    store.add(makeTrace('a'));
    store.add(makeTrace('b'));
    store.add(makeTrace('a'));
    expect(store.size()).toBe(2);
    // 'a' should now be newest.
    const list = store.list();
    expect(list[0].requestId).toBe('a');
  });

  it('should clear everything on clear()', () => {
    const store = new TraceStore(2);
    store.add(makeTrace('a'));
    store.clear();
    expect(store.size()).toBe(0);
  });
});

describe('TraceStore — module singleton', () => {
  beforeEach(() => {
    resetTraceStoreForTest();
  });

  it('should expose a shared singleton that TraceBuilder feeds via finish()', () => {
    const builder = new TraceBuilder(
      'task',
      'create',
      null,
      noopLogger,
      false,
    );
    builder.startStage('auth');
    builder.endStage('auth', 'pass', { guard: 'jwt' });
    builder.finish();

    const stored = traceStore.get(builder.getRequestId());
    expect(stored).toBeDefined();
    expect(stored?.stages.map((s) => s.stage)).toEqual(['auth']);
  });
});

describe('TraceBuilder — prod mode full stage history', () => {
  beforeEach(() => {
    resetTraceStoreForTest();
  });

  it('should record all stages in prod (not only failures) and land them in the store', () => {
    const builder = new TraceBuilder(
      'task',
      'delete',
      null,
      noopLogger,
      false, // prod
    );

    builder.startStage('auth');
    builder.endStage('auth', 'pass', { guard: 'jwt' });
    builder.skipStage('beforeHook', 'no hook');
    builder.startStage('db');
    builder.endStage('db', 'fail', { error: 'boom' }, undefined, undefined, {
      message: 'boom',
      code: 'DB_ERROR',
    });
    builder.finish();

    const stored = traceStore.get(builder.getRequestId());
    expect(stored).toBeDefined();
    // Full history: pass + skip + fail — even in prod mode.
    expect(stored?.stages.map((s) => s.stage)).toEqual([
      'auth',
      'beforeHook',
      'db',
    ]);
    const dbStage = stored?.stages.find((s) => s.stage === 'db');
    expect(dbStage?.status).toBe('fail');
    expect(dbStage?.error?.message).toBe('boom');
  });

  it('should still keep failure-only in-memory recording for dev-inactive guards but store full prod trace on failure', () => {
    // In prod, a failing request ends in the store with the full history —
    // exactly the point of the ring buffer.
    const builder = new TraceBuilder(
      'task',
      'create',
      null,
      noopLogger,
      false,
    );
    builder.endStage('db', 'fail', { error: 'duplicate key' });
    builder.finish();

    const stored = traceStore.get(builder.getRequestId());
    expect(stored?.stages.length).toBeGreaterThan(0);
  });

  it('should keep X-Spec-Trace header behavior dev-only via isActive()', () => {
    const prodBuilder = new TraceBuilder(
      'task',
      'list',
      null,
      noopLogger,
      false,
    );
    expect(prodBuilder.isActive()).toBe(false);

    const devBuilder = new TraceBuilder('task', 'list', null, noopLogger, true);
    expect(devBuilder.isActive()).toBe(true);
  });

  it('should adopt the incoming x-request-id header as requestId', () => {
    const builder = new TraceBuilder(
      'task',
      'create',
      null,
      noopLogger,
      false,
      'my-correlation-id-123',
    );
    expect(builder.getRequestId()).toBe('my-correlation-id-123');

    builder.finish();
    expect(traceStore.get('my-correlation-id-123')).toBeDefined();
  });

  it('should fall back to the req_* generator when no header is passed', () => {
    const builder = new TraceBuilder('task', 'list', null, noopLogger, false);
    expect(builder.getRequestId()).toMatch(/^req_/);
  });

  it('should trim whitespace-only header values back to the generator', () => {
    const builder = new TraceBuilder(
      'task',
      'list',
      null,
      noopLogger,
      false,
      '   ',
    );
    expect(builder.getRequestId()).toMatch(/^req_/);
  });
});