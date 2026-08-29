/**
 * Meta controller — GET /_spec/trace/:requestId backed by the real store.
 *
 * Verifies the endpoint reads from the module singleton traceStore:
 *  - known requestId  → { found: true, trace }
 *  - unknown id       → { found: false, message }
 *  - TraceBuilder finish() results are retrievable through the controller.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { Logger } from '@nestjs/common';

import { SpecMetaController } from '@src/core/spec-engine/meta-controller';
import { resetTraceStoreForTest } from '@src/core/spec-engine/trace-store';
import { TraceBuilder } from '@src/core/spec-engine/spec-trace';

const noopLogger = new Logger('MetaTraceSpec');

function makeController(): SpecMetaController {
  // loadedSpecs is only used by the resources endpoints — safe to pass [].
  return new SpecMetaController([]);
}

describe('SpecMetaController — getTrace (real trace store)', () => {
  beforeEach(() => {
    resetTraceStoreForTest();
  });

  it('should return found:false with a helpful message for unknown ids', () => {
    const res = makeController().getTrace('nope');
    expect(res.found).toBe(false);
    expect(res).toMatchObject({ requestId: 'nope' });
  });

  it('should return the stored trace for a finished TraceBuilder run', () => {
    const builder = new TraceBuilder(
      'task',
      'create',
      null,
      noopLogger,
      true,
      'meta-ctl-test-1',
    );
    builder.startStage('auth');
    builder.endStage('auth', 'pass', { guard: 'jwt' });
    builder.finish();

    const res = makeController().getTrace('meta-ctl-test-1');
    expect(res.found).toBe(true);
    if (res.found) {
      expect(res.trace.requestId).toBe('meta-ctl-test-1');
      expect(res.trace.stages.map((s) => s.stage)).toEqual(['auth']);
    }
  });
});