/**
 * Paginates a Prisma findMany call and returns data with pagination metadata.
 *
 * Usage:
 *   const result = await paginate(prisma.user, { where: { active: true } }, page, limit);
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface PrismaModel {
  findMany: (args: any) => Promise<any[]>;
  count: (args?: any) => Promise<number>;
}

export async function paginate<T>(
  model: PrismaModel,
  args: Record<string, unknown> = {},
  page = 1,
  limit = 20,
): Promise<PaginatedResult<T>> {
  const safeLimit = Math.min(Math.max(limit, 1), 100); // clamp between 1-100
  const safePage = Math.max(page, 1);
  const skip = (safePage - 1) * safeLimit;

  const [data, total] = await Promise.all([
    model.findMany({ ...args, skip, take: safeLimit }),
    model.count({ where: (args as any).where }),
  ]);

  const totalPages = Math.ceil(total / safeLimit);

  return {
    data,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPreviousPage: safePage > 1,
  };
}

/**
 * Parses pagination query params from an Express request.
 */
export function parsePaginationParams(query: Record<string, unknown>): {
  page: number;
  limit: number;
} {
  const page = Math.max(parseInt(String(query.page ?? '1'), 10), 1);
  const limit = Math.min(Math.max(parseInt(String(query.limit ?? '20'), 10), 1), 100);
  return { page, limit };
}
