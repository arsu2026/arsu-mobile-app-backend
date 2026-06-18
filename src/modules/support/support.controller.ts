import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../common/errors';
import { parsePaginationParams } from '../../common/utils/paginate.util';
import { sendSuccess } from '../../common/utils/response.util';
import type { CreateReportDto } from './dto/create-report.dto';
import * as supportService from './support.service';

function requireUserId(req: Request): string {
  if (!req.user?.sub) throw new UnauthorizedError('Authentication required');
  return req.user.sub;
}

export async function createReport(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const report = await supportService.createReport(userId, req.body as CreateReportDto);
  sendSuccess(res, report, { statusCode: 201, message: 'Report submitted' });
}

export async function getInbox(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
  const result = await supportService.getInbox(userId, page, limit);
  sendSuccess(res, result.items, { meta: result.meta });
}
