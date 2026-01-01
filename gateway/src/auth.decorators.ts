/**
 * Authentication Decorators for Gateway Controllers
 * Provides @Public(), @Roles(), and @CurrentUser() decorators
 */

import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { IS_PUBLIC_KEY, ROLES_KEY, type UserRole, type AuthenticatedRequest } from './auth.guard';

/**
 * Mark a route as public (no authentication required)
 * Usage: @Public()
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Require specific roles for a route
 * Usage: @Roles('administrator', 'collector')
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Get current authenticated user from request
 * Usage: @CurrentUser() user: { sub: string; role: UserRole }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);