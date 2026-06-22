import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../common/errors';
import { sendSuccess } from '../../common/utils/response.util';
import * as memoriesService from './memories.service';

function requireUserId(req: Request): string {
  if (!req.user?.sub) throw new UnauthorizedError('Authentication required');
  return req.user.sub;
}

export async function getMemories(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const date = req.query.date ? String(req.query.date) : undefined;
  const memories = await memoriesService.getMemories(userId, date);
  sendSuccess(res, memories);
}
