/**
 * ResultsController
 * Proxies FastAPI credential/results endpoints for filters, pagination, and job association.
 * Backend references:
 * - [results.list_credentials()](backend/routes/results.py:24)
 * - [results.list_job_credentials()](backend/routes/results.py:73)
 *
 * SECURITY: All endpoints require authentication via JwtAuthGuard
 */

import { Controller, Get, Param, Query, Headers } from '@nestjs/common';
import { CurrentUser } from './auth.decorators';
import type { UserRole } from './auth.guard';

// Minimal response shapes aligned with FastAPI responses
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// We do not enforce a strict shape for CredentialResponse to avoid mismatch;
// the gateway acts as a proxy and returns the backend payload verbatim.
type CredentialResponse = Record<string, unknown>;

@Controller('results')
export class ResultsController {
  private readonly backendBaseUrl: string =
    process.env.BACKEND_BASE_URL ?? 'http://localhost:8000';

  /**
   * Proxy to FastAPI [results.list_credentials()](backend/routes/results.py:24)
   * Supports filters and pagination:
   * - domain: string
   * - admin_only: boolean
   * - search: string
   * - from_date: ISO date string
   * - to_date: ISO date string
   * - page: number
   * - page_size: number
   */
  @Get()
  async listCredentials(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Query('domain') domain?: string,
    @Query('admin_only') admin_only?: string, // boolean as string from query
    @Query('search') search?: string,
    @Query('from_date') from_date?: string,
    @Query('to_date') to_date?: string,
    @Query('page') page: string = '1',
    @Query('page_size') page_size: string = '50',
    @Headers('authorization') authorization?: string,
  ): Promise<PaginatedResponse<CredentialResponse>> {
    const url = new URL(`${this.backendBaseUrl}/api/results/`);
    if (domain) url.searchParams.set('domain', domain);
    if (admin_only !== undefined) url.searchParams.set('admin_only', admin_only);
    if (search) url.searchParams.set('search', search);
    if (from_date) url.searchParams.set('from_date', from_date);
    if (to_date) url.searchParams.set('to_date', to_date);
    url.searchParams.set('page', page ?? '1');
    url.searchParams.set('page_size', page_size ?? '50');

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
            endpoint: 'GET /api/results -> FastAPI',
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
        `Backend /api/results error: ${res.status} ${res.statusText}`,
      );
    }
    const data = (await res.json()) as PaginatedResponse<CredentialResponse>;
    return data;
  }

  /**
   * Proxy to FastAPI [results.list_job_credentials()](backend/routes/results.py:73)
   * Supports pagination and admin_only filter:
   * - page: number
   * - page_size: number
   * - admin_only: boolean
   */
  @Get('job/:jobId')
  async listJobCredentials(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('jobId') jobId: string,
    @Query('page') page: string = '1',
    @Query('page_size') page_size: string = '50',
    @Query('admin_only') admin_only?: string, // boolean as string
    @Headers('authorization') authorization?: string,
  ): Promise<PaginatedResponse<CredentialResponse>> {
    const url = new URL(`${this.backendBaseUrl}/api/results/job/${jobId}`);
    url.searchParams.set('page', page ?? '1');
    url.searchParams.set('page_size', page_size ?? '50');
    if (admin_only !== undefined) url.searchParams.set('admin_only', admin_only);

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
            endpoint: 'GET /api/results/job/:jobId -> FastAPI',
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
        `Backend /api/results/job/${jobId} error: ${res.status} ${res.statusText}`,
      );
    }
    const data = (await res.json()) as PaginatedResponse<CredentialResponse>;
    return data;
  }
}