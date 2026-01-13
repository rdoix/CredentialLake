/**
 * JobsController
 * Proxies FastAPI jobs endpoints and provides SSE streaming for job status updates.
 * Backend references:
 * - [jobs.list_jobs()](backend/routes/jobs.py:13)
 * - [jobs.get_job()](backend/routes/jobs.py:28)
 *
 * SECURITY: All endpoints require authentication via JwtAuthGuard
 */

import { Controller, Get, Param, Query, Sse, Post, Headers, Delete } from '@nestjs/common';
import { Observable, interval, startWith, switchMap } from 'rxjs';
import { CurrentUser, Roles } from './auth.decorators';
import type { UserRole } from './auth.guard';

// Minimal job response shape aligned with FastAPI's [ScanJob.to_dict()](backend/models/scan_job.py:44)
interface JobResponse {
  id: string;
  job_type: string;
  name: string | null;
  query: string;
  status:
    | 'queued'
    | 'collecting'
    | 'parsing'
    | 'upserting'
    | 'cancelling'
    | 'cancelled'
    | 'running'
    | 'completed'
    | 'failed'
    | string;
  rq_job_id?: string | null;
  cancel_requested?: boolean;
  total_raw: number;
  total_parsed: number;
  total_new: number;
  total_duplicates: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
}

type SseEvent<T> = { data: T };

@Controller('jobs')
export class JobsController {
  private readonly backendBaseUrl: string =
    process.env.BACKEND_BASE_URL ?? 'http://localhost:8000';

  // Proxy to FastAPI [jobs.list_jobs()](backend/routes/jobs.py:13)
  @Get()
  async listJobs(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Query('skip') skip: string = '0',
    @Query('limit') limit: string = '50',
    @Query('status') status?: string,
    @Query('grouped') grouped?: string,
    @Headers('authorization') authorization?: string,
  ): Promise<JobResponse[]> {
    const url = new URL(`${this.backendBaseUrl}/api/jobs/`);
    url.searchParams.set('skip', skip ?? '0');
    url.searchParams.set('limit', limit ?? '50');
    if (status) url.searchParams.set('status', status);
    if (grouped) url.searchParams.set('grouped', grouped);

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
            endpoint: 'GET /api/jobs -> FastAPI',
            forwarded_url: url.toString(),
            has_auth_header: Boolean(authorization),
            backend_status: res.status,
            backend_status_text: res.statusText,
          },
          null,
          2,
        ),
      );
      throw new Error(`Backend /api/jobs error: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as JobResponse[];
    return data ?? [];
  }

  // Proxy to FastAPI [jobs.get_job()](backend/routes/jobs.py:28)
  @Get(':jobId')
  async getJob(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('jobId') jobId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<JobResponse> {
    const url = `${this.backendBaseUrl}/api/jobs/${jobId}`;
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
            endpoint: 'GET /api/jobs/:jobId -> FastAPI',
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
        `Backend /api/jobs/${jobId} error: ${res.status} ${res.statusText}`,
      );
    }
    const data = (await res.json()) as JobResponse;
    return data;
  }

  // Proxy to FastAPI cancel endpoint [jobs.cancel_job()](backend/routes/jobs.py:104)
  @Roles('administrator', 'collector')
  @Post(':jobId/cancel')
  async cancelJob(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('jobId') jobId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<any> {
    const url = `${this.backendBaseUrl}/api/jobs/${jobId}/cancel`;
    const res = await fetch(url, {
      method: 'POST',
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
            endpoint: 'POST /api/jobs/:jobId/cancel -> FastAPI',
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
        `Backend cancel error: ${res.status} ${res.statusText} - ${JSON.stringify(payload)}`,
      );
    }
    return payload;
  }

  // Proxy to FastAPI pause endpoint [jobs.pause_job()](backend/routes/jobs.py:111)
  @Roles('administrator', 'collector')
  @Post(':jobId/pause')
  async pauseJob(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('jobId') jobId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<any> {
    const url = `${this.backendBaseUrl}/api/jobs/${jobId}/pause`;
    const res = await fetch(url, {
      method: 'POST',
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
            endpoint: 'POST /api/jobs/:jobId/pause -> FastAPI',
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
        `Backend pause error: ${res.status} ${res.statusText} - ${JSON.stringify(payload)}`,
      );
    }
    return payload;
  }

  // Proxy to FastAPI resume endpoint [jobs.resume_job()](backend/routes/jobs.py:146)
  @Roles('administrator', 'collector')
  @Post(':jobId/resume')
  async resumeJob(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('jobId') jobId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<any> {
    const url = `${this.backendBaseUrl}/api/jobs/${jobId}/resume`;
    const res = await fetch(url, {
      method: 'POST',
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
            endpoint: 'POST /api/jobs/:jobId/resume -> FastAPI',
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
        `Backend resume error: ${res.status} ${res.statusText} - ${JSON.stringify(payload)}`,
      );
    }
    return payload;
  }

  // Proxy to FastAPI delete endpoint [jobs.delete_job()](backend/routes/jobs.py:207)
  @Roles('administrator', 'collector')
  @Delete(':jobId')
  async deleteJob(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('jobId') jobId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<any> {
    const url = `${this.backendBaseUrl}/api/jobs/${jobId}`;
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
            endpoint: 'DELETE /api/jobs/:jobId -> FastAPI',
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
        `Backend delete error: ${res.status} ${res.statusText} - ${JSON.stringify(payload)}`,
      );
    }
    return payload;
  }

  // Proxy to FastAPI clear-all endpoint [jobs.clear_all_jobs()](backend/routes/jobs.py:392)
  @Roles('administrator', 'collector')
  @Delete()
  async clearAllJobs(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Headers('authorization') authorization?: string,
  ): Promise<any> {
    const url = `${this.backendBaseUrl}/api/jobs/`;
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
            endpoint: 'DELETE /api/jobs -> FastAPI (clear all)',
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
        `Backend clear-all error: ${res.status} ${res.statusText} - ${JSON.stringify(payload)}`,
      );
    }
    return payload;
  }

  /**
   * SSE stream for job status. Clients subscribe to /jobs/:jobId/stream
   * This implementation polls FastAPI [jobs.get_job()](backend/routes/jobs.py:28) every 1s
   * and emits the full job object. Upgrade path: subscribe to Redis pub/sub when available.
   */
  @Sse(':jobId/stream')
  streamJob(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Param('jobId') jobId: string,
    @Headers('authorization') authorization?: string,
  ): Observable<SseEvent<JobResponse | { error: string; status: number }>> {
    return interval(1000).pipe(
      startWith(0),
      // switchMap returns a Promise which RxJS converts to an Observable emission
      switchMap(async () => {
        const url = `${this.backendBaseUrl}/api/jobs/${jobId}`;
        try {
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
                  endpoint: 'SSE GET /api/jobs/:jobId -> FastAPI',
                  forwarded_url: url,
                  has_auth_header: Boolean(authorization),
                  backend_status: res.status,
                  backend_status_text: res.statusText,
                },
                null,
                2,
              ),
            );
            return {
              data: {
                error: `Backend error: ${res.status} ${res.statusText}`,
                status: res.status,
              },
            };
          }
          const job = (await res.json()) as JobResponse;
          return { data: job };
        } catch (err: any) {
          // eslint-disable-next-line no-console
          console.error(
            JSON.stringify(
              {
                ts: new Date().toISOString(),
                endpoint: 'SSE GET /api/jobs/:jobId -> FastAPI',
                forwarded_url: url,
                has_auth_header: Boolean(authorization),
                gateway_error: err?.message ?? String(err),
              },
              null,
              2,
            ),
          );
          return {
            data: {
              error: `Gateway fetch error: ${err?.message ?? String(err)}`,
              status: 0,
            },
          };
        }
      }),
    );
  }
}