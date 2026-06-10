import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env.config';
import { logger } from '../utils/logger';
import { sendError } from '../utils/response.util';
import { AppError } from '../errors/app.error';

// ─────────────────────────────────────────────────────────────────────────────
// Central Express error handler
// Must be the LAST middleware registered on the app
// ─────────────────────────────────────────────────────────────────────────────
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Known operational errors (thrown by us)
  if (err instanceof AppError) {
    logger.warn(`[AppError] ${req.method} ${req.path} → ${err.message}`, {
      statusCode: err.statusCode,
      code: err.code,
    });
    sendError(res, err.message, {
      statusCode: err.statusCode,
      errors: err.errors,
    });
    return;
  }

  // Unknown / programmer errors
  logger.error(`[UnhandledError] ${req.method} ${req.path}`, err);

  sendError(res, 'Internal server error', {
    statusCode: 500,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
