/**
 * DenyAllGuard — blocks every request to the decorated route.
 *
 * Used by the controller factory when a resource declares an empty
 * permissions array (`delete: []`) for an operation: nobody can access.
 * The thrown ForbiddenException carries the resource and operation names
 * read from `spec:resource` / `spec:operation` route metadata so the error
 * is self-describing for agents and humans.
 */
import {
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  type CanActivate,
} from '@nestjs/common';

@Injectable()
export class DenyAllGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const resourceName =
      (Reflect.getMetadata('spec:resource', handler) as string | undefined) ||
      'unknown';
    const operation =
      (Reflect.getMetadata('spec:operation', handler) as
        | string
        | undefined) || 'unknown';
    throw new ForbiddenException(
      `Operation "${operation}" on resource "${resourceName}" is disabled ` +
        '(empty permissions array in spec).',
    );
  }
}