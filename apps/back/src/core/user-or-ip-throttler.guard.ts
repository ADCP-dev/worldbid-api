import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * UserOrIpThrottlerGuard — same shape as the default ThrottlerGuard
 * but keys on user.id when the request is authenticated, falling back
 * to the remote IP for anonymous traffic.
 *
 * Why: SPA-style clients issue hundreds of requests per minute per
 * logged-in user. IP-based throttling punishes users behind a shared
 * NAT (offices, mobile carriers) and throttles well-behaved power
 * users. For an API consumed by a small number of users doing many
 * requests, per-user accounting is the right default.
 *
 * Set APP_RATELIMIT_DISABLED=true in the environment to opt out
 * (useful for integration tests).
 */
@Injectable()
export class UserOrIpThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    if (process.env.APP_RATELIMIT_DISABLED === 'true') {
      // Return a constant so all requests share the same bucket and
      // exceed the limit in one go, effectively disabling the guard.
      return Promise.resolve('disabled');
    }
    const user = req.user as { id?: string | number } | undefined;
    if (user?.id !== undefined && user.id !== null) {
      return Promise.resolve(`user:${user.id}`);
    }
    const ip =
      (req.ip as string | undefined) ??
      ((req.headers as Record<string, string> | undefined)?.['x-forwarded-for']
        ?.split(',')[0]
        ?.trim() as string | undefined) ??
      'unknown';
    return Promise.resolve(`ip:${ip}`);
  }
}
