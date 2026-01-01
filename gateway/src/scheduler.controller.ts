/**
 * SchedulerController
 * Proxies FastAPI scheduler endpoints so the frontend can create/list/delete/run scheduled jobs.
 *
 * Backend references:
 * - [list_scheduled_jobs()](backend/routes/scheduler.py:14)
 * - [create_scheduled_job()](backend/routes/scheduler.py:23)
 * - [delete_scheduled_job()](backend/routes/scheduler.py:66)
 * - [run_scheduled_job_now()](backend/routes/scheduler.py:96)
 *
 * SECURITY: All endpoints require collector or administrator role
 */

import { Body, Controller, Delete, Get, Headers, HttpException, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { CurrentUser, Roles } from './auth.decorators';
import type { UserRole } from './auth.guard';

type ScheduledJobResponse = {
  id: string;
  name: string;
  keywords: string[];
  time_filter: string; // FastAPI enum string (e.g., D1)
  schedule: string; // cron expression
  timezone: string;
  notify_telegram: boolean;
  notify_slack: boolean;
  notify_teams: boolean;
  is_active: boolean;
  last_run?: string | null;
  next_run?: string | null;
  created_at: string;
  updated_at: string;
};

// Normalize UI time filter values to FastAPI enum codes
function normalizeTimeFilter(tf?: string): string | undefined {
  if (!tf) return undefined;
  const map: Record<string, string> = {
    '24h': 'D1',
    '7d': 'D7',
    '30d': 'D30',
    '90d': 'M3',
    '365d': 'Y1',
  };
  if (map[tf]) return map[tf];
  const allowed = new Set(['D1', 'D7', 'D30', 'W1', 'W2', 'W4', 'M1', 'M3', 'M6', 'Y1']);
  return allowed.has(tf) ? tf : undefined;
}

type CreateSchedulerPayload = {
  name: string;
  // The UI may send either a comma-separated string or an array
  keywords: string[] | string;
  time_filter?: string; // UI code (e.g., '24h') or backend code (e.g., 'D1')
  schedule: string; // cron expression (e.g., "0 6 * * *")
  timezone?: string; // IANA tz name; default Asia/Jakarta
  notify_telegram?: boolean;
  notify_slack?: boolean;
  notify_teams?: boolean;
  run_immediately?: boolean;
};

@Controller('scheduler')
@Roles('administrator', 'collector')
export class SchedulerController {
  private readonly backendBaseUrl: string = process.env.BACKEND_BASE_URL ?? 'http://localhost:8000';

  /**
   * GET /api/scheduler/jobs
   * Return list of scheduled jobs from FastAPI backend
   */
  @Get('jobs')
  async listJobs(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Headers('authorization') authorization?: string,
  ): Promise<ScheduledJobResponse[]> {
    const url = `${this.backendBaseUrl}/api/scheduler/jobs`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            endpoint: 'GET /api/scheduler/jobs -> FastAPI',
            forwarded_url: url,
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
            backend_error_text: text,
          },
          null,
          2,
        ),
      );
      throw new HttpException(`Backend error (${res.status}): ${res.statusText} ${text}`, res.status as HttpStatus);
    }

    const data = (await res.json()) as ScheduledJobResponse[];
    return data ?? [];
  }

  /**
   * POST /api/scheduler/jobs
   * Create a new scheduled job (with optional immediate run).
   */
  @Post('jobs')
  async createJob(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Body() payload: CreateSchedulerPayload,
    @Headers() headers: Record<string, string>,
  ): Promise<ScheduledJobResponse> {
    const url = `${this.backendBaseUrl}/api/scheduler/jobs`;

    // Normalize keywords to array
    const normalizedKeywords =
      Array.isArray(payload.keywords)
        ? payload.keywords
        : (payload.keywords ?? '')
            .split(',')
            .map((k) => k.trim())
            .filter((k) => k.length > 0);

    // Normalize time filter to FastAPI code
    const time_filter = normalizeTimeFilter(payload.time_filter ?? undefined) ?? payload.time_filter ?? 'D1';

    const body = {
      name: payload.name,
      keywords: normalizedKeywords,
      time_filter,
      schedule: payload.schedule,
      timezone: payload.timezone ?? 'Asia/Jakarta',
      notify_telegram: Boolean(payload.notify_telegram),
      notify_slack: Boolean(payload.notify_slack),
      notify_teams: Boolean(payload.notify_teams),
      run_immediately: payload.run_immediately ?? true,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(headers?.['authorization']
          ? { Authorization: headers['authorization'] }
          : headers?.['Authorization']
          ? { Authorization: headers['Authorization'] }
          : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            endpoint: 'POST /api/scheduler/jobs -> FastAPI',
            forwarded_url: url,
            request_payload: body,
            has_auth_header: Boolean(headers?.['authorization'] || headers?.['Authorization']),
            backend_status: res.status,
            backend_status_text: res.statusText,
            backend_error_text: text,
          },
          null,
          2,
        ),
      );
      throw new HttpException(`Backend error (${res.status}): ${res.statusText} ${text}`, res.status as HttpStatus);
    }

    const data = (await res.json()) as ScheduledJobResponse;
    return data;
  }

  /**
   * PUT /api/scheduler/jobs/:id
   * Update an existing scheduled job
   */
  @Put('jobs/:id')
  async updateJob(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('id') id: string,
    @Body() payload: CreateSchedulerPayload,
    @Headers('authorization') authorization?: string,
  ): Promise<ScheduledJobResponse> {
    const url = `${this.backendBaseUrl}/api/scheduler/jobs/${id}`;

    // Normalize keywords to array
    const normalizedKeywords =
      Array.isArray(payload.keywords)
        ? payload.keywords
        : (payload.keywords ?? '')
            .split(',')
            .map((k) => k.trim())
            .filter((k) => k.length > 0);

    // Normalize time filter to FastAPI code
    const time_filter = normalizeTimeFilter(payload.time_filter ?? undefined) ?? payload.time_filter ?? 'D1';

    const body = {
      name: payload.name,
      keywords: normalizedKeywords,
      time_filter,
      schedule: payload.schedule,
      timezone: payload.timezone ?? 'Asia/Jakarta',
      notify_telegram: Boolean(payload.notify_telegram),
      notify_slack: Boolean(payload.notify_slack),
      notify_teams: Boolean(payload.notify_teams),
    };

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            endpoint: 'PUT /api/scheduler/jobs/:id -> FastAPI',
            forwarded_url: url,
            request_payload: body,
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
            backend_error_text: text,
          },
          null,
          2,
        ),
      );
      throw new HttpException(`Backend error (${res.status}): ${res.statusText} ${text}`, res.status as HttpStatus);
    }

    const data = (await res.json()) as ScheduledJobResponse;
    return data;
  }

  /**
   * DELETE /api/scheduler/jobs/:id
   * Delete a scheduled job
   */
  @Delete('jobs/:id')
  async deleteJob(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ): Promise<{ status: string; id: string }> {
    const url = `${this.backendBaseUrl}/api/scheduler/jobs/${id}`;

    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            endpoint: 'DELETE /api/scheduler/jobs/:id -> FastAPI',
            forwarded_url: url,
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
            backend_error_text: text,
          },
          null,
          2,
        ),
      );
      throw new HttpException(`Backend error (${res.status}): ${res.statusText} ${text}`, res.status as HttpStatus);
    }

    const data = (await res.json()) as { status: string; id: string };
    return data;
  }

  /**
   * POST /api/scheduler/jobs/:id/run-now
   * Trigger an immediate run for a scheduled job
   */
  @Post('jobs/:id/run-now')
  async runNow(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ): Promise<{ status: string; id: string }> {
    const url = `${this.backendBaseUrl}/api/scheduler/jobs/${id}/run-now`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            endpoint: 'POST /api/scheduler/jobs/:id/run-now -> FastAPI',
            forwarded_url: url,
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
            backend_error_text: text,
          },
          null,
          2,
        ),
      );
      throw new HttpException(`Backend error (${res.status}): ${res.statusText} ${text}`, res.status as HttpStatus);
    }

    const data = (await res.json()) as { status: string; id: string };
    return data;
  }

  /**
   * POST /api/scheduler/jobs/:id/pause
   * Pause a scheduled job
   */
  @Post('jobs/:id/pause')
  async pause(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ): Promise<ScheduledJobResponse> {
    const url = `${this.backendBaseUrl}/api/scheduler/jobs/${id}/pause`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            endpoint: 'POST /api/scheduler/jobs/:id/pause -> FastAPI',
            forwarded_url: url,
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
            backend_error_text: text,
          },
          null,
          2,
        ),
      );
      throw new HttpException(`Backend error (${res.status}): ${res.statusText} ${text}`, res.status as HttpStatus);
    }

    const data = (await res.json()) as ScheduledJobResponse;
    return data;
  }

  /**
   * POST /api/scheduler/jobs/:id/resume
   * Resume a scheduled job
   */
  @Post('jobs/:id/resume')
  async resume(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ): Promise<ScheduledJobResponse> {
    const url = `${this.backendBaseUrl}/api/scheduler/jobs/${id}/resume`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            endpoint: 'POST /api/scheduler/jobs/:id/resume -> FastAPI',
            forwarded_url: url,
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
            backend_error_text: text,
          },
          null,
          2,
        ),
      );
      throw new HttpException(`Backend error (${res.status}): ${res.statusText} ${text}`, res.status as HttpStatus);
    }

    const data = (await res.json()) as ScheduledJobResponse;
    return data;
  }

  /**
   * GET /api/scheduler/jobs/:id/history
   * Get run history for a scheduled job
   */
  @Get('jobs/:id/history')
  async getHistory(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ): Promise<any> {
    const url = `${this.backendBaseUrl}/api/scheduler/jobs/${id}/history`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            endpoint: 'GET /api/scheduler/jobs/:id/history -> FastAPI',
            forwarded_url: url,
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
            backend_error_text: text,
          },
          null,
          2,
        ),
      );
      throw new HttpException(`Backend error (${res.status}): ${res.statusText} ${text}`, res.status as HttpStatus);
    }

    const data = await res.json();
    return data;
  }
}