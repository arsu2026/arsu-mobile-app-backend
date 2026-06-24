import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import morgan from 'morgan';
import compression from 'compression';
import passport from 'passport';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env.config';
import { corsOptions } from './config/cors.config';
import { sessionConfig } from './config/session.config';
import { rateLimitConfig } from './config/rate-limit.config';
import { errorHandler } from './common/middleware/error-handler.middleware';
import { notFoundHandler } from './common/middleware/not-found.middleware';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { configurePassport } from './config/passport.config';
import { setupSwagger } from './config/swagger.config';
import router from './routes';

export function createApp(): Application {
  const app = express();

  // ── Trust proxy (required when running behind Render / Nginx / load-balancer)
  // Lets Express read the real client IP from X-Forwarded-For so rate-limiting
  // works correctly and HTTPS is detected properly.
  app.set('trust proxy', 1);

  // ── CORS — must come FIRST, before helmet and rate-limiter ────────────────
  // Registering cors() early ensures that:
  //   1. OPTIONS preflight responses are sent before any other middleware runs
  //      (avoids preflights being rate-limited or rejected by helmet).
  //   2. All error responses produced by downstream middleware still carry the
  //      correct Access-Control-* headers so the browser can read the body.
  app.use(cors(corsOptions));

  // Explicitly handle all OPTIONS preflight requests globally so they resolve
  // in a single round-trip without touching any route handler.
  app.options('*', cors(corsOptions));

  // ── Security headers ──────────────────────────────────────────────────────
  // Helmet is configured to be API-friendly:
  //   • contentSecurityPolicy disabled  — CSP is only relevant for HTML pages;
  //     an API that returns JSON has no document context.
  //   • crossOriginResourcePolicy set to cross-origin — allows browsers and
  //     Flutter web builds to consume API responses from a different origin.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: false,
    }),
  );

  // ── Rate Limiting ─────────────────────────────────────────────────────────
  app.use(rateLimit(rateLimitConfig));

  // ── Body Parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser(env.SESSION_SECRET));
  app.use(compression());

  // ── Logging ───────────────────────────────────────────────────────────────
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
  }

  // ── Session ───────────────────────────────────────────────────────────────
  app.use(session(sessionConfig));

  // ── Passport ─────────────────────────────────────────────────────────────
  configurePassport(passport);
  app.use(passport.initialize());
  app.use(passport.session());

  // ── Request ID ───────────────────────────────────────────────────────────
  app.use(requestIdMiddleware);

  // ── Health Check ─────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  });

  // ── API Docs (Swagger UI) ────────────────────────────────────────────────
  setupSwagger(app);

  // ── API Routes ───────────────────────────────────────────────────────────
  app.use(`/${env.API_PREFIX}`, router);

  // ── Error Handling ────────────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
