import { prisma } from './prisma.client';
import { logger } from '../common/utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Database Seed Script
// Run: npm run db:seed
// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  logger.info('🌱 Starting database seed...');

  // TODO: Add seed data here
  // Example:
  // await prisma.user.upsert({
  //   where: { email: 'admin@arsu.app' },
  //   update: {},
  //   create: { email: 'admin@arsu.app', name: 'Admin' },
  // });

  logger.info('✅ Seed complete');
}

seed()
  .catch((e) => {
    logger.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
