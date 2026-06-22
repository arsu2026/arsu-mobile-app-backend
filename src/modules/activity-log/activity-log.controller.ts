import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../common/errors';
import { parsePaginationParams } from '../../common/utils/paginate.util';
import { sendSuccess } from '../../common/utils/response.util';
import * as activityLogService from './activity-log.service';

function requireUserId(req: Request): string {
  if (!req.user?.sub) throw new UnauthorizedError('Authentication required');
  return req.user.sub;
}

export async function getActivityLog(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const type = req.query.type ? String(req.query.type) : undefined;
  const { page, limit } = parsePaginationParams(req.query as Record<string, unknown>);
  const result = await activityLogService.getActivityLog(userId, type, page, limit);
  sendSuccess(res, result.items, { meta: result.meta });
}
