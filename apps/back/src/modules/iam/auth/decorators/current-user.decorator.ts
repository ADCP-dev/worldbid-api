import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AuthenticatedUser = {
  id: number;
  email: string;
  role: any; // Replace with your actual role type
};

/**
 * Get the current authenticated user (from JWT or API Key)
 * Returns null if user is not authenticated (when using OptionalAuth)
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedUser | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user || null;
  },
);

/**
 * Get the current authenticated user (throws error if not authenticated)
 * Use this when authentication is required
 */
export const RequiredUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    if (!request.user) {
      throw new Error('User is required but not authenticated');
    }
    return request.user;
  },
);

/**
 * Get user ID only (convenience decorator)
 */
export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): number | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.id || null;
  },
);
