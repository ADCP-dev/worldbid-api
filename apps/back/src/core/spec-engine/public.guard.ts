/**
 * PublicGuard — marks a request as unauthenticated-public.
 *
 * Applied by the controller factory when a resource declares
 * `permissions.auth: [public]` AND the specific operation's role list
 * includes `public` (e.g. `list: [public]`).
 *
 * The guard injects a fictitious user `{ id: null, roles: ['public'] }`
 * and sets `request.isPublic = true` so the existing rowLevel evaluator
 * contract (which expects `request.user` to be an object) keeps working
 * without a separate code path. `id: null` fails closed: any
 * `${user.id}` reference in a public rowLevel filter is rejected by the
 * spec validator (PUBLIC_ROWLEVEL_REQUIRES_USER), so null never resolves
 * to a real user row.
 */
import {
  type ExecutionContext,
  Injectable,
  type CanActivate,
} from '@nestjs/common';

@Injectable()
export class PublicGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    request.user = { id: null, roles: ['public'] };
    request.isPublic = true;
    return true;
  }
}
