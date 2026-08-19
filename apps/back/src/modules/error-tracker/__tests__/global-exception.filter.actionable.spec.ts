/**
 * GlobalExceptionFilter — ActionableError shaping (PRD 01)
 *
 * Verifies the filter detects spec-engine errors (HookAbortError + errors
 * carrying a `specError` marker) and emits an `{ error: ActionableError }`
 * body with id, category, suggestedFix and requestId, while preserving
 * the existing statusCode/message/timestamp shape for non-spec errors.
 */
import { GlobalExceptionFilter } from '@src/modules/error-tracker/filters/global-exception.filter';
import { HookAbortError } from '@src/core/spec-engine/spec.types';

// Minimal mock of the ArgumentsHost + ErrorTrackerService. The filter
// calls `response.status(code).json(body)`, so the mock response needs
// chainable status() + json() that capture the final body.
function makeHost() {
  const captured: { statusCode?: number; body?: Record<string, unknown> } = {};
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
    body: {},
    query: {},
    ip: '127.0.0.1',
    headers: {},
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

function makeFilter() {
  const logError = jest.fn().mockResolvedValue(undefined);
  const service = { logError } as unknown as { logError: typeof logError };
  return { filter: new GlobalExceptionFilter(service as any), service };
}

describe('GlobalExceptionFilter — ActionableError shaping', () => {
  it('preserves statusCode/message/timestamp for non-spec errors (no error key)', () => {
    const { filter } = makeFilter();
    const { host, captured } = makeHost();
    // Plain Error is NOT a spec-engine error and NOT an HttpException, so
    // the filter routes it through the 500 path with the traditional body.
    const err = new Error('something broke');

    filter.catch(err, host as any);

    expect(captured.statusCode).toBe(500);
    expect(captured.body?.statusCode).toBe(500);
    expect(captured.body?.message).toBe('Internal Server Error');
    // Non-spec errors do NOT get an `error` ActionableError field.
    expect(captured.body?.error).toBeUndefined();
  });

  it('emits { error: ActionableError } for HookAbortError', () => {
    const { filter } = makeFilter();
    const { host, captured } = makeHost();
    const err = new HookAbortError('hook aborted the create', 400);

    filter.catch(err, host as any);

    expect(captured.statusCode).toBe(400);
    const body = captured.body as Record<string, unknown>;
    const actionable = body.error as Record<string, unknown>;
    expect(actionable).toBeDefined();
    expect(actionable.id).toBeTruthy();
    expect(actionable.category).toBe('hook_failure');
    expect(actionable.requestId).toBeTruthy();
    expect(typeof actionable.suggestedFix).toBe('object');
  });

  it('emits { error: ActionableError } for errors carrying specError marker', () => {
    const { filter } = makeFilter();
    const { host, captured } = makeHost();
    const err: any = new Error('spec yaml invalid');
    (err as any).specError = true;

    filter.catch(err, host as any);

    const body = captured.body as Record<string, unknown>;
    const actionable = body.error as Record<string, unknown>;
    expect(actionable).toBeDefined();
    expect(actionable.category).toBeDefined();
    expect(actionable.message).toBe('spec yaml invalid');
  });

  it('preserves existing response shape fields alongside the new error key', () => {
    const { filter } = makeFilter();
    const { host, captured } = makeHost();
    const err = new HookAbortError('abort', 400);

    filter.catch(err, host as any);

    const body = captured.body as Record<string, unknown>;
    expect(body.statusCode).toBe(400);
    expect(body.timestamp).toBeTruthy();
    expect(body.error).toBeDefined();
  });
});