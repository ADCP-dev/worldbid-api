import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from metadata
    const roles = this.reflector.getAllAndOverride<(number | string)[]>(
      'roles',
      [context.getClass(), context.getHandler()],
    );

    // If no roles are required, allow access
    if (!roles || !roles.length) {
      return true;
    }

    // Get the request object
    const request = context.switchToHttp().getRequest();

    // Check if user role is in required roles
    const userRoleId = String(request.user?.role?.id);
    const hasRequiredRole = roles.map(String).includes(userRoleId);

    return hasRequiredRole;
  }
}
