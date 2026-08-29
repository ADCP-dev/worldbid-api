/**
 * spec-trace-test CLI — pure parts.
 *
 * Covers arg parsing, X-Spec-Trace header decoding, stage-table
 * formatting, header↔store comparison and op path building. Network
 * calls (auth/op/trace fetch) are intentionally excluded.
 */
import { describe, expect, it } from 'vitest';

import {
  parseArgs,
  decodeSpecTraceHeader,
  formatStageTable,
  storeMatchesHeader,
  buildOpPath,
} from '@src/core/spec-engine/spec-trace-test';
import type { TraceTestArgs } from '@src/core/spec-engine/spec-trace-test';

function baseArgs(extra: string[] = []): string[] {
  return ['--resource', 'task', ...extra];
}

describe('spec-trace-test — parseArgs', () => {
  it('should parse defaults with only --resource', () => {
    const parsed = parseArgs(baseArgs(['--op', 'list']));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.args).toMatchObject({
        host: 'http://localhost:3010',
        resource: 'task',
        op: 'list',
        expect: 'success',
      });
    }
  });

  it('should reject an invalid --op', () => {
    const parsed = parseArgs(baseArgs(['--op', 'explode']));
    expect(parsed.ok).toBe(false);
  });

  it('should reject --expect other than success|error', () => {
    const parsed = parseArgs(baseArgs(['--expect', 'maybe']));
    expect(parsed.ok).toBe(false);
  });

  it('should require --resource', () => {
    const parsed = parseArgs([]);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.usage).toContain('--resource');
  });

  it('should require --id for update and delete', () => {
    expect(parseArgs(['--resource', 'task', '--op', 'update']).ok).toBe(false);
    expect(
      parseArgs(['--resource', 'task', '--op', 'delete', '--id', '7']).ok,
    ).toBe(true);
  });

  it('should require --body for create and update', () => {
    expect(parseArgs(['--resource', 'task', '--op', 'create']).ok).toBe(false);
    expect(
      parseArgs([
        '--resource',
        'task',
        '--op',
        'create',
        '--body',
        '{"title":"x"}',
      ]).ok,
    ).toBe(true);
    expect(parseArgs(['--resource', 'task', '--op', 'update', '--id', '1']).ok).toBe(
      false,
    );
  });

  it('should reject invalid --body JSON and non-object bodies', () => {
    expect(
      parseArgs(baseArgs(['--op', 'create', '--body', '{broken'])).ok,
    ).toBe(false);
    expect(
      parseArgs(baseArgs(['--op', 'create', '--body', '"just a string"'])).ok,
    ).toBe(false);
  });

  it('should parse --host, --token, --login/--password and --expect', () => {
    const parsed = parseArgs([
      '--host',
      'http://api.local:4000/',
      '--resource',
      'task',
      '--op',
      'list',
      '--token',
      'jwt-abc',
      '--expect',
      'error',
    ]);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.args.host).toBe('http://api.local:4000');
      expect(parsed.args.token).toBe('jwt-abc');
      expect(parsed.args.expect).toBe('error');
    }
  });

  it('should types-check op parsing across allowed values', () => {
    const ops: TraceTestArgs['op'][] = ['create', 'update', 'delete', 'list'];
    for (const op of ops) {
      const parsed = parseArgs([
        '--resource',
        'task',
        '--op',
        op,
        '--id',
        '1',
        '--body',
        '{"a":1}',
      ]);
      expect(parsed.ok).toBe(true);
    }
  });
});

describe('spec-trace-test — decodeSpecTraceHeader', () => {
  it('should round-trip a base64-encoded trace JSON', () => {
    const original = {
      requestId: 'req_abc',
      resource: 'task',
      operation: 'create',
      stages: [{ stage: 'auth', status: 'pass', durationMs: 1 }],
      totalDurationMs: 9,
    };
    const encoded = Buffer.from(JSON.stringify(original)).toString('base64');
    const decoded = decodeSpecTraceHeader(encoded);
    expect(decoded?.requestId).toBe('req_abc');
    expect(decoded?.stages).toHaveLength(1);
  });

  it('should return null for missing, garbage or wrong-shape payloads', () => {
    expect(decodeSpecTraceHeader(undefined)).toBeNull();
    expect(decodeSpecTraceHeader('!!!!not-base64-json')).toBeNull();
    const notATrace = Buffer.from(JSON.stringify({ hello: 1 })).toString(
      'base64',
    );
    expect(decodeSpecTraceHeader(notATrace)).toBeNull();
  });
});

describe('spec-trace-test — formatStageTable', () => {
  it('should render one line per stage plus a header row', () => {
    const table = formatStageTable([
      {
        stage: 'auth',
        status: 'pass',
        durationMs: 3,
        error: undefined,
      },
      {
        stage: 'db',
        status: 'fail',
        durationMs: 12,
        error: { message: 'dup key', code: 'DB_ERROR' },
      },
    ]);
    const lines = table.split('\n');
    // Header + separator + 2 stage rows + 1 error detail line.
    expect(lines).toHaveLength(5);
    expect(lines[2]).toContain('auth');
    expect(lines[2]).toContain('3ms');
    expect(lines[3]).toContain('db');
    expect(lines[3]).toContain('12ms');
    expect(lines[4]).toContain('DB_ERROR');
    expect(lines[4]).toContain('dup key');
  });

  it('should still render for an empty stage list', () => {
    const table = formatStageTable([]);
    const lines = table.split('\n');
    expect(lines).toHaveLength(2);
  });
});

describe('spec-trace-test — storeMatchesHeader', () => {
  const makeTrace = (requestId: string, stages: string[]) => ({
    requestId,
    resource: 'task',
    operation: 'create',
    stages: stages.map((s) => ({ stage: s, status: 'pass', durationMs: 1 })),
    totalDurationMs: 5,
  });

  it('should match when requestId and stage names agree', () => {
    const header = makeTrace('r1', ['auth', 'db']);
    const store = makeTrace('r1', ['auth', 'db']);
    expect(storeMatchesHeader(header, store)).toEqual({
      match: true,
      reasons: [],
    });
  });

  it('should report requestId mismatches', () => {
    const result = storeMatchesHeader(
      makeTrace('a', ['auth']),
      makeTrace('b', ['auth']),
    );
    expect(result.match).toBe(false);
    expect(result.reasons[0]).toContain('requestId mismatch');
  });

  it('should report stage-name differences', () => {
    const result = storeMatchesHeader(
      makeTrace('r', ['auth', 'db', 'response']),
      makeTrace('r', ['auth', 'db']),
    );
    expect(result.match).toBe(false);
    expect(result.reasons[0]).toContain('stage names differ');
  });
});

describe('spec-trace-test — buildOpPath', () => {
  const base: TraceTestArgs = {
    host: 'http://localhost:3010',
    resource: 'task',
    op: 'list',
    expect: 'success',
  };

  it('should build list + create paths against the pluralized resource', () => {
    expect(buildOpPath({ ...base, op: 'list' })).toBe('/api/v1/tasks');
    expect(buildOpPath({ ...base, op: 'create' })).toBe('/api/v1/tasks');
  });

  it('should build update/delete paths with the id segment', () => {
    expect(
      buildOpPath({ ...base, op: 'update', id: '42' }),
    ).toBe('/api/v1/tasks/42');
    expect(
      buildOpPath({ ...base, op: 'delete', id: '42' }),
    ).toBe('/api/v1/tasks/42');
  });

  it('should pluralize like ControllerFactory (activity → activities)', () => {
    expect(buildOpPath({ ...base, resource: 'activity', op: 'list' })).toBe(
      '/api/v1/activities',
    );
  });
});