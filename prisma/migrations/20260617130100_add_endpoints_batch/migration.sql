-- ─────────────────────────────────────────────────────────────────────────────
-- New enums
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TYPE "saved_item_type" AS ENUM ('POST', 'VIDEO', 'LINK');
CREATE TYPE "activity_type" AS ENUM ('POST_CREATED', 'POST_LIKED', 'COMMENT_ADDED', 'POST_SHARED', 'USER_FOLLOWED', 'VIDEO_WATCHED');
CREATE TYPE "support_status" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- ─────────────────────────────────────────────────────────────────────────────
-- Column additions
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "profiles" ADD COLUMN "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "profiles" ADD COLUMN "purge_after" TIMESTAMPTZ(6);

ALTER TABLE "user_account_settings" ADD COLUMN "two_factor_method" VARCHAR(10);
ALTER TABLE "user_account_settings" ADD COLUMN "pending_two_factor_otp" VARCHAR(10);
ALTER TABLE "user_account_settings" ADD COLUMN "pending_two_factor_otp_expires_at" TIMESTAMPTZ(6);
ALTER TABLE "user_account_settings" ADD COLUMN "login_alerts_enabled" BOOLEAN NOT NULL DEFAULT true;

-- ─────────────────────────────────────────────────────────────────────────────
-- notification_preferences
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "notification_preferences" (
  "profile_id" UUID NOT NULL,
  "comments" BOOLEAN NOT NULL DEFAULT true,
  "tags" BOOLEAN NOT NULL DEFAULT true,
  "reminders" BOOLEAN NOT NULL DEFAULT false,
  "more_activity_about_you" BOOLEAN NOT NULL DEFAULT true,
  "updates_from_friends" BOOLEAN NOT NULL DEFAULT true,
  "push_enabled" BOOLEAN NOT NULL DEFAULT true,
  "email_enabled" BOOLEAN NOT NULL DEFAULT false,
  "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("profile_id")
);

-- ─────────────────────────────────────────────────────────────────────────────
-- saved_collections
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "saved_collections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(500),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saved_collections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "saved_collections_user_id_name_key" ON "saved_collections"("user_id", "name");
CREATE INDEX "saved_collections_user_id_idx" ON "saved_collections"("user_id");

-- ─────────────────────────────────────────────────────────────────────────────
-- saved_items
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "saved_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "type" "saved_item_type" NOT NULL,
  "post_id" UUID,
  "link_url" TEXT,
  "link_title" VARCHAR(255),
  "link_thumbnail_url" TEXT,
  "collection_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saved_items_pkey" PRIMARY KEY ("id")
);
-- NULL post_id rows (LINK saves) never collide: Postgres treats NULLs as distinct.
CREATE UNIQUE INDEX "saved_items_user_id_post_id_key" ON "saved_items"("user_id", "post_id");
CREATE INDEX "saved_items_user_id_created_at_idx" ON "saved_items"("user_id", "created_at" DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- activity_log
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "activity_log" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "type" "activity_type" NOT NULL,
  "entity_id" UUID,
  "entity_type" VARCHAR(30),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "activity_log_user_id_type_created_at_idx" ON "activity_log"("user_id", "type", "created_at" DESC);
CREATE INDEX "activity_log_user_id_created_at_idx" ON "activity_log"("user_id", "created_at" DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- support_reports
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "support_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "subject" VARCHAR(200),
  "category" VARCHAR(50),
  "description" TEXT NOT NULL,
  "status" "support_status" NOT NULL DEFAULT 'OPEN',
  "admin_response" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "support_reports_user_id_created_at_idx" ON "support_reports"("user_id", "created_at" DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Foreign keys
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_collections" ADD CONSTRAINT "saved_collections_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_collection_id_fkey"
  FOREIGN KEY ("collection_id") REFERENCES "saved_collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_reports" ADD CONSTRAINT "support_reports_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security: enable with NO policies (deny-all to the Supabase Data API).
-- The backend reaches Postgres through Prisma's privileged role, which bypasses RLS.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saved_collections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saved_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activity_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_reports" ENABLE ROW LEVEL SECURITY;
