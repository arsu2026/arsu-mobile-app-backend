import dotenv from 'dotenv';
import path from 'path';

// Load variables from a single local .env file (gitignored). .env.example
// documents the required variables. Tests don't depend on any file:
// test/jest.setup-env.ts sets process.env before this runs, and dotenv never
// overrides already-set variables, so the suite stays hermetic.
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

  // Admin auth (dedicated — independent of end-user JWT_SECRET)
  ADMIN_JWT_SECRET: requireEnv('ADMIN_JWT_SECRET'),
  ADMIN_JWT_EXPIRES_IN: optionalEnv('ADMIN_JWT_EXPIRES_IN', '1d'),
  ADMIN_SEED_EMAIL: optionalEnv('ADMIN_SEED_EMAIL', ''),
  ADMIN_SEED_PASSWORD: optionalEnv('ADMIN_SEED_PASSWORD', ''),
  ADMIN_SEED_NAME: optionalEnv('ADMIN_SEED_NAME', 'Super Admin'),

  // Supabase
  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_ANON_KEY: requireEnv('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  SUPABASE_POST_MEDIA_BUCKET: optionalEnv('SUPABASE_POST_MEDIA_BUCKET', 'post-media'),

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
