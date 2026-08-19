/**
 * SpecErrorReporter — ActionableError + heuristics (PRD 01)
 *
 * Tests the actionable-error enrichment pipeline:
 *   - buildActionableError populates all ActionableError fields
 *   - inferSuggestedFix for the 5 common patterns (null access Node 18+ and
 *     <18, FK violation, permission denied, hook crash generic, no match)
 *   - scrubSensitive strips password/file keys and truncates large payloads
 *   - shouldTrackAsError skips permission_denied and client validation
 */
import {
  scrubSensitive,
  shouldTrackAsError,
  inferSuggestedFix,
  buildActionableError,
} from '@src/core/spec-engine/spec-error-reporter';
import type {
  SpecError,
  SpecTrace,
} from '@src/core/spec-engine/spec.types';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const baseTrace = (overrides: Partial<SpecTrace> = {}): SpecTrace => ({
  requestId: 'req_abc123',
  resource: 'task',
  operation: 'create',
  user: { id: 1, role: 'admin' },
  stages: [],
  totalDurationMs: 12,
  // ─── extended fields (PRD 01) ───
  extension: 'tasks',
  specFile: 'extensions/tasks/task.spec.yaml',
  layer: 'hook_executor',
  step: 'executing beforeCreate hook',
  input: {},
  userId: 1,
  userRole: 'admin',
  handlerFile: 'extensions/tasks/hooks/task-before-create.ts',
  handlerFunction: 'default',
  ...overrides,
} as SpecTrace);

const baseError = (overrides: Partial<SpecError> = {}): SpecError => ({
  message: 'Hook task-before-create failed',
  source: 'spec-engine/hook',
  stack: 'TypeError: ...',
  hash: 'abc123hash',
  occurrences: 1,
  ...overrides,
});

// ─── buildActionableError ───────────────────────────────────────────────────

describe('buildActionableError', () => {
  it('populates identification + taxonomy + localization fields', () => {
    const err = baseError();
    const trace = baseTrace();
    const actionable = buildActionableError(err, trace);

    expect(actionable.id).toBeTruthy();
    expect(actionable.hash).toBe('abc123hash');
    expect(actionable.timestamp).toBeTruthy();
    expect(actionable.category).toBeDefined();
    expect(actionable.severity).toBeDefined();
    expect(actionable.extension).toBe('tasks');
    expect(actionable.resource).toBe('task');
    expect(actionable.specFile).toBe('extensions/tasks/task.spec.yaml');
    expect(actionable.operation).toBe('create');
    expect(actionable.requestId).toBe('req_abc123');
    expect(actionable.userId).toBe(1);
  });

  it('populates diagnosis fields from error + trace', () => {
    const err = baseError({
      message: 'Hook crashed',
      stack: 'Error\n  at foo.ts:10',
    });
    const trace = baseTrace();

    const actionable = buildActionableError(err, trace);

    expect(actionable.message).toBe('Hook crashed');
    expect(actionable.stack).toBe('Error\n  at foo.ts:10');
    expect(actionable.handlerFile).toBe(
      'extensions/tasks/hooks/task-before-create.ts',
    );
    expect(actionable.handlerFunction).toBe('default');
    expect(actionable.failurePoint.layer).toBe('hook_executor');
    expect(actionable.failurePoint.step).toBe('executing beforeCreate hook');
  });

  it('scrubs sensitive data in input before populating', () => {
    const err = baseError();
    const trace = baseTrace({
      input: { password: 'secret123', title: 'Buy milk' },
    });

    const actionable = buildActionableError(err, trace);

    expect((actionable.input as Record<string, unknown>).password).not.toBe(
      'secret123',
    );
    expect((actionable.input as Record<string, unknown>).title).toBe(
      'Buy milk',
    );
  });
});

// ─── inferSuggestedFix ──────────────────────────────────────────────────────

describe('inferSuggestedFix', () => {
  it('null access (Node 18+): "Cannot read properties of undefined (reading X)" → spec_fix', () => {
    const err = baseError({
      message: "Cannot read properties of undefined (reading 'assigneeId')",
    });
    const trace = baseTrace();

    const fix = inferSuggestedFix(err, trace);

    expect(fix).not.toBeNull();
    expect(fix?.type).toBe('spec_fix');
    expect(fix?.targetField).toBe('assigneeId');
    expect(fix?.targetSpec).toBe('extensions/tasks/task.spec.yaml');
    expect(fix?.confidence).toBe('medium');
  });

  it('null access (Node <18): "Cannot read property X of undefined" → spec_fix', () => {
    const err = baseError({
      message: "Cannot read property 'assigneeId' of undefined",
    });
    const trace = baseTrace();

    const fix = inferSuggestedFix(err, trace);

    expect(fix).not.toBeNull();
    expect(fix?.targetField).toBe('assigneeId');
    expect(fix?.type).toBe('spec_fix');
  });

  it('FK violation: "violates foreign key constraint" → data_fix', () => {
    const err = baseError({
      message: 'insert or update on table "ext_tasks_task" violates foreign key constraint "fk_assignee"',
    });
    const trace = baseTrace({ layer: 'controller_factory' } as Partial<SpecTrace>);

    const fix = inferSuggestedFix(err, trace);

    expect(fix).not.toBeNull();
    expect(fix?.type).toBe('data_fix');
    expect(fix?.confidence).toBe('high');
  });

  it('permission denied (layer=permission_guard) → spec_fix with role+op', () => {
    const err = baseError({
      message: 'permission denied for operation create on task',
    });
    const trace = baseTrace({
      layer: 'permission_guard',
      userRole: 'user',
      operation: 'create',
      resource: 'task',
    } as Partial<SpecTrace>);

    const fix = inferSuggestedFix(err, trace);

    expect(fix).not.toBeNull();
    expect(fix?.type).toBe('spec_fix');
    expect(fix?.description).toContain('user');
    expect(fix?.description).toContain('create');
    expect(fix?.description).toContain('task');
    expect(fix?.confidence).toBe('high');
  });

  it('hook crash generic (layer=hook_executor) → code_fix with handlerFile', () => {
    const err = baseError({ message: 'unexpected NUL byte in input' });
    const trace = baseTrace({ layer: 'hook_executor' } as Partial<SpecTrace>);

    const fix = inferSuggestedFix(err, trace);

    expect(fix).not.toBeNull();
    expect(fix?.type).toBe('code_fix');
    expect(fix?.targetFile).toBe(
      'extensions/tasks/hooks/task-before-create.ts',
    );
    expect(fix?.confidence).toBe('low');
  });

  it('no match → null', () => {
    const err = baseError({ message: 'something completely unknown happened' });
    const trace = baseTrace({ layer: 'spec_loader' } as Partial<SpecTrace>);

    const fix = inferSuggestedFix(err, trace);

    expect(fix).toBeNull();
  });

  it('EntityMetadataNotFoundError → migration fix', () => {
    const err = baseError({
      message: 'EntityMetadataNotFoundError: No metadata for "ext_tasks_task" was found.',
    });
    const trace = baseTrace({ layer: 'spec_engine_boot' } as Partial<SpecTrace>);

    const fix = inferSuggestedFix(err, trace);

    expect(fix).not.toBeNull();
    expect(fix?.type).toBe('config_fix');
    expect(fix?.description).toContain('migration');
    expect(fix?.confidence).toBe('high');
  });
});

// ─── scrubSensitive ─────────────────────────────────────────────────────────

describe('scrubSensitive', () => {
  it('redacts password and token keys', () => {
    const result = scrubSensitive({
      password: 'secret',
      title: 'Buy milk',
      apiToken: 'tkn_abc',
    });

    expect((result as Record<string, unknown>).password).toBe('[redacted]');
    expect((result as Record<string, unknown>).apiToken).toBe('[redacted]');
    expect((result as Record<string, unknown>).title).toBe('Buy milk');
  });

  it('truncates payloads larger than 10KB', () => {
    const big = 'x'.repeat(20 * 1024);
    const result = scrubSensitive({ blob: big });

    const out = (result as Record<string, unknown>).blob as string;
    expect(out.length).toBeLessThan(11 * 1024);
    expect(out).toContain('[truncated]');
  });

  it('passes through small payloads unchanged', () => {
    const result = scrubSensitive({ a: 1, b: 'ok' });
    expect(result).toEqual({ a: 1, b: 'ok' });
  });

  it('redacts nested sensitive keys', () => {
    const result = scrubSensitive({
      user: { name: 'John', password: 'p@ss' },
    });

    const user = (result as Record<string, unknown>).user as Record<
      string,
      unknown
    >;
    expect(user.password).toBe('[redacted]');
    expect(user.name).toBe('John');
  });
});

// ─── shouldTrackAsError ─────────────────────────────────────────────────────

describe('shouldTrackAsError', () => {
  it('returns false for permission_guard layer (expected behavior, not a bug)', () => {
    const err = baseError();
    const trace = baseTrace({ layer: 'permission_guard' } as Partial<SpecTrace>);

    expect(shouldTrackAsError(err, trace)).toBe(false);
  });

  it('returns false for client validation errors in validation_factory', () => {
    const err = baseError({ message: 'field title is required' });
    const trace = baseTrace({
      layer: 'validation_factory',
    } as Partial<SpecTrace>);

    expect(shouldTrackAsError(err, trace)).toBe(false);
  });

  it('returns true for hook_executor failures (real bugs)', () => {
    const err = baseError({ message: 'hook exploded' });
    const trace = baseTrace({ layer: 'hook_executor' } as Partial<SpecTrace>);

    expect(shouldTrackAsError(err, trace)).toBe(true);
  });

  it('returns true for database failures (real bugs)', () => {
    const err = baseError({ message: 'connection refused' });
    const trace = baseTrace({
      layer: 'controller_factory',
    } as Partial<SpecTrace>);

    expect(shouldTrackAsError(err, trace)).toBe(true);
  });

  it('returns true for validation_factory when the error is NOT client input (server-side validation bug)', () => {
    const err = baseError({ message: 'internal schema mismatch' });
    const trace = baseTrace({
      layer: 'validation_factory',
    } as Partial<SpecTrace>);

    expect(shouldTrackAsError(err, trace)).toBe(true);
  });
});