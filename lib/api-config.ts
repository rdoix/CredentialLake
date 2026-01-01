/**
 * API Configuration
 * Secure browser access via Next.js rewrites: browser only calls /api on port 3000,
 * which Next proxies internally to gateway/backend. Server-side uses Docker internal URLs.
 */

// Get the API base URL
export const getApiUrl = () => {
  // In browser, use relative /api so requests hit Next.js and get proxied
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_GATEWAY_BASE_URL || '/api';
  }
  // On server-side (SSR), call gateway directly inside Docker network
  return process.env.GATEWAY_INTERNAL_URL || 'http://gateway:3001/api';
};

// Get the backend auth base URL
export const getBackendUrl = () => {
  // In browser, go through Next proxy to backend auth
  if (typeof window !== 'undefined') {
    return '/api/auth';
  }
  // On server-side (SSR), call backend auth directly inside Docker network
  return process.env.BACKEND_INTERNAL_AUTH_URL || 'http://backend:8000/api/auth';
};

// API endpoints
export const API_ENDPOINTS = {
  // Auth endpoints (proxied from frontend to backend)
  AUTH_CHECK_SETUP: `${getBackendUrl()}/check-setup`,
  AUTH_LOGIN: `${getBackendUrl()}/login`,
  AUTH_SETUP_ADMIN: `${getBackendUrl()}/setup-admin`,
  AUTH_ME: `${getBackendUrl()}/me`,
  // User management endpoints (admin only)
  AUTH_CREATE_USER: `${getBackendUrl()}/create-user`,
  AUTH_LIST_USERS: `${getBackendUrl()}/users`,
  AUTH_UPDATE_USER: (userId: number) => `${getBackendUrl()}/users/${userId}`,
  AUTH_DELETE_USER: (userId: number) => `${getBackendUrl()}/users/${userId}`,
  // Dummy data endpoints
  AUTH_CHECK_DUMMY_DATA: `${getBackendUrl()}/check-dummy-data`,
  AUTH_IMPORT_DUMMY_DATA: `${getBackendUrl()}/import-dummy-data`,
  // Async import endpoints (preferred to avoid long-running request timeouts)
  AUTH_IMPORT_DUMMY_START: `${getBackendUrl()}/import-dummy-start`,
  DUMMY_IMPORT_STATUS: `${getBackendUrl()}/dummy-import-status`,

  // Other endpoints (through gateway)
  DASHBOARD_STATS: `${getApiUrl()}/dashboard/stats`,
  CREDENTIALS: `${getApiUrl()}/credentials`,
  ORGANIZATIONS: `${getApiUrl()}/organizations`,
};

export default {
  getApiUrl,
  getBackendUrl,
  API_ENDPOINTS,
};