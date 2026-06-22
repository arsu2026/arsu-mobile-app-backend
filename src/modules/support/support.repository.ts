import { prisma } from '../../prisma';

export async function createReport(
  userId: string,
  data: { subject?: string; category?: string; description: string },
) {
  return prisma.supportReport.create({
    data: {
      userId,
      subject: data.subject ?? null,
      category: data.category ?? null,
      description: data.description,
    },
  });
}

export async function listByUser(userId: string, skip: number, take: number) {
  const where = { userId };
  const [rows, total] = await Promise.all([
    prisma.supportReport.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.supportReport.count({ where }),
  ]);
  return { rows, total };
}
