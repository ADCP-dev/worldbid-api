import { SetMetadata } from '@nestjs/common';
import { PermissionEnum } from './permissions.enum';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator for requiring specific permissions to access a route
 *
 * @param permissions The permissions needed to access the route
 */
export const RequirePermissions = (...permissions: PermissionEnum[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
