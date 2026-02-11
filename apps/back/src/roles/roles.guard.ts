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

    // Log the required roles
    console.log(
      `RolesGuard - Required roles: ${JSON.stringify(roles || 'none')}`,
    );

    // If no roles are required, allow access
    if (!roles || !roles.length) {
      console.log('RolesGuard - No roles required, allowing access');
      return true;
    }

    // Get the request object
    const request = context.switchToHttp().getRequest();

    // Log user and role information
    console.log(`RolesGuard - User object exists: ${!!request.user}`);
    console.log(`RolesGuard - User ID: ${request.user?.id || 'unknown'}`);
    console.log(
      `RolesGuard - User role: ${JSON.stringify(request.user?.role || 'none')}`,
    );

    // Check if user role is in required roles
    const userRoleId = String(request.user?.role?.id);
    const hasRequiredRole = roles.map(String).includes(userRoleId);

    console.log(
      `RolesGuard - User role ID: ${userRoleId || 'none'}, Has required role: ${hasRequiredRole}`,
    );

    return hasRequiredRole;
  }
}
