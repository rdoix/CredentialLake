/**
 * DashboardController
 * Proxies FastAPI dashboard analytics endpoints via the gateway.
 * This enables the frontend to call /api/dashboard/* through the gateway.
 *
 * Backend references:
 * - /api/dashboard/stats
 * - /api/dashboard/top-domains?limit=10
 * - /api/dashboard/timeline?days=30
 * - /api/dashboard/top-passwords?limit=10
 *
 * SECURITY: All endpoints require authentication via JwtAuthGuard
 */

import { Controller, Get, Query, Headers, Param } from '@nestjs/common';
import { CurrentUser } from './auth.decorators';
import type { UserRole } from './auth.guard';

type AnyJson = Record<string, unknown> | unknown[];

@Controller('dashboard')
export class DashboardController {
  private readonly backendBaseUrl: string =
    process.env.BACKEND_BASE_URL ?? 'http://backend:8000';

  /**
   * GET /api/dashboard/stats
   * Returns aggregate counts for credentials, admin accounts, and unique domains.
   */
  @Get('stats')
  async stats(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Headers('authorization') authorization?: string,
  ): Promise<AnyJson> {
    const url = `${this.backendBaseUrl}/api/dashboard/stats`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            endpoint: 'GET /api/dashboard/stats -> FastAPI',
            forwarded_url: url,
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
          },
          null,
          2,
        ),
      );
      throw new Error(`Backend /api/dashboard/stats error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return data;
  }

  /**
   * GET /api/dashboard/top-domains?limit=10
   * Returns top domains with credential counts and admin counts.
   */
  @Get('top-domains')
  async topDomains(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Query('limit') limit: string = '10',
    @Headers('authorization') authorization?: string,
  ): Promise<AnyJson> {
    const url = new URL(`${this.backendBaseUrl}/api/dashboard/top-domains`);
    url.searchParams.set('limit', limit ?? '10');

    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            endpoint: 'GET /api/dashboard/top-domains -> FastAPI',
            forwarded_url: url.toString(),
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
          },
          null,
          2,
        ),
      );
      throw new Error(`Backend /api/dashboard/top-domains error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return data;
  }

  /**
   * GET /api/dashboard/timeline?days=30
   * Returns timeline data points (date, count).
   */
  @Get('timeline')
  async timeline(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Query('days') days: string = '30',
    @Headers('authorization') authorization?: string,
  ): Promise<AnyJson> {
    const url = new URL(`${this.backendBaseUrl}/api/dashboard/timeline`);
    url.searchParams.set('days', days ?? '30');

    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            endpoint: 'GET /api/dashboard/timeline -> FastAPI',
            forwarded_url: url.toString(),
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
          },
          null,
          2,
        ),
      );
      throw new Error(`Backend /api/dashboard/timeline error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return data;
  }

  /**
   * GET /api/dashboard/top-passwords?limit=10
   * Returns top passwords by frequency.
   */
  @Get('top-passwords')
  async topPasswords(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Query('limit') limit: string = '10',
    @Headers('authorization') authorization?: string,
  ): Promise<AnyJson> {
    const url = new URL(`${this.backendBaseUrl}/api/dashboard/top-passwords`);
    url.searchParams.set('limit', limit ?? '10');

    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            endpoint: 'GET /api/dashboard/top-passwords -> FastAPI',
            forwarded_url: url.toString(),
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
          },
          null,
          2,
        ),
      );
      throw new Error(`Backend /api/dashboard/top-passwords error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return data;
  }

  /**
   * GET /api/dashboard/domain/:domain
   * Returns normalized domain details (root-domain aggregation).
   */
  @Get('domain/:domain')
  async domainDetails(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('domain') domain: string,
    @Headers('authorization') authorization?: string,
  ): Promise<AnyJson> {
    const url = `${this.backendBaseUrl}/api/dashboard/domain/${encodeURIComponent(domain)}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            endpoint: 'GET /api/dashboard/domain/:domain -> FastAPI',
            forwarded_url: url,
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
          },
          null,
          2,
        ),
      );
      throw new Error(`Backend /api/dashboard/domain error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return data;
  }
}