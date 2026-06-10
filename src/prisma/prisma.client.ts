import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.config';

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Prisma Client
// ─────────────────────────────────────────────────────────────────────────────
// In development, we store the client on the global object to prevent creating
// multiple instances during hot-reloads (ts-node-dev). In production there is
// only ever one instance.
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
    errorFormat: env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
  });
}

export const prisma: PrismaClient =
  env.NODE_ENV === 'production'
    ? createPrismaClient()
    : (globalThis.__prisma ??= createPrismaClient());
