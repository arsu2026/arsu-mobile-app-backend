import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.config';
import { prisma } from '../../prisma';
import { ForbiddenError, UnauthorizedError } from '../errors';
import type { AdminTokenPayload } from '../../modules/admin/auth/admin-auth.types';

const BEARER_PREFIX = 'Bearer ';

/**
 * Authenticate an admin request using our own admin JWT.
 *
 * Expects `Authorization: Bearer <token>`. Verifies with ADMIN_JWT_SECRET,
 * re-loads the AdminUser fresh (so a suspension takes effect before token
 * expiry), enforces ACTIVE status, and attaches req.admin. Throws on any
 * failure; Express 5 forwards the rejection to the central error handler.
 */
export async function requireAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    throw new UnauthorizedError('Authentication required: missing or malformed Bearer token');
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (!token) {
    throw new UnauthorizedError('Authentication required: missing access token');
  }

  let payload: AdminTokenPayload;
  try {
    payload = jwt.verify(token, env.ADMIN_JWT_SECRET) as AdminTokenPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }

  const admin = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
  if (!admin) {
    throw new UnauthorizedError('Invalid or expired token');
  }
  if (admin.status !== 'ACTIVE') {
    throw new ForbiddenError('This admin account is suspended');
  }

  req.admin = { id: admin.id, email: admin.email, role: admin.role };
  next();
}
