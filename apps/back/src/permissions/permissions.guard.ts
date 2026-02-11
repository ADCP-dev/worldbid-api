import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionEnum } from './permissions.enum';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { OwnershipService } from './ownership.service';

/**
 * Guard that enforces permission-based access control
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private ownershipService: OwnershipService,
  ) {}

  async canActivate(context: ExecutionContext) {
    // Check for required permissions
    const requiredPermissions = this.reflector.getAllAndOverride<
      PermissionEnum[]
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    // Log required permissions for debugging
    console.log(`Required permissions: ${JSON.stringify(requiredPermissions)}`);

    // If no permissions are required, allow access
    if (
      !requiredPermissions ||
      requiredPermissions === null ||
      requiredPermissions.length === 0
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    console.log(`User object: ${JSON.stringify(user || 'none')}`);

    // If no user is authenticated, deny access
    if (!user) {
      return false;
    }

    // Get user's role permissions
    const userPermissions = user.role.permissions;

    // Debug log user permissions
    console.log(`User permissions: ${JSON.stringify(userPermissions)}`);

    // Check each required permission
    for (const permission of requiredPermissions) {
      if (permission.endsWith('::custom')) {
        // Do custom policy
      }
      // For permissions with ":own" suffix, check entity ownership
      else if (permission.endsWith(':own')) {
        // If the user has it without :own, allow access (has administration permissions)
        if (
          this.hasPermission(userPermissions, permission.replace(':own', ''))
        ) {
          return true;
        }

        // The entity name is between the last ":" and the ":own"
        const entityName = permission.split(':')[1];

        // Id of the requested
        const entityId = request.params.id;

        // First check if user has the permission
        if (!this.hasPermission(userPermissions, permission)) {
          return false;
        }

        // Then check ownership
        if (!(await this.checkOwnership(user, entityId, entityName))) {
          return false;
        }
      } else {
        // For regular permissions (not ownership-based)
        if (!this.hasPermission(userPermissions, permission)) {
          return false;
        }
      }
    }

    // All permission checks passed
    return true;
  }

  /**
   * Checks if the user has a specific permission
   */
  private hasPermission(
    userPermissions: string[],
    requiredPermission: string,
  ): boolean {
    return userPermissions.includes(requiredPermission);
  }

  /**
   * Checks if the current user owns the entity being accessed
   */
  private async checkOwnership(
    user: any,
    entityId: string,
    entityName: string,
  ) {
    // No entity provided, can't check ownership
    if (!entityId) {
      return false;
    }

    // Use the ownership checker utility if available
    try {
      return this.ownershipService.isOwner(user, entityName, entityId);
    } catch (err) {
      console.error('Ownership checker error:', err);
      // Fallback if ownership checker not available
      return false;
    }
  }
}
