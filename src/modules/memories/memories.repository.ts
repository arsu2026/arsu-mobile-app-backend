import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';

const memoryInclude = {
  author: { select: { id: true, fullName: true, avatarUrl: true } },
  media: { orderBy: { position: 'asc' as const } },
} satisfies Prisma.PostInclude;

export async function findMemoryPostIds(
  userId: string,
  monthDay: string,
  currentYear: number,
): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM posts
    WHERE author_id = ${userId}::uuid
      AND to_char(created_at AT TIME ZONE 'UTC', 'MM-DD') = ${monthDay}
      AND date_part('year', created_at AT TIME ZONE 'UTC') < ${currentYear}
    ORDER BY created_at DESC
  `);
  return rows.map((r) => r.id);
}

export async function findPostsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return prisma.post.findMany({
    where: { id: { in: ids } },
    orderBy: { createdAt: 'desc' },
    include: memoryInclude,
  });
}
