-- Role model, step 1/2: new role values.
-- They must be committed before they can be used, so the policies live in the next migration.
--   hall_manager    : manager / RX / capitaine, bound to exactly one hall
--   network_manager : responsable reseau, bound to several halls
--   hq              : siege, read-only view on every hall
--   super_admin     : administrateur total (view on everything + user administration)
-- The legacy 'admin' value stays in the enum (Postgres cannot drop enum values) but is no
-- longer assignable once step 2 is applied.

alter type public.user_role add value if not exists 'hall_manager';
alter type public.user_role add value if not exists 'network_manager';
alter type public.user_role add value if not exists 'hq';
alter type public.user_role add value if not exists 'super_admin';
