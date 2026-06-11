import dotenv from 'dotenv';
import path from 'path';

// Load .env.local first (local dev), fall back to .env
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  // App
  NODE_ENV: optionalEnv('NODE_ENV', 'development') as
    | 'development'
    | 'production'
    | 'test'
    | 'staging',
  PORT: parseInt(optionalEnv('PORT', '3000'), 10),
  API_PREFIX: optionalEnv('API_PREFIX', 'api/v1'),

  // Database
  DATABASE_URL: requireEnv('DATABASE_URL'),
  DATABASE_DIRECT_URL: requireEnv('DATABASE_DIRECT_URL'),

  // JWT
  JWT_SECRET: requireEnv('JWT_SECRET'),
  JWT_EXPIRES_IN: optionalEnv('JWT_EXPIRES_IN', '7d'),
  JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET'),
  JWT_REFRESH_EXPIRES_IN: optionalEnv('JWT_REFRESH_EXPIRES_IN', '30d'),

  // Supabase
  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_ANON_KEY: requireEnv('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),

  // Session
  SESSION_SECRET: requireEnv('SESSION_SECRET'),

  // Mail
  MAIL_HOST: optionalEnv('MAIL_HOST', 'smtp.gmail.com'),
  MAIL_PORT: parseInt(optionalEnv('MAIL_PORT', '587'), 10),
  MAIL_SECURE: optionalEnv('MAIL_SECURE', 'false') === 'true',
  MAIL_USER: optionalEnv('MAIL_USER', ''),
  MAIL_PASS: optionalEnv('MAIL_PASS', ''),
  MAIL_FROM: optionalEnv('MAIL_FROM', 'no-reply@arsu.app'),

  // Rate Limiting
  THROTTLE_TTL: parseInt(optionalEnv('THROTTLE_TTL', '60000'), 10),
  THROTTLE_LIMIT: parseInt(optionalEnv('THROTTLE_LIMIT', '100'), 10),

  // CORS
  ALLOWED_ORIGINS: optionalEnv('ALLOWED_ORIGINS', 'http://localhost:3000').split(','),
} as const;

export type Env = typeof env;
