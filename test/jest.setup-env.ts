// reflect-metadata polyfill — required by class-transformer's @Type() and
// class-validator's @ValidateNested() (nested DTOs). Must load before any DTO
// module is imported, so it lives in setupFiles (runs before the test modules).
import 'reflect-metadata';

// Hermetic test environment.
//
// These run before any application module is imported. env.config calls
// dotenv.config(), which does NOT override variables that are already set —
// so these dummy values win, and the test suite never depends on a real
// .env / .env.test file (it passes the same way in CI with no secrets).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.DATABASE_DIRECT_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET ??= 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-jwt-refresh-secret';
process.env.ADMIN_JWT_SECRET ??= 'test-admin-jwt-secret';
process.env.SUPABASE_URL ??= 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY ??= 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
process.env.SUPABASE_POST_MEDIA_BUCKET ??= 'post-media';
process.env.SESSION_SECRET ??= 'test-session-secret';
