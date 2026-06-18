import { buildPaginationMeta } from '../../common/utils/response.util';
import type { PaginationMeta } from '../../common/utils/response.util';
import * as repo from './support.repository';
import type { CreateReportInput, SupportReportView } from './support.types';

type ReportRow = Awaited<ReturnType<typeof repo.createReport>>;

function mapReport(row: ReportRow): SupportReportView {
  return {
    id: row.id,
    subject: row.subject,
    category: row.category,
    description: row.description,
    status: row.status,
    adminResponse: row.adminResponse,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createReport(userId: string, input: CreateReportInput): Promise<SupportReportView> {
  const row = await repo.createReport(userId, input);
  return mapReport(row);
}

export async function getInbox(
  userId: string,
  page: number,
  limit: number,
): Promise<{ items: SupportReportView[]; meta: PaginationMeta }> {
  const skip = (page - 1) * limit;
  const { rows, total } = await repo.listByUser(userId, skip, limit);
  return { items: rows.map(mapReport), meta: buildPaginationMeta(total, page, limit) };
}
