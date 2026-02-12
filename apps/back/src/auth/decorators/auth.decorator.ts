import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import {
  JwtAuthGuard,
  ApiKeyAuthGuard,
  FlexibleAuthGuard,
  OptionalAuthGuard,
} from '../guards';
import { Roles } from '../../roles/roles.decorator';
import { RoleEnum } from '../../roles/roles.enum';
import { RequirePermissions } from '../../permissions/permissions.decorator';
import { PermissionEnum } from '../../permissions/permissions.enum';

/**
 * JWT Authentication Only
 * Requires: Authorization: Bearer <token>
 */
export function JwtAuth() {
  return applyDecorators(UseGuards(JwtAuthGuard), ApiBearerAuth());
}

/**
 * API Key Authentication Only
 * Requires: X-API-Key: <key>
 */
export function ApiKeyAuth() {
  return applyDecorators(UseGuards(ApiKeyAuthGuard), ApiSecurity('api-key'));
}

/**
 * Flexible Authentication (JWT OR API Key)
 * Accepts either: Authorization: Bearer <token> OR X-API-Key: <key>
 */
export function FlexibleAuth() {
  return applyDecorators(
    UseGuards(FlexibleAuthGuard),
    ApiBearerAuth(),
    ApiSecurity('api-key'),
  );
}

/**
 * Optional Authentication (JWT OR API Key OR Anonymous)
 * User can be authenticated or anonymous
 */
export function OptionalAuth() {
  return applyDecorators(
    UseGuards(OptionalAuthGuard),
    ApiBearerAuth(),
    ApiSecurity('api-key'),
  );
}

/**
 * Permission Based Authentication
 * Requires JWT + Permission check
 */
export function PermissionAuthJwt(permissions: PermissionEnum[] = []) {
  return applyDecorators(
    UseGuards(JwtAuthGuard),
    ApiBearerAuth(),
    RequirePermissions(...permissions),
  );
}

/**
 * Permission Based Authentication
 * Requires API Key + Permission check
 */
export function PermissionAuthApiKey(permissions: PermissionEnum[] = []) {
  return applyDecorators(
    UseGuards(ApiKeyAuthGuard),
    ApiSecurity('api-key'),
    RequirePermissions(...permissions),
  );
}

/**
 * Permission Based Authentication
 * Requires Flexible Auth (JWT OR API Key) + Permission check
 */
export function PermissionAuthFlexible(permissions: PermissionEnum[] = []) {
  return applyDecorators(
    UseGuards(FlexibleAuthGuard),
    ApiBearerAuth(),
    ApiSecurity('api-key'),
    RequirePermissions(...permissions),
  );
}

/**
 * Admin Only Authentication (JWT with role check)
 * Requires JWT + Admin role
 */
export function AdminAuth() {
  return applyDecorators(
    UseGuards(JwtAuthGuard),
    ApiBearerAuth(),
    Roles(RoleEnum.admin),
  );
}

/**
 * User Only Authentication (JWT with role check)
 * Requires JWT + User role
 */
export function CustomerAuth() {
  return applyDecorators(
    UseGuards(JwtAuthGuard),
    ApiBearerAuth(),
    Roles(RoleEnum.customer),
  );
}
