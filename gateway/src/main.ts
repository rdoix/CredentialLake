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

  // Enable CORS for frontend(s); comma-separated list in CORS_ORIGIN
  const allowedOrigins =
    process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean) ??
    ['http://localhost:3000', 'http://localhost:3001'];
  
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
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
