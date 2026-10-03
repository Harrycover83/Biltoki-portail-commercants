-- Mirrors supabase/migrations/20261004090000_add_role_values.sql (+ profiles.job_title) so Prisma
-- stays in sync. Idempotent: harmless if the Supabase migrations were applied first.
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'hall_manager';
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'network_manager';
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'hq';
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'super_admin';

ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "job_title" TEXT;
