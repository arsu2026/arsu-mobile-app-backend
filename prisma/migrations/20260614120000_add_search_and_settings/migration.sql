-- ─────────────────────────────────────────────────────────────────────────────
-- Search & Settings modules — schema expansion
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE "explore_category" AS ENUM (
  'MUSIC', 'SPORTS', 'GAMING', 'EDUCATION', 'COMEDY', 'NEWS', 'TRAVEL', 'FOOD', 'TECH'
);

CREATE TYPE "search_type" AS ENUM (
  'ALL', 'USERS', 'POSTS', 'VIDEOS', 'SHORTS', 'HASHTAGS'
);

-- Extend posts for video search and explore discovery
ALTER TABLE "posts"
  ADD COLUMN "title" VARCHAR(255),
  ADD COLUMN "description" TEXT,
  ADD COLUMN "category" "explore_category",
  ADD COLUMN "view_count" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "posts_category_view_count_idx" ON "posts"("category", "view_count" DESC);
CREATE INDEX "posts_view_count_created_at_idx" ON "posts"("view_count" DESC, "created_at" DESC);

-- Hashtags
CREATE TABLE "hashtags" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(100) NOT NULL,
  "post_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "hashtags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hashtags_name_key" ON "hashtags"("name");
CREATE INDEX "hashtags_name_idx" ON "hashtags"("name");

CREATE TABLE "post_hashtags" (
  "post_id" UUID NOT NULL,
  "hashtag_id" UUID NOT NULL,

  CONSTRAINT "post_hashtags_pkey" PRIMARY KEY ("post_id", "hashtag_id")
);

ALTER TABLE "post_hashtags"
  ADD CONSTRAINT "post_hashtags_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "post_hashtags"
  ADD CONSTRAINT "post_hashtags_hashtag_id_fkey"
  FOREIGN KEY ("hashtag_id") REFERENCES "hashtags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "post_hashtags_hashtag_id_idx" ON "post_hashtags"("hashtag_id");

-- Search history
CREATE TABLE "search_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "query" VARCHAR(255) NOT NULL,
  "search_type" "search_type" NOT NULL DEFAULT 'ALL',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "search_history_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "search_history"
  ADD CONSTRAINT "search_history_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "search_history_user_id_created_at_idx" ON "search_history"("user_id", "created_at" DESC);

-- Account settings (1:1 with profiles)
CREATE TABLE "user_account_settings" (
  "profile_id" UUID NOT NULL,
  "phone" VARCHAR(20),
  "phone_verified_at" TIMESTAMPTZ(6),
  "pending_email" VARCHAR(255),
  "pending_email_otp" VARCHAR(10),
  "pending_email_otp_expires_at" TIMESTAMPTZ(6),
  "pending_phone" VARCHAR(20),
  "pending_phone_otp" VARCHAR(10),
  "pending_phone_otp_expires_at" TIMESTAMPTZ(6),
  "last_password_change_at" TIMESTAMPTZ(6),
  "last_login_at" TIMESTAMPTZ(6),
  "last_login_location" VARCHAR(255),
  "last_login_device" VARCHAR(255),
  "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_account_settings_pkey" PRIMARY KEY ("profile_id")
);

ALTER TABLE "user_account_settings"
  ADD CONSTRAINT "user_account_settings_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Active sessions
CREATE TABLE "user_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "device_name" VARCHAR(255) NOT NULL,
  "user_agent" VARCHAR(500),
  "ip_address" VARCHAR(45),
  "location" VARCHAR(255),
  "is_current" BOOLEAN NOT NULL DEFAULT false,
  "last_active_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "user_sessions"
  ADD CONSTRAINT "user_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "user_sessions_user_id_last_active_at_idx" ON "user_sessions"("user_id", "last_active_at" DESC);

-- Auto-create account settings alongside privacy settings for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_account_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_account_settings (profile_id)
  VALUES (NEW.id)
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_account_settings ON public.profiles;
CREATE TRIGGER on_profile_created_account_settings
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_account_settings();

-- Backfill account settings for existing profiles
INSERT INTO public.user_account_settings (profile_id)
SELECT id FROM public.profiles
ON CONFLICT (profile_id) DO NOTHING;
