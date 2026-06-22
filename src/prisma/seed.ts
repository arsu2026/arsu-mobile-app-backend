import bcrypt from 'bcryptjs';
import { prisma } from './prisma.client';
import { logger } from '../common/utils/logger';
import { env } from '../config/env.config';

// ─────────────────────────────────────────────────────────────────────────────
// Database Seed Script
// Run: npm run db:seed
// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  logger.info('🌱 Starting database seed...');

  await seedSuperAdmin();

  logger.info('✅ Seed complete');
}

async function seedSuperAdmin(): Promise<void> {
  const email = env.ADMIN_SEED_EMAIL.trim().toLowerCase();
  const password = env.ADMIN_SEED_PASSWORD;

  if (!email || !password) {
    logger.info('⏭️  ADMIN_SEED_EMAIL/PASSWORD not set — skipping super-admin seed');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      fullName: env.ADMIN_SEED_NAME,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });

  logger.info(`👑 Super-admin ready: ${admin.email} (${admin.id})`);
}

seed()
  .catch((e) => {
    logger.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
