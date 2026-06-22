import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../common/errors';
import { sendSuccess } from '../../../common/utils/response.util';
import type { LoginDto } from './dto/login.dto';
import * as adminAuthService from './admin-auth.service';

function requireAdminId(req: Request): string {
  if (!req.admin?.id) throw new UnauthorizedError('Authentication required');
  return req.admin.id;
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await adminAuthService.login(req.body as LoginDto, req.ip);
  sendSuccess(res, result, { message: 'Logged in' });
}

export async function me(req: Request, res: Response): Promise<void> {
  const admin = await adminAuthService.getMe(requireAdminId(req));
  sendSuccess(res, admin);
}

export async function logout(req: Request, res: Response): Promise<void> {
  const result = await adminAuthService.logout(requireAdminId(req), req.ip);
  sendSuccess(res, result, { message: 'Logged out' });
}
