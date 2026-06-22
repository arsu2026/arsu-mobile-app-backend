import type { NextFunction, Request, Response } from 'express';
import type { AdminRole } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../errors';

/**
 * RBAC guard. MUST run after requireAdmin (which sets req.admin).
 * Usage: router.post('/x', requireAdmin, requireRole('SUPER_ADMIN'), controller)
 */
export function requireRole(...roles: AdminRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.admin) {
      throw new UnauthorizedError('Authentication required');
    }
    if (!roles.includes(req.admin.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
    next();
  };
}
