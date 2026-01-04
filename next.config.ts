import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Keep trailing slashes to prevent Next 308 redirects that cause absolute backend redirects
  // This avoids browser-side navigation to http://backend:8000 which is unreachable outside Docker
  trailingSlash: true,
  async rewrites() {
    return [
      // Proxy browser requests from the frontend (port 3000) to internal services
      // Route dashboard analytics directly to backend FastAPI
      {
        source: '/api/dashboard/:path*',
        destination: 'http://backend:8000/api/dashboard/:path*',
      },
      {
        source: '/api/auth/:path*',
        destination: 'http://backend:8000/api/auth/:path*',
      },
      // Route CVE endpoints directly to backend FastAPI (avoid gateway 404/auth mismatch)
      {
        source: '/api/cve/:path*',
        destination: 'http://backend:8000/api/cve/:path*',
      },
      // Route settings to FastAPI backend (reads masked keys, saves keys and tunables)
      // Explicit routes to avoid 308 edge-cases with trailing slash normalization
      {
        source: '/api/settings',
        destination: 'http://backend:8000/api/settings',
      },
      {
        source: '/api/settings/',
        destination: 'http://backend:8000/api/settings/',
      },
      {
        source: '/api/settings/:path*',
        destination: 'http://backend:8000/api/settings/:path*',
      },
      // All other API requests go to gateway
      {
        source: '/api/:path*',
        destination: 'http://gateway:3001/api/:path*',
      },
    ];
  },
};

export default nextConfig;
