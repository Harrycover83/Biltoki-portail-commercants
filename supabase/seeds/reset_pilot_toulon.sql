-- Reset the portal to a clean pilot state for Toulon.
--
-- Removes every fake business record while keeping:
--   - organizations and halls seeded by Prisma (real reference data)
--   - the admin account admin.biltoki@example.com
--
-- Does NOT touch auth.users: delete leftover test accounts from the Supabase
-- dashboard, or revoke them with `npm run portal:users -- sync`.
--
-- Run: psql "$SUPABASE_DB_URL" -f supabase/seeds/reset_pilot_toulon.sql
--   or paste into the Supabase SQL Editor.

begin;

do $$
declare
  v_admin_email constant text := 'admin.biltoki@example.com';
  v_admin_profile_id uuid;
  v_toulon_hall_id uuid;
  v_hall_count integer;
begin
  select id into v_admin_profile_id
  from public.profiles
  where lower(email) = v_admin_email
  limit 1;

  -- Closed periods are write-protected by trigger; reopen them before cleaning.
  update public.service_charge_periods set status = 'draft' where status = 'closed';

  delete from public.allocations;
  delete from public.service_charges;
  delete from public.allocation_rules;
  delete from public.service_charge_periods;
  delete from public.pennylane_syncs;
  delete from public.stands;

  delete from public.portal_access where lower(email) <> v_admin_email;
  delete from public.profiles where lower(email) <> v_admin_email;
  delete from public.merchants;

  -- Placeholder org/hall from the old seed_minimal.sql, superseded by the Prisma seed.
  delete from public.halls where id = '00000000-0000-0000-0000-000000000010';
  delete from public.organizations
  where id = '00000000-0000-0000-0000-000000000001'
    and not exists (select 1 from public.halls h where h.organization_id = '00000000-0000-0000-0000-000000000001');

  select id into v_toulon_hall_id
  from public.halls
  where lower(name) like '%toulon%'
  order by created_at asc
  limit 1;

  if v_toulon_hall_id is null then
    raise exception 'No Toulon hall found. Run the Prisma seed first (npm run prisma:seed).';
  end if;

  select count(*) into v_hall_count from public.halls where lower(name) like '%toulon%';
  if v_hall_count > 1 then
    raise warning 'Several Toulon halls remain (%). Keep only one before syncing.', v_hall_count;
  end if;

  -- Keep the admin usable: profile, allowlist entry and access to the pilot hall.
  if v_admin_profile_id is not null then
    update public.profiles
    set role = 'admin', merchant_id = null
    where id = v_admin_profile_id;

    insert into public.admin_hall_permissions (profile_id, hall_id)
    values (v_admin_profile_id, v_toulon_hall_id)
    on conflict (profile_id, hall_id) do nothing;

    insert into public.portal_access (email, first_name, last_name, role, merchant_id, hall_id, active, user_id, provisioned_at)
    values (v_admin_email, 'Admin', 'Biltoki', 'admin', null, v_toulon_hall_id, true, v_admin_profile_id, now())
    on conflict (email) do update set
      role = 'admin',
      merchant_id = null,
      hall_id = excluded.hall_id,
      active = true,
      user_id = excluded.user_id;
  else
    raise warning 'No profile for %. Create it, then re-run this script.', v_admin_email;
  end if;

  raise notice 'Pilot hall (Toulon): %', v_toulon_hall_id;
end $$;

commit;

select 'halls' as table_name, count(*) from public.halls
union all select 'merchants', count(*) from public.merchants
union all select 'stands', count(*) from public.stands
union all select 'profiles', count(*) from public.profiles
union all select 'portal_access', count(*) from public.portal_access
union all select 'service_charges', count(*) from public.service_charges
union all select 'periods', count(*) from public.service_charge_periods;
