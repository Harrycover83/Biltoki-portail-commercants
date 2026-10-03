-- Role model, step 1/2: new role values (+ profiles.job_title).
-- Enum values must be committed before they can be used, hence the separate migration:
-- the policies using them live in 20261004090100_role_based_access.
--   hall_manager    : manager / RX / capitaine, bound to exactly one hall
--   network_manager : responsable reseau, bound to several halls
--   hq              : siege, read-only view on every hall
--   super_admin     : administrateur total (view on everything + user administration)
-- The legacy 'admin' value stays in the enum (Postgres cannot drop enum values) but is no
-- longer assignable once step 2 is applied.
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'hall_manager';
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'network_manager';
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'hq';
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'super_admin';

ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "job_title" TEXT;
