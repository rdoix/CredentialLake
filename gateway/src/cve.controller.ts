/**
 * CVEController
 * Proxies FastAPI CVE endpoints via the gateway.
 * This enables the frontend to call /api/cve/* through the gateway.
 *
 * Backend references:
 * - /api/cve/stats
 * - /api/cve/recent?limit=10
 * - /api/cve/search?keyword=&year=&severity=&min_cvss=&max_cvss=&limit=&offset=
 * - /api/cve/year/{year}?limit=&offset=
 * - /api/cve/severity/{severity}?limit=&offset=
 * - POST /api/cve/sync?days=7
 *
 * SECURITY: All endpoints require authentication via JwtAuthGuard
 */

import { Controller, Get, Query, Headers, Param, Post } from '@nestjs/common';
import { CurrentUser } from './auth.decorators';
import type { UserRole } from './auth.guard';

type AnyJson = Record<string, unknown> | unknown[];

@Controller('cve')
export class CVEController {
  private readonly backendBaseUrl: string =
    process.env.BACKEND_BASE_URL ?? 'http://backend:8000';

  /**
   * GET /api/cve/stats
   * Returns CVE statistics for dashboard.
   */
  @Get('stats')
  async stats(
    @CurrentUser() _user: { sub: string; role: UserRole },
    @Headers('authorization') authorization?: string,
  ): Promise<AnyJson> {
    const url = `${this.backendBaseUrl}/api/cve/stats`;
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
            endpoint: 'GET /api/cve/stats -> FastAPI',
            forwarded_url: url,
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
          },
          null,
          2,
        ),
      );
      throw new Error(`Backend /api/cve/stats error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return data;
  }

  /**
   * GET /api/cve/recent?limit=10
   * Returns recent CVEs.
   */
  @Get('recent')
  async recent(
    @CurrentUser() _user: { sub: string; role: UserRole },
    @Query('limit') limit: string = '10',
    @Headers('authorization') authorization?: string,
  ): Promise<AnyJson> {
    const url = new URL(`${this.backendBaseUrl}/api/cve/recent`);
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
            endpoint: 'GET /api/cve/recent -> FastAPI',
            forwarded_url: url.toString(),
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
          },
          null,
          2,
        ),
      );
      throw new Error(`Backend /api/cve/recent error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return data;
  }

  /**
   * GET /api/cve/search
   * Advanced CVE search with filters.
   * Query params:
   * - keyword, year, severity, min_cvss, max_cvss, limit, offset
   */
  @Get('search')
  async search(
    @CurrentUser() _user: { sub: string; role: UserRole },
    @Query('keyword') keyword?: string,
    @Query('year') year?: string,
    @Query('severity') severity?: string,
    @Query('min_cvss') min_cvss?: string,
    @Query('max_cvss') max_cvss?: string,
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
    @Headers('authorization') authorization?: string,
  ): Promise<AnyJson> {
    const url = new URL(`${this.backendBaseUrl}/api/cve/search`);
    if (keyword) url.searchParams.set('keyword', keyword);
    if (year) url.searchParams.set('year', year);
    if (severity) url.searchParams.set('severity', severity);
    if (min_cvss) url.searchParams.set('min_cvss', min_cvss);
    if (max_cvss) url.searchParams.set('max_cvss', max_cvss);
    url.searchParams.set('limit', limit ?? '50');
    url.searchParams.set('offset', offset ?? '0');

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
            endpoint: 'GET /api/cve/search -> FastAPI',
            forwarded_url: url.toString(),
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
          },
          null,
          2,
        ),
      );
      throw new Error(`Backend /api/cve/search error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return data;
  }

  /**
   * GET /api/cve/year/:year?limit=&offset=
   * Returns CVEs filtered by publication year.
   */
  @Get('year/:year')
  async byYear(
    @CurrentUser() _user: { sub: string; role: UserRole },
    @Param('year') year: string,
    @Query('limit') limit: string = '100',
    @Query('offset') offset: string = '0',
    @Headers('authorization') authorization?: string,
  ): Promise<AnyJson> {
    const url = new URL(`${this.backendBaseUrl}/api/cve/year/${encodeURIComponent(year)}`);
    url.searchParams.set('limit', limit ?? '100');
    url.searchParams.set('offset', offset ?? '0');

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
            endpoint: 'GET /api/cve/year/:year -> FastAPI',
            forwarded_url: url.toString(),
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
          },
          null,
          2,
        ),
      );
      throw new Error(`Backend /api/cve/year/${year} error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return data;
  }

  /**
   * GET /api/cve/severity/:severity?limit=&offset=
   * Returns CVEs filtered by severity.
   */
  @Get('severity/:severity')
  async bySeverity(
    @CurrentUser() _user: { sub: string; role: UserRole },
    @Param('severity') severity: string,
    @Query('limit') limit: string = '100',
    @Query('offset') offset: string = '0',
    @Headers('authorization') authorization?: string,
  ): Promise<AnyJson> {
    const url = new URL(
      `${this.backendBaseUrl}/api/cve/severity/${encodeURIComponent(severity)}`,
    );
    url.searchParams.set('limit', limit ?? '100');
    url.searchParams.set('offset', offset ?? '0');

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
            endpoint: 'GET /api/cve/severity/:severity -> FastAPI',
            forwarded_url: url.toString(),
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
          },
          null,
          2,
        ),
      );
      throw new Error(
        `Backend /api/cve/severity/${severity} error: ${res.status} ${res.statusText}`,
      );
    }
    const data = await res.json();
    return data;
  }

  /**
   * POST /api/cve/sync?days=7
   * Triggers a CVE sync from NVD API on the backend.
   */
  @Post('sync')
  async sync(
    @CurrentUser() _user: { sub: string; role: UserRole },
    @Query('days') days: string = '7',
    @Headers('authorization') authorization?: string,
  ): Promise<AnyJson> {
    const url = new URL(`${this.backendBaseUrl}/api/cve/sync`);
    url.searchParams.set('days', days ?? '7');

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
    });
    if (!res.ok) {
      const payload = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            endpoint: 'POST /api/cve/sync -> FastAPI',
            forwarded_url: url.toString(),
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
            backend_body: payload.slice(0, 1000),
          },
          null,
          2,
        ),
      );
      throw new Error(`Backend /api/cve/sync error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json().catch(() => ({}));
    return data;
  }
}