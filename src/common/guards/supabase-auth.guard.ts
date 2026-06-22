import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from '../../config/supabase.config';
import { UnauthorizedError } from '../errors';

const BEARER_PREFIX = 'Bearer ';

/**
 * Authenticate a request using a Supabase access token.
 *
 * Expects an `Authorization: Bearer <token>` header. The token is verified with
 * Supabase (`auth.getUser`), and on success the decoded identity is attached to
 * `req.user` while the raw token is stashed on `req.accessToken` — logout needs
 * the actual JWT string to revoke the session, not just the decoded claims.
 *
 * Throws UnauthorizedError on any failure; Express 5 forwards the rejection to
 * the central error handler.
 */
export async function supabaseAuthGuard(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    throw new UnauthorizedError('Authentication required: missing or malformed Bearer token');
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (!token) {
    throw new UnauthorizedError('Authentication required: missing access token');
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    throw new UnauthorizedError('Invalid or expired access token');
  }

  if (data.user.app_metadata?.deleted_at) {
    throw new UnauthorizedError('This account has been deactivated');
  }

  req.user = {
    sub: data.user.id,
    email: data.user.email ?? '',
    role: data.user.role,
  };
  req.accessToken = token;

  next();
}
