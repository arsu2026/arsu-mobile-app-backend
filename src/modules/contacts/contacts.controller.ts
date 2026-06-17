import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../common/errors';
import { sendSuccess } from '../../common/utils/response.util';
import type { SyncContactsDto } from './dto/sync-contacts.dto';
import * as contactsService from './contacts.service';

function requireUserId(req: Request): string {
  if (!req.user?.sub) throw new UnauthorizedError('Authentication required');
  return req.user.sub;
}

export async function syncContacts(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const body = req.body as SyncContactsDto;
  const result = await contactsService.syncContacts(userId, body.contacts);
  sendSuccess(res, result, { message: 'Contacts synced' });
}
