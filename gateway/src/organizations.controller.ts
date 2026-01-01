import { Controller, Get, Param, Res, Headers } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from './auth.decorators';
import type { UserRole } from './auth.guard';

/**
 * OrganizationsController
 * Proxies organizations endpoints to the FastAPI backend.
 *
 * Frontend expects: NEXT_PUBLIC_API_URL=http://localhost:3001/api
 * This controller exposes:
 *  - GET /api/organizations
 *  - GET /api/organizations/:domain
 *
 * Backend base URL is provided via BACKEND_BASE_URL (e.g., http://backend:8000).
 *
 * SECURITY: All endpoints require authentication via JwtAuthGuard
 */

// IMPORTANT: Do NOT include '/api' here; Nest global prefix adds '/api' automatically.
// Using 'organizations' ensures final route = /api/organizations
@Controller('organizations')
export class OrganizationsController {
  private readonly backendBaseUrl: string;

  constructor() {
    this.backendBaseUrl = process.env.BACKEND_BASE_URL || 'http://backend:8000';
  }

  @Get('/')
  async listOrganizations(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Res() res: Response,
    @Headers('authorization') authorization?: string,
  ) {
    const url = `${this.backendBaseUrl}/api/organizations`;
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json', ...(authorization ? { Authorization: authorization } : {}) } });
      const body = await r.text();
      if (!r.ok) {
        // eslint-disable-next-line no-console
        console.error(
          JSON.stringify(
            {
              ts: new Date().toISOString(),
              endpoint: 'GET /api/organizations -> FastAPI',
              forwarded_url: url,
              has_auth_header: Boolean(authorization),
              backend_status: r.status,
              backend_status_text: r.statusText,
              backend_error_text: body,
            },
            null,
            2,
          ),
        );
      }
      res.status(r.status).type('application/json').send(body);
    } catch (err: any) {
      res.status(502).json({ message: 'Gateway error fetching organizations', error: String(err) });
    }
  }

  @Get('/:domain')
  async getOrganizationDetail(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('domain') domain: string,
    @Res() res: Response,
    @Headers('authorization') authorization?: string,
  ) {
    const url = `${this.backendBaseUrl}/api/organizations/${encodeURIComponent(domain)}`;
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json', ...(authorization ? { Authorization: authorization } : {}) } });
      const body = await r.text();
      if (!r.ok) {
        // eslint-disable-next-line no-console
        console.error(
          JSON.stringify(
            {
              ts: new Date().toISOString(),
              endpoint: 'GET /api/organizations/:domain -> FastAPI',
              forwarded_url: url,
              has_auth_header: Boolean(authorization),
              backend_status: r.status,
              backend_status_text: r.statusText,
              backend_error_text: body,
            },
            null,
            2,
          ),
        );
      }
      res.status(r.status).type('application/json').send(body);
    } catch (err: any) {
      res.status(502).json({ message: 'Gateway error fetching organization detail', error: String(err) });
    }
  }
}