/**
 * DenyAllGuard — unit tests.
 *
 * The guard must throw a ForbiddenException whose message names the
 * resource and operation read from `spec:resource` / `spec:operation`
 * route metadata. When the metadata is absent (defensive), it falls
 * back to "unknown".
 */
import { ForbiddenException } from '@nestjs/common';
import { DenyAllGuard } from '@src/core/spec-engine/deny-all.guard';

function makeContext(meta: Record<string, unknown> = {}) {
  const handler = function dummyHandler() {};
  for (const [k, v] of Object.entries(meta)) {
    Reflect.defineMetadata(k, v, handler);
  }
  return {
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => ({}) }),
  } as any;
}

describe('DenyAllGuard', () => {
  it('throws ForbiddenException naming the resource and operation', () => {
    const guard = new DenyAllGuard();
    const ctx = makeContext({
      'spec:resource': 'invoice',
      'spec:operation': 'delete',
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    try {
      guard.canActivate(ctx);
    } catch (e) {
      const msg = (e as ForbiddenException).message;
      expect(msg).toContain('delete');
      expect(msg).toContain('invoice');
      expect(msg).toContain('disabled');
    }
  });

  it('falls back to "unknown" when metadata is absent', () => {
    const guard = new DenyAllGuard();
    const ctx = makeContext();

    try {
      guard.canActivate(ctx);
      throw new Error('should have thrown');
    } catch (e) {
      const msg = (e as ForbiddenException).message;
      expect(msg).toContain('"unknown"');
    }
  });
});