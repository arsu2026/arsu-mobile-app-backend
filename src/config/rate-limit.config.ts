import { Options } from 'express-rate-limit';
import { env } from './env.config';

export const rateLimitConfig: Partial<Options> = {
  windowMs: env.THROTTLE_TTL,
  limit: env.THROTTLE_LIMIT,
  standardHeaders: 'draft-7', // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many requests, please try again later.',
  },
  skip: (req) => {
    // Skip rate limiting for health check endpoint
    return req.path === '/health';
  },
};
