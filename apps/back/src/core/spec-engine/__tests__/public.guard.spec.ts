/**
 * PublicGuard — unit tests.
 *
 * The guard must inject a fictitious user `{ id: null, roles: ['public'] }`
 * and set `request.isPublic = true`, then allow the request through.
 */
import { PublicGuard } from '@src/core/spec-engine/public.guard';

function makeContext() {
  const request: Record<string, unknown> = {};
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    _request: request,
  } as any;
}

describe('PublicGuard', () => {
  it('sets request.user to a fictitious public user with null id', () => {
    const guard = new PublicGuard();
    const ctx = makeContext();
    const request = (ctx as any)._request;

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.user).toEqual({ id: null, roles: ['public'] });
  });

  it('sets request.isPublic to true', () => {
    const guard = new PublicGuard();
    const ctx = makeContext();
    const request = (ctx as any)._request;

    guard.canActivate(ctx);

    expect(request.isPublic).toBe(true);
  });
});