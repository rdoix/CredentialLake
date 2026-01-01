/**
 * JWT Authentication Guard for Gateway
 * Validates JWT tokens from the Authorization header
 * Integrates with FastAPI backend auth system
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

// Metadata keys for decorators
export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

// Valid roles matching backend
export type UserRole = 'administrator' | 'collector' | 'user';

// Extended Request with user data
export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string; // username
    role: UserRole;
    exp: number;
    iat?: number;
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      // Verify token with backend
      const backendUrl =
        process.env.BACKEND_INTERNAL_URL ??
        process.env.BACKEND_BASE_URL ??
        'http://backend:8000';
      const response = await fetch(`${backendUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new UnauthorizedException('Invalid or expired token');
        }
        if (response.status === 403) {
          throw new ForbiddenException('Account is inactive');
        }
        throw new UnauthorizedException('Authentication failed');
      }

      const userData = await response.json();

      // Attach user data to request
      request.user = {
        sub: userData.username,
        role: userData.role as UserRole,
        exp: 0, // Backend handles expiry
      };

      // Check role-based access
      const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
        ROLES_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (requiredRoles && requiredRoles.length > 0) {
        const hasRole = requiredRoles.includes(request.user.role);
        if (!hasRole) {
          throw new ForbiddenException(
            `Requires one of: ${requiredRoles.join(', ')}`,
          );
        }
      }

      return true;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new UnauthorizedException('Token validation failed');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}