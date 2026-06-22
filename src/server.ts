import 'reflect-metadata';
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('source-map-support').install();
import { createApp } from './app';
import { env } from './config/env.config';
import { logger } from './common/utils/logger';
import { prisma } from './prisma/prisma.client';

async function bootstrap() {
  // ── Connect to database ───────────────────────────────────────────────────
  await prisma.$connect();
  logger.info('Database connection established');

  // ── Bootstrap Express app ─────────────────────────────────────────────────
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(
      `🚀 Server running in [${env.NODE_ENV}] mode on port ${env.PORT}`,
    );
    logger.info(`📡 API available at http://localhost:${env.PORT}/${env.API_PREFIX}`);
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const gracefulShutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully...`);
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('Database disconnected. Goodbye 👋');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
