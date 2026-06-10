import { Response } from 'express';

// ─────────────────────────────────────────────────────────────────────────────
// Standard API response shape
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  meta?: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
  stack?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions to send consistent responses
// ─────────────────────────────────────────────────────────────────────────────

export function sendSuccess<T>(
  res: Response,
  data: T,
  options?: { message?: string; statusCode?: number; meta?: PaginationMeta },
): Response {
  const { message, statusCode = 200, meta } = options ?? {};
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
    ...(meta && { meta }),
  };
  return res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  message: string,
  options?: {
    statusCode?: number;
    errors?: Record<string, string[]>;
    stack?: string;
  },
): Response {
  const { statusCode = 500, errors, stack } = options ?? {};
  const response: ApiErrorResponse = {
    success: false,
    message,
    ...(errors && { errors }),
    ...(stack && { stack }),
  };
  return res.status(statusCode).json(response);
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
