/**
 * ScanController
 * Proxies FastAPI IntelX scan creation endpoints to keep scanning functional
 * while providing a clean API for the frontend.
 *
 * Backend references:
 * - [create_intelx_scan()](backend/routes/scan_intelx.py:28)
 * - [create_multi_domain_scan()](backend/routes/scan_intelx.py:65)
 * - [create_multi_domain_scan_from_file()](backend/routes/scan_intelx.py:102)
 *
 * SECURITY: All endpoints require collector or administrator role
 */

import { Body, Controller, Headers, HttpException, HttpStatus, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, Roles } from './auth.decorators';
import type { UserRole } from './auth.guard';

// Map UI time filter values to FastAPI enum codes
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
type JobCreateResponse = {
  job_id: string;
  status: string;
  message: string;
};

type IntelxSinglePayload = {
  name?: string;
  query: string;
  max_results?: number;
  time_filter?: string;
  display_limit?: number;
  send_alert?: boolean;
};

type IntelxMultiplePayload = {
  name?: string;
  domains: string[];
  max_results?: number;
  time_filter?: string;
  display_limit?: number;
  send_alert?: boolean;
};

@Controller('scan/intelx')
@Roles('administrator', 'collector')
export class ScanController {
  private readonly backendBaseUrl: string =
    process.env.BACKEND_BASE_URL ?? 'http://localhost:8000';

  /**
   * Proxy to FastAPI [create_intelx_scan()](backend/routes/scan_intelx.py:28)
   * POST /api/scan/intelx/single
   */
  @Post('single')
  async createIntelxSingle(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Body() payload: IntelxSinglePayload,
    @Headers() headers: Record<string, string>,
  ): Promise<JobCreateResponse> {
    const url = `${this.backendBaseUrl}/api/scan/intelx/single`;
    const normalized = { ...payload, time_filter: normalizeTimeFilter(payload.time_filter) };
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
        ...(headers?.['x-intelx-key']
          ? { 'X-Intelx-Key': headers['x-intelx-key'] }
          : headers?.['X-Intelx-Key']
          ? { 'X-Intelx-Key': headers['X-Intelx-Key'] }
          : {}),
      },
      body: JSON.stringify(normalized),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            endpoint: 'POST /api/scan/intelx/single -> FastAPI',
            forwarded_url: url,
            has_auth_header: Boolean(headers?.['authorization'] || headers?.['Authorization']),
            request_payload: normalized,
            backend_status: res.status,
            backend_status_text: res.statusText,
            backend_error_text: text,
          },
          null,
          2,
        ),
      );
      throw new HttpException(
        `Backend error (${res.status}): ${res.statusText} ${text}`,
        res.status as HttpStatus,
      );
    }

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          ts: new Date().toISOString(),
          endpoint: 'POST /api/scan/intelx/single -> FastAPI',
          forwarded_url: url,
          request_payload: normalized,
          backend_status: res.status,
        },
        null,
        2,
      ),
    );

    const data = (await res.json()) as JobCreateResponse;
    return data;
  }

  /**
   * Proxy to FastAPI [create_multi_domain_scan()](backend/routes/scan_intelx.py:65)
   * POST /api/scan/intelx/multiple
   */
  @Post('multiple')
  async createIntelxMultiple(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Body() payload: IntelxMultiplePayload,
    @Headers() headers: Record<string, string>,
  ): Promise<JobCreateResponse> {
    const url = `${this.backendBaseUrl}/api/scan/intelx/multiple`;
    const normalized = { ...payload, time_filter: normalizeTimeFilter(payload.time_filter) };
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
        ...(headers?.['x-intelx-key']
          ? { 'X-Intelx-Key': headers['x-intelx-key'] }
          : headers?.['X-Intelx-Key']
          ? { 'X-Intelx-Key': headers['X-Intelx-Key'] }
          : {}),
      },
      body: JSON.stringify(normalized),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            endpoint: 'POST /api/scan/intelx/multiple -> FastAPI',
            forwarded_url: url,
            has_auth_header: Boolean(headers?.['authorization'] || headers?.['Authorization']),
            request_payload: normalized,
            backend_status: res.status,
            backend_status_text: res.statusText,
            backend_error_text: text,
          },
          null,
          2,
        ),
      );
      throw new HttpException(
        `Backend error (${res.status}): ${res.statusText} ${text}`,
        res.status as HttpStatus,
      );
    }

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          ts: new Date().toISOString(),
          endpoint: 'POST /api/scan/intelx/multiple -> FastAPI',
          forwarded_url: url,
          request_payload: normalized,
          backend_status: res.status,
        },
        null,
        2,
      ),
    );

    const data = (await res.json()) as JobCreateResponse;
    return data;
  }

  /**
   * Proxy to FastAPI [create_multi_domain_scan_from_file()](backend/routes/scan_intelx.py:102)
   * Receives a .txt file and forwards it as multipart/form-data to the Python backend.
   * POST /api/scan/intelx/multiple-file
   */
  @Post('multiple-file')
  @UseInterceptors(FileInterceptor('file'))
  async createIntelxMultipleFile(
    @CurrentUser() user: { sub: string; role: UserRole },
    @UploadedFile() file: any,
    @Body() body: { name?: string; time_filter?: string; max_results?: string | number; display_limit?: string | number; send_alert?: string | boolean },
    @Headers() headers: Record<string, string>,
  ): Promise<JobCreateResponse> {
    if (!file) {
      throw new HttpException('File is required (field name: file)', HttpStatus.BAD_REQUEST);
    }

    // Normalize body values to strings as expected by FastAPI Form parsing
    const name = body?.name ?? '';
    const tfRaw = body?.time_filter ?? '';
    const time_filter = normalizeTimeFilter(tfRaw) ?? '';
    const max_results = String(body?.max_results ?? '100');
    const display_limit = String(body?.display_limit ?? '10');
    // Accept both "true"/"false" and boolean
    const send_alert =
      typeof body?.send_alert === 'boolean'
        ? String(body.send_alert)
        : typeof body?.send_alert === 'string'
        ? body.send_alert
        : 'false';

    // Build multipart form-data to forward to FastAPI
    // Node 20 provides global Blob and FormData via undici
    const form = new FormData();
    const blob = new Blob([file.buffer], { type: file.mimetype || 'text/plain' });
    form.append('file', blob, file.originalname || 'domains.txt');
    if (name) form.append('name', name);
    if (time_filter) form.append('time_filter', time_filter);
    form.append('max_results', max_results);
    form.append('display_limit', display_limit);
    form.append('send_alert', send_alert);

    const url = `${this.backendBaseUrl}/api/scan/intelx/multiple-file`;
    const res = await fetch(url, {
      method: 'POST',
      body: form as any,
      headers: {
        ...(headers?.['authorization']
          ? { Authorization: headers['authorization'] }
          : headers?.['Authorization']
          ? { Authorization: headers['Authorization'] }
          : {}),
        ...(headers?.['x-intelx-key']
          ? { 'X-Intelx-Key': headers['x-intelx-key'] }
          : headers?.['X-Intelx-Key']
          ? { 'X-Intelx-Key': headers['X-Intelx-Key'] }
          : {}),
      },
      // fetch with FormData will set appropriate multipart boundaries automatically
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            ts: new Date().toISOString(),
            endpoint: 'POST /api/scan/intelx/multiple-file -> FastAPI',
            forwarded_url: url,
            has_auth_header: Boolean(headers?.['authorization'] || headers?.['Authorization']),
            request_form_fields: {
              name,
              time_filter,
              max_results,
              display_limit,
              send_alert,
            },
            file_meta: {
              originalname: file?.originalname,
              mimetype: file?.mimetype,
              size: file?.buffer ? file.buffer.length : undefined,
            },
            backend_status: res.status,
            backend_status_text: res.statusText,
            backend_error_text: text,
          },
          null,
          2,
        ),
      );
      throw new HttpException(
        `Backend error (${res.status}): ${res.statusText} ${text}`,
        res.status as HttpStatus,
      );
    }

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          ts: new Date().toISOString(),
          endpoint: 'POST /api/scan/intelx/multiple-file -> FastAPI',
          forwarded_url: url,
          has_auth_header: Boolean(headers?.['authorization'] || headers?.['Authorization']),
          request_form_fields: {
            name,
            time_filter,
            max_results,
            display_limit,
            send_alert,
          },
          file_meta: {
            originalname: file?.originalname,
            mimetype: file?.mimetype,
            size: file?.buffer ? file.buffer.length : undefined,
          },
          backend_status: res.status,
        },
        null,
        2,
      ),
    );

    const data = (await res.json()) as JobCreateResponse;
    return data;
  }
}