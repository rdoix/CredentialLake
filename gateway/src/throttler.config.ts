/**
 * Rate Limiting Configuration
 * Protects API endpoints from abuse and DoS attacks
 */

import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    {
      name: 'short',
      ttl: 1000, // 1 second
      limit: 10, // 10 requests per second
    },
    {
      name: 'medium',
      ttl: 60000, // 1 minute
      limit: 100, // 100 requests per minute
    },
    {
      name: 'long',
      ttl: 3600000, // 1 hour
      limit: 1000, // 1000 requests per hour
    },
  ],
  // Skip rate limiting for health checks
  skipIf: (context) => {
    const request = context.switchToHttp().getRequest();
    return request.url === '/api/health';
  },
};