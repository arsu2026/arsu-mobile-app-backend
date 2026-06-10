import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.util';

export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, {
    statusCode: 404,
  });
}
