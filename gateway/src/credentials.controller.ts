/**
 * CredentialsController
 * Proxies FastAPI credentials endpoints via the gateway.
 * This enables the frontend to call /api/credentials/* through the gateway.
 *
 * Backend references:
 * - [credentials.list_credentials()](backend/routes/credentials.py:14)
 * - [credentials.get_credential()](backend/routes/credentials.py:84)
 * - [credentials.get_credential_stats()](backend/routes/credentials.py:53)
 * - [credentials.delete_credential()](backend/routes/credentials.py:93)
 * - [credentials.clear_all_credentials()](backend/routes/credentials.py:109)
 *
 * SECURITY: All endpoints require authentication via JwtAuthGuard
 */

import { Controller, Get, Param, Query, Headers, Delete } from '@nestjs/common';
import { CurrentUser } from './auth.decorators';
import type { UserRole } from './auth.guard';

type AnyJson = Record<string, unknown> | unknown[];

@Controller('credentials')
export class CredentialsController {
  private readonly backendBaseUrl: string =
    process.env.BACKEND_BASE_URL ?? 'http://backend:8000';

  /**
   * GET /api/credentials
   * Proxy to FastAPI [credentials.list_credentials()](backend/routes/credentials.py:14)
   * Supports filters and pagination:
   * - skip: number (default 0)
   * - limit: number (default 100)
   * - domain: string
   * - is_admin: boolean
   * - search: string
   */
  @Get()
  async listCredentials(
    @CurrentUser() _user: { sub: string; role: UserRole },
    @Query('skip') skip: string = '0',
    @Query('limit') limit: string = '100',
    @Query('domain') domain?: string,
    @Query('is_admin') is_admin?: string, // boolean as string
    @Query('search') search?: string,
    @Headers('authorization') authorization?: string,
  ): Promise<AnyJson> {
    const url = new URL(`${this.backendBaseUrl}/api/credentials/`);
    url.searchParams.set('skip', skip ?? '0');
    url.searchParams.set('limit', limit ?? '100');
    if (domain) url.searchParams.set('domain', domain);
    if (is_admin !== undefined) url.searchParams.set('is_admin', is_admin);
    if (search) url.searchParams.set('search', search);

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
            endpoint: 'GET /api/credentials -> FastAPI',
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
        `Backend /api/credentials error: ${res.status} ${res.statusText}`,
      );
    }
    const data = await res.json();
    return data;
  }

  /**
   * GET /api/credentials/stats
   * Proxy to FastAPI [credentials.get_credential_stats()](backend/routes/credentials.py:53)
   */
  @Get('stats')
  async credentialStats(
    @CurrentUser() _user: { sub: string; role: UserRole },
    @Query('domain') domain?: string,
    @Query('search') search?: string,
    @Headers('authorization') authorization?: string,
  ): Promise<AnyJson> {
    const url = new URL(`${this.backendBaseUrl}/api/credentials/stats`);
    if (domain) url.searchParams.set('domain', domain);
    if (search) url.searchParams.set('search', search);
    
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
            endpoint: 'GET /api/credentials/stats -> FastAPI',
            forwarded_url: url,
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
          },
          null,
          2,
        ),
      );
      throw new Error(
        `Backend /api/credentials/stats error: ${res.status} ${res.statusText}`,
      );
    }
    const data = await res.json();
    return data;
  }

  /**
   * GET /api/credentials/:credentialId
   * Proxy to FastAPI [credentials.get_credential()](backend/routes/credentials.py:84)
   */
  @Get(':credentialId')
  async getCredential(
    @CurrentUser() _user: { sub: string; role: UserRole },
    @Param('credentialId') credentialId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<AnyJson> {
    const url = `${this.backendBaseUrl}/api/credentials/${credentialId}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            endpoint: 'GET /api/credentials/:credentialId -> FastAPI',
            forwarded_url: url,
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
            backend_error_payload: payload,
          },
          null,
          2,
        ),
      );
      throw new Error(
        `Backend /api/credentials/${credentialId} error: ${res.status} ${res.statusText} - ${JSON.stringify(payload)}`,
      );
    }
    return payload;
  }

  /**
   * DELETE /api/credentials/:credentialId
   * Proxy to FastAPI [credentials.delete_credential()](backend/routes/credentials.py:93)
   */
  @Delete(':credentialId')
  async deleteCredential(
    @CurrentUser() _user: { sub: string; role: UserRole },
    @Param('credentialId') credentialId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<AnyJson> {
    const url = `${this.backendBaseUrl}/api/credentials/${credentialId}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            endpoint: 'DELETE /api/credentials/:credentialId -> FastAPI',
            forwarded_url: url,
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
            backend_error_payload: payload,
          },
          null,
          2,
        ),
      );
      throw new Error(
        `Backend DELETE /api/credentials/${credentialId} error: ${res.status} ${res.statusText} - ${JSON.stringify(payload)}`,
      );
    }
    return payload;
  }

  /**
   * DELETE /api/credentials
   * Proxy to FastAPI [credentials.clear_all_credentials()](backend/routes/credentials.py:109)
   */
  @Delete()
  async clearAllCredentials(
    @CurrentUser() _user: { sub: string; role: UserRole },
    @Headers('authorization') authorization?: string,
  ): Promise<AnyJson> {
    const url = `${this.backendBaseUrl}/api/credentials/`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            endpoint: 'DELETE /api/credentials -> FastAPI',
            forwarded_url: url,
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
            backend_error_payload: payload,
          },
          null,
          2,
        ),
      );
      throw new Error(
        `Backend DELETE /api/credentials error: ${res.status} ${res.statusText} - ${JSON.stringify(payload)}`,
      );
    }
    return payload;
  }
}