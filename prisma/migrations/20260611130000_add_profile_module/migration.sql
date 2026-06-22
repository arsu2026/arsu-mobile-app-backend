-- ─────────────────────────────────────────────────────────────────────────────
-- Profile Module — schema expansion
-- ─────────────────────────────────────────────────────────────────────────────

-- Enums
CREATE TYPE "gender" AS ENUM ('MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY', 'OTHER');
CREATE TYPE "relationship_status" AS ENUM ('SINGLE', 'IN_A_RELATIONSHIP', 'ENGAGED', 'MARRIED', 'COMPLICATED', 'NOT_SPECIFIED');
CREATE TYPE "visibility_level" AS ENUM ('PUBLIC', 'FOLLOWERS', 'ONLY_ME');
CREATE TYPE "message_permission" AS ENUM ('EVERYONE', 'FOLLOWERS', 'NOBODY');
CREATE TYPE "follow_status" AS ENUM ('ACCEPTED', 'PENDING');
CREATE TYPE "post_type" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'COVER_PHOTO');
CREATE TYPE "post_privacy" AS ENUM ('PUBLIC', 'FOLLOWERS', 'ONLY_ME');
CREATE TYPE "notification_type" AS ENUM ('FOLLOW', 'FOLLOW_REQUEST', 'FOLLOW_ACCEPTED');

-- Extend profiles
ALTER TABLE "profiles"
  ADD COLUMN "username" VARCHAR(30),
  ADD COLUMN "bio" VARCHAR(500),
  ADD COLUMN "cover_url" TEXT,
  ADD COLUMN "website" VARCHAR(255),
  ADD COLUMN "date_of_birth" DATE,
  ADD COLUMN "gender" "gender",
  ADD COLUMN "relationship_status" "relationship_status",
  ADD COLUMN "location" VARCHAR(255),
  ADD COLUMN "work" VARCHAR(255),
  ADD COLUMN "education" VARCHAR(255),
  ADD COLUMN "current_city" VARCHAR(255),
  ADD COLUMN "hometown" VARCHAR(255);

CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");
CREATE INDEX "profiles_full_name_idx" ON "profiles"("full_name");
CREATE INDEX "profiles_location_idx" ON "profiles"("location");

-- Privacy settings (1:1 with profiles)
CREATE TABLE "profile_privacy_settings" (
  "profile_id" UUID NOT NULL,
  "is_private" BOOLEAN NOT NULL DEFAULT false,
  "posts_visibility" "visibility_level" NOT NULL DEFAULT 'PUBLIC',
  "messages_from" "message_permission" NOT NULL DEFAULT 'EVERYONE',
  "followers_list_visibility" "visibility_level" NOT NULL DEFAULT 'PUBLIC',
  "following_list_visibility" "visibility_level" NOT NULL DEFAULT 'PUBLIC',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "profile_privacy_settings_pkey" PRIMARY KEY ("profile_id")
);

ALTER TABLE "profile_privacy_settings"
  ADD CONSTRAINT "profile_privacy_settings_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Posts
CREATE TABLE "posts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "author_id" UUID NOT NULL,
  "content" TEXT,
  "post_type" "post_type" NOT NULL DEFAULT 'TEXT',
  "privacy" "post_privacy" NOT NULL DEFAULT 'PUBLIC',
  "media_url" TEXT,
  "thumbnail_url" TEXT,
  "is_long_form_video" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "posts"
  ADD CONSTRAINT "posts_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "posts_author_id_created_at_idx" ON "posts"("author_id", "created_at" DESC);
CREATE INDEX "posts_author_id_is_long_form_video_created_at_idx" ON "posts"("author_id", "is_long_form_video", "created_at" DESC);

-- Pinned post FK (added after posts table exists)
ALTER TABLE "profiles"
  ADD COLUMN "pinned_post_id" UUID;

ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_pinned_post_id_fkey"
  FOREIGN KEY ("pinned_post_id") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "profiles_pinned_post_id_key" ON "profiles"("pinned_post_id");

-- Follows
CREATE TABLE "follows" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "follower_id" UUID NOT NULL,
  "following_id" UUID NOT NULL,
  "status" "follow_status" NOT NULL DEFAULT 'ACCEPTED',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "follows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "follows_no_self_follow" CHECK ("follower_id" <> "following_id")
);

ALTER TABLE "follows"
  ADD CONSTRAINT "follows_follower_id_fkey"
  FOREIGN KEY ("follower_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "follows"
  ADD CONSTRAINT "follows_following_id_fkey"
  FOREIGN KEY ("following_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "follows_follower_id_following_id_key" ON "follows"("follower_id", "following_id");
CREATE INDEX "follows_follower_id_status_idx" ON "follows"("follower_id", "status");
CREATE INDEX "follows_following_id_status_idx" ON "follows"("following_id", "status");

-- Blocks
CREATE TABLE "blocks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "blocker_id" UUID NOT NULL,
  "blocked_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "blocks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "blocks_no_self_block" CHECK ("blocker_id" <> "blocked_id")
);

ALTER TABLE "blocks"
  ADD CONSTRAINT "blocks_blocker_id_fkey"
  FOREIGN KEY ("blocker_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "blocks"
  ADD CONSTRAINT "blocks_blocked_id_fkey"
  FOREIGN KEY ("blocked_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "blocks_blocker_id_blocked_id_key" ON "blocks"("blocker_id", "blocked_id");
CREATE INDEX "blocks_blocker_id_idx" ON "blocks"("blocker_id");
CREATE INDEX "blocks_blocked_id_idx" ON "blocks"("blocked_id");

-- Notifications
CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "recipient_id" UUID NOT NULL,
  "actor_id" UUID NOT NULL,
  "type" "notification_type" NOT NULL,
  "entity_id" UUID,
  "message" VARCHAR(500),
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_recipient_id_fkey"
  FOREIGN KEY ("recipient_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "notifications_recipient_id_is_read_created_at_idx" ON "notifications"("recipient_id", "is_read", "created_at" DESC);

-- User contacts (for suggestions)
CREATE TABLE "user_contacts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "contact_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_contacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_contacts_no_self_contact" CHECK ("user_id" <> "contact_user_id")
);

ALTER TABLE "user_contacts"
  ADD CONSTRAINT "user_contacts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_contacts"
  ADD CONSTRAINT "user_contacts_contact_user_id_fkey"
  FOREIGN KEY ("contact_user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "user_contacts_user_id_contact_user_id_key" ON "user_contacts"("user_id", "contact_user_id");
CREATE INDEX "user_contacts_user_id_idx" ON "user_contacts"("user_id");

-- ─────────────────────────────────────────────────────────────────────────────
-- Keep privacy settings in sync with new users
-- ─────────────────────────────────────────────────────────────────────────────

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

  INSERT INTO public.profile_privacy_settings (profile_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Backfill privacy settings for existing profiles
INSERT INTO public.profile_privacy_settings (profile_id)
SELECT p.id
FROM public.profiles p
ON CONFLICT (profile_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security (Supabase Data API path)
-- Backend Prisma uses a privileged role and bypasses RLS.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "profile_privacy_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "follows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "blocks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_contacts" ENABLE ROW LEVEL SECURITY;

-- Profiles: allow authenticated users to read public profile data
DROP POLICY IF EXISTS "Profiles are viewable by the owner" ON "profiles";
CREATE POLICY "Profiles are viewable by authenticated users"
  ON "profiles" FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON "profiles";
CREATE POLICY "Users can update their own profile"
  ON "profiles" FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Privacy settings: owner only
CREATE POLICY "Users manage their own privacy settings"
  ON "profile_privacy_settings" FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = profile_id)
  WITH CHECK ((SELECT auth.uid()) = profile_id);

-- Posts: author manages own posts; read governed by app layer for now
CREATE POLICY "Users manage their own posts"
  ON "posts" FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = author_id)
  WITH CHECK ((SELECT auth.uid()) = author_id);

-- Follows: participants can see their own edges
CREATE POLICY "Users see their own follow relationships"
  ON "follows" FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = follower_id OR (SELECT auth.uid()) = following_id);

CREATE POLICY "Users create follow as themselves"
  ON "follows" FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = follower_id);

CREATE POLICY "Users delete their own follows"
  ON "follows" FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = follower_id OR (SELECT auth.uid()) = following_id);

-- Blocks: blocker manages their block list
CREATE POLICY "Users manage their own blocks"
  ON "blocks" FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = blocker_id)
  WITH CHECK ((SELECT auth.uid()) = blocker_id);

-- Notifications: recipient only
CREATE POLICY "Users see their own notifications"
  ON "notifications" FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = recipient_id);

CREATE POLICY "Users update their own notifications"
  ON "notifications" FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = recipient_id);

-- Contacts: owner only
CREATE POLICY "Users manage their own contacts"
  ON "user_contacts" FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);