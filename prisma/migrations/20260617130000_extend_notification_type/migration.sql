-- Extend notification_type with engagement notification kinds.
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'LIKE';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'COMMENT';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'SHARE';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'MENTION';
