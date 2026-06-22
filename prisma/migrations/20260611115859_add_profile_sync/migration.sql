-- ─────────────────────────────────────────────────────────────────────────────
-- Keep public.profiles in sync with auth.users:
--   1. Give updated_at a DB-level default so non-Prisma inserts (trigger, the
--      Data API) don't trip the NOT NULL constraint.
--   2. A trigger creates a profile row for every newly inserted auth user.
--   3. Backfill profiles for users that already exist.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. DB-level default for updated_at (mirrors the @default(now()) in schema.prisma).
ALTER TABLE "profiles" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- 2. Auto-create a profile whenever a new auth user is inserted.
--    SECURITY DEFINER: runs as the function owner so it can bypass RLS on profiles.
--    search_path = '' with fully-qualified names prevents search_path hijacking.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, created_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.created_at
  );
  RETURN NEW;
END;
$$;

-- AFTER INSERT so the auth.users row exists before the FK-bound profile is written.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill: give every existing auth user a profile (idempotent).
INSERT INTO public.profiles (id, full_name, avatar_url, created_at)
SELECT
  au.id,
  au.raw_user_meta_data ->> 'full_name',
  au.raw_user_meta_data ->> 'avatar_url',
  au.created_at
FROM auth.users au
ON CONFLICT (id) DO NOTHING;
