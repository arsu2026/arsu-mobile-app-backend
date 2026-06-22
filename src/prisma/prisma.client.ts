import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { env } from '../config/env.config';

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Prisma Client (Prisma 7 — adapter-based connection)
// ─────────────────────────────────────────────────────────────────────────────
// Prisma 7 removed datasource url/directUrl from schema.prisma.
// Connection strings are now passed via the PrismaPg adapter at runtime.
// In development, we store the client on the global object to prevent creating
// multiple instances during hot-reloads (ts-node-dev). In production there is
// only ever one instance.
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
    errorFormat: env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
  });
}

export const prisma: PrismaClient =
  env.NODE_ENV === 'production'
    ? createPrismaClient()
    : (globalThis.__prisma ??= createPrismaClient());
