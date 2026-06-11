import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from '../../config/supabase.config';

const BEARER_PREFIX = 'Bearer ';

/**
 * Optionally authenticate a request using a Supabase access token.
 *
 * When a valid Bearer token is present, attaches `req.user` and `req.accessToken`.
 * When absent or invalid, continues without authentication (does not throw).
 */
export async function optionalSupabaseAuthGuard(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    return next();
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (!token) {
    return next();
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (!error && data.user) {
    req.user = {
      sub: data.user.id,
      email: data.user.email ?? '',
      role: data.user.role,
    };
    req.accessToken = token;
  }

  next();
}
