import { prisma } from '../../../prisma';

export async function findByEmail(email: string) {
  return prisma.adminUser.findUnique({ where: { email } });
}

export async function findById(id: string) {
  return prisma.adminUser.findUnique({ where: { id } });
}

export async function updateLastActiveAt(id: string) {
  return prisma.adminUser.update({ where: { id }, data: { lastActiveAt: new Date() } });
}
