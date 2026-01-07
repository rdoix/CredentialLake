import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import { globalValidationPipe } from './validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable security headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  // Enable global validation
  app.useGlobalPipes(globalValidationPipe);

  // Enable CORS for frontend(s)
  // Flexible policy:
  // - Exact origins via CORS_ORIGIN (comma-separated)
  // - Regex patterns via CORS_ORIGIN_REGEX (comma-separated, e.g. "^https://\\d+\\.\\d+\\.\\d+\\.\\d+:8443$")
  // - Allow any HTTPS origin on proxy port via CORS_ALLOW_ANY_ON_PROXY_PORT=true and CORS_PROXY_PORT (default 8443)
  const allowedOrigins =
    process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean) ??
    ['http://localhost:3000', 'http://localhost:3001'];
  const regexPatterns =
    process.env.CORS_ORIGIN_REGEX?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const allowedRegex: RegExp[] = regexPatterns
    .map((p) => {
      try {
        return new RegExp(p);
      } catch {
        return null;
      }
    })
    .filter((r): r is RegExp => !!r);

  const corsProxyPort = Number(process.env.CORS_PROXY_PORT ?? 8443);
  const allowAnyOnProxyPort = (process.env.CORS_ALLOW_ANY_ON_PROXY_PORT ?? 'true') === 'true';

  const isAllowedOrigin = (origin?: string): boolean => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return true;

    // Exact match
    if (allowedOrigins.includes(origin)) return true;

    // Regex match
    for (const re of allowedRegex) {
      if (re.test(origin)) return true;
    }

    // Dynamic allowance: any HTTPS origin on configured proxy port (e.g., 8443)
    // This supports deployments where the proxy external IP/host varies per server.
    try {
      const u = new URL(origin);
      const isHttps = u.protocol === 'https:';
      const port = u.port || (u.protocol === 'https:' ? '443' : '');
      if (
        allowAnyOnProxyPort &&
        isHttps &&
        (port === String(corsProxyPort) || (corsProxyPort === 443 && port === '443'))
      ) {
        return true;
      }
    } catch {
      // Ignore URL parsing errors
    }

    return false;
  };

  app.enableCors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Intelx-Key'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 3600, // Cache preflight requests for 1 hour
  });

  // Prefix all gateway routes with /api
  app.setGlobalPrefix('api');

  // Structured request logging middleware (method, url, status, duration)
  app.use((req: Request, res: Response, next: () => void) => {
    const start = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          method: req.method,
          url: (req as any).originalUrl || req.url,
          status: res.statusCode,
          duration_ms: durationMs,
        }),
      );
    });
    next();
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Gateway listening on port ${port} (CORS: ${allowedOrigins.join(', ')})`);
}
bootstrap();
