-- Minimal seed for local/UAT validation.
-- Prerequisite: create 2 users in Supabase Auth and replace placeholders below.

begin;

-- 1) Organization and hall.
insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Biltoki')
on conflict (id) do update set name = excluded.name;

insert into public.halls (id, organization_id, name, city, address, active)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Les Halles de Biltoki Toulon',
  'Toulon',
  'A renseigner',
  true
)
on conflict (id) do nothing;

-- 2) Merchants.
insert into public.merchants (id, hall_id, legal_name, trade_name, email, active)
values
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000010',
    'Jean Dupont SARL',
    'Poissonnerie du Port',
    'jean.merchant@example.com',
    true
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000010',
    'Boucherie Martin SAS',
    'Boucherie Martin',
    'martin.merchant@example.com',
    true
  )
on conflict (id) do nothing;

-- 3) Profiles linked to auth.users.
-- The auth users must exist with these emails before running this seed.
do $$
declare
  merchant_user_id uuid;
  admin_user_id uuid;
begin
  select id into merchant_user_id
  from auth.users
  where lower(email) = 'jean.merchant@example.com'
  limit 1;

  select id into admin_user_id
  from auth.users
  where lower(email) = 'admin.biltoki@example.com'
  limit 1;

  if merchant_user_id is null then
    raise exception 'Auth user not found: jean.merchant@example.com';
  end if;

  if admin_user_id is null then
    raise exception 'Auth user not found: admin.biltoki@example.com';
  end if;

  insert into public.profiles (id, email, first_name, last_name, role, merchant_id)
  values
    (
      merchant_user_id,
      'jean.merchant@example.com',
      'Jean',
      'Dupont',
      'merchant',
      '00000000-0000-0000-0000-000000000101'
    ),
    (
      admin_user_id,
      'admin.biltoki@example.com',
      'Admin',
      'Biltoki',
      'admin',
      null
    )
  on conflict (id) do update set
    email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    role = excluded.role,
    merchant_id = excluded.merchant_id;

  insert into public.admin_hall_permissions (profile_id, hall_id)
  values (admin_user_id, '00000000-0000-0000-0000-000000000010')
  on conflict (profile_id, hall_id) do nothing;
end $$;

-- 4) Stands.
insert into public.stands (
  id,
  hall_id,
  merchant_id,
  name,
  number,
  linear_meters,
  start_date,
  active
)
values
  (
    '00000000-0000-0000-0000-000000001201',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000101',
    'Poissonnerie du Port',
    'A12',
    8.000,
    date '2026-01-01',
    true
  ),
  (
    '00000000-0000-0000-0000-000000001202',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000102',
    'Boucherie Martin',
    'A13',
    12.000,
    date '2026-01-01',
    true
  )
on conflict (id) do nothing;

-- 5) Period and charges.
insert into public.service_charge_periods (
  id,
  hall_id,
  label,
  period_start,
  period_end,
  status
)
values (
  '00000000-0000-0000-0000-000000002001',
  '00000000-0000-0000-0000-000000000010',
  'Juillet 2026',
  date '2026-07-01',
  date '2026-07-31',
  'draft'
)
on conflict (id) do nothing;

insert into public.service_charges (
  id,
  hall_id,
  period_id,
  label,
  category,
  amount_excl_tax,
  amount_tax,
  amount_incl_tax,
  source
)
values
  (
    '00000000-0000-0000-0000-000000003001',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000002001',
    'Nettoyage',
    'operation',
    3333.33,
    666.67,
    4000.00,
    'manual'
  ),
  (
    '00000000-0000-0000-0000-000000003002',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000002001',
    'Securite',
    'operation',
    1666.67,
    333.33,
    2000.00,
    'manual'
  ),
  (
    '00000000-0000-0000-0000-000000003003',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000002001',
    'Maintenance',
    'operation',
    2916.67,
    583.33,
    3500.00,
    'manual'
  )
on conflict (id) do nothing;

-- 6) Compute allocations and close period (run as admin account).
-- select public.recalculate_allocations_for_period('00000000-0000-0000-0000-000000002001');
-- select public.close_period('00000000-0000-0000-0000-000000002001');

commit;
