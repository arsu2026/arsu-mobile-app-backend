-- Prisma creates its migration-history table in the public schema, which is
-- reachable through the Supabase Data API (PostgREST). Enable Row Level Security
-- with NO policies so the anon/authenticated roles get zero access by default.
-- The privileged role Prisma connects with bypasses RLS, so migrations keep working.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
