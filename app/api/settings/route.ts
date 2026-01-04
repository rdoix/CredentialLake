/**
 * Next.js API Route: /api/settings
 * Server-side proxy to FastAPI backend settings endpoints to avoid browser redirects
 * and Docker-internal host exposure. Ensures trailing slash to prevent FastAPI 307 Location to http://backend:8000.
 */

const BACKEND_SETTINGS_URL = process.env.BACKEND_INTERNAL_SETTINGS_URL || 'http://backend:8000/api/settings/';

async function forwardToBackend(pathSuffix: string = '', init?: RequestInit) {
  const url = BACKEND_SETTINGS_URL.endsWith('/')
    ? `${BACKEND_SETTINGS_URL}${pathSuffix}`
    : `${BACKEND_SETTINGS_URL}/${pathSuffix}`;

  // Ensure Accept header defaults to application/json
  const headers = new Headers(init?.headers || {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  // Forward request
  const res = await fetch(url, {
    ...init,
    headers,
  });

  const text = await res.text();

  // Return backend status and content-type
  const responseHeaders = new Headers();
  // Try to preserve backend content-type if provided, else default json
  responseHeaders.set('Content-Type', res.headers.get('content-type') || 'application/json');

  return new Response(text, {
    status: res.status,
    headers: responseHeaders,
  });
}

export async function GET(req: Request) {
  try {
    // Preserve incoming Authorization header for backend auth
    const auth = req.headers.get('authorization') || '';
    const headers: Record<string, string> = {};
    if (auth) headers['Authorization'] = auth;

    return await forwardToBackend('', {
      method: 'GET',
      headers,
    });
  } catch (err) {
    // Network/forwarding failure
    const message = err instanceof Error ? err.message : 'Proxy GET failed';
    return new Response(JSON.stringify({ detail: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.text(); // pass through raw body to preserve formatting
    // Preserve incoming Authorization header for backend auth
    const auth = req.headers.get('authorization') || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (auth) headers['Authorization'] = auth;

    return await forwardToBackend('', {
      method: 'POST',
      headers,
      body,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy POST failed';
    return new Response(JSON.stringify({ detail: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Optional: allow CORS preflight if needed by external consumers (not necessary for same-origin browser)
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
    },
  });
}