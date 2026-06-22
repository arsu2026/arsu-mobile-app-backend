import type { Request, Response } from 'express';
import { BadRequestError, UnauthorizedError } from '../../common/errors';
import { sendSuccess } from '../../common/utils/response.util';
import * as mediaService from './media.service';

function requireUserId(req: Request): string {
  if (!req.user?.sub) throw new UnauthorizedError('Authentication required');
  return req.user.sub;
}

export async function uploadMedia(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) throw new BadRequestError('An image file is required');

  const result = await mediaService.uploadImage(requireUserId(req), {
    buffer: file.buffer,
    mimetype: file.mimetype,
  });
  sendSuccess(res, result, { statusCode: 201, message: 'File uploaded successfully' });
}
