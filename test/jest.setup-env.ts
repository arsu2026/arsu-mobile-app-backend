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
process.env.SUPABASE_URL ??= 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY ??= 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
process.env.SESSION_SECRET ??= 'test-session-secret';
