import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { AppError } from '../errors/app.error';

/**
 * Guard for JWT-protected routes.
 * Usage: router.get('/protected', jwtGuard, controller)
 */
export function jwtGuard(req: Request, res: Response, next: NextFunction): void {
  passport.authenticate('jwt', { session: false }, (err: Error, user: any) => {
    if (err) return next(err);
    if (!user) return next(new AppError('Unauthorized — invalid or missing token', 401, 'UNAUTHORIZED'));
    req.user = user;
    return next();
  })(req, res, next);
}

/**
 * Guard for local (email/password) login.
 * Usage: router.post('/login', localGuard, controller)
 */
export function localGuard(req: Request, res: Response, next: NextFunction): void {
  passport.authenticate('local', { session: false }, (err: Error, user: any, info: any) => {
    if (err) return next(err);
    if (!user) {
      return next(new AppError(info?.message ?? 'Invalid credentials', 401, 'INVALID_CREDENTIALS'));
    }
    req.user = user;
    return next();
  })(req, res, next);
}
