-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "full_name" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase-specific (not managed by the Prisma schema): the foreign key into the
-- auth schema, Row Level Security, and the access policies.
-- ─────────────────────────────────────────────────────────────────────────────

-- Each profile belongs to exactly one Supabase Auth user; delete the profile
-- automatically when that user is removed.
ALTER TABLE "profiles"
    ADD CONSTRAINT "profiles_id_fkey"
    FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- RLS guards the Data API path (supabase-js, anon/authenticated roles). The
-- backend connects through Prisma with a privileged role that bypasses RLS, so
-- these policies constrain client access only.
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;

-- A signed-in user may read only their own profile row.
CREATE POLICY "Profiles are viewable by the owner"
    ON "profiles" FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = id);

-- A signed-in user may create only their own profile row.
CREATE POLICY "Users can insert their own profile"
    ON "profiles" FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = id);

-- A signed-in user may update only their own profile row, and cannot reassign it.
CREATE POLICY "Users can update their own profile"
    ON "profiles" FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);
