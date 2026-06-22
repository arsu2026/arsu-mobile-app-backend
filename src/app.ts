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

  // ── Security ──────────────────────────────────────────────────────────────
  app.use(helmet());
  app.use(cors(corsOptions));

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
