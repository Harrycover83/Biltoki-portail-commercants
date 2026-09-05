-- Safe, targeted fixes for the Toulon pilot — does NOT touch real merchants/stands.
-- Run in the Supabase SQL Editor.

begin;

-- 1) Store the real Pennylane invoice date required for history browsing and sync.
alter table public.service_charges add column if not exists invoice_date date;
create index if not exists idx_charges_invoice_date on public.service_charges(invoice_date);

-- 2) Create the missing portal_access allowlist table (idempotent).
create table if not exists public.portal_access (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  first_name text,
  last_name text,
  role public.user_role not null default 'merchant',
  merchant_id uuid references public.merchants(id) on delete set null,
  hall_id uuid references public.halls(id) on delete set null,
  active boolean not null default true,
  user_id uuid references auth.users(id) on delete set null,
  provisioned_at timestamptz,
  revoked_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portal_access_email_unique unique (email),
  constraint portal_access_merchant_required
    check (role <> 'merchant' or merchant_id is not null)
);

create index if not exists idx_portal_access_merchant_id on public.portal_access(merchant_id);
create index if not exists idx_portal_access_hall_id on public.portal_access(hall_id);

create or replace function public.portal_access_normalize()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(btrim(new.email));
  new.updated_at := now();

  if new.active = false and new.revoked_at is null then
    new.revoked_at := now();
  elsif new.active = true then
    new.revoked_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_portal_access_normalize on public.portal_access;
create trigger trg_portal_access_normalize
  before insert or update on public.portal_access
  for each row execute function public.portal_access_normalize();

alter table public.portal_access enable row level security;

drop policy if exists "portal_access_select" on public.portal_access;
create policy "portal_access_select"
  on public.portal_access for select
  to authenticated
  using (
    public.is_admin_user()
    or user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "portal_access_admin_write" on public.portal_access;
create policy "portal_access_admin_write"
  on public.portal_access for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

revoke all on public.portal_access from anon;

-- 2) Re-attach admin.biltoki@example.com: admin role + allowlist entry so login works again.
do $$
declare
  v_admin_email constant text := 'admin.biltoki@example.com';
  v_admin_profile_id uuid;
  v_toulon_hall_id uuid;
begin
  select id into v_admin_profile_id
  from public.profiles
  where lower(email) = v_admin_email
  limit 1;

  if v_admin_profile_id is null then
    raise exception 'Aucun profil pour %. Verifiez que le compte existe dans Supabase Auth puis relancez.', v_admin_email;
  end if;

  select id into v_toulon_hall_id
  from public.halls
  where lower(name) like '%toulon%'
  order by created_at asc
  limit 1;

  update public.profiles
  set role = 'admin'
  where id = v_admin_profile_id;

  if v_toulon_hall_id is not null then
    insert into public.admin_hall_permissions (profile_id, hall_id)
    values (v_admin_profile_id, v_toulon_hall_id)
    on conflict (profile_id, hall_id) do nothing;
  end if;

  insert into public.portal_access (email, first_name, last_name, role, merchant_id, hall_id, active, user_id, provisioned_at)
  values (v_admin_email, 'Admin', 'Biltoki', 'admin', null, v_toulon_hall_id, true, v_admin_profile_id, now())
  on conflict (email) do update set
    role = 'admin',
    merchant_id = null,
    hall_id = excluded.hall_id,
    active = true,
    user_id = excluded.user_id;

  raise notice 'Admin OK: profile %, hall %', v_admin_profile_id, v_toulon_hall_id;
end $$;

-- 3) Remove ONLY the fake test merchants ("Boucherie Martin", "Poissonnerie du Port") + their stands.
-- Closed periods are write-protected by trigger; reopen them first so the cleanup below can run.
update public.service_charge_periods set status = 'draft' where status = 'closed';

delete from public.allocations
where stand_id in (
  select id from public.stands
  where name in ('Boucherie Martin', 'Poissonnerie du Port')
     or merchant_id in (
       select id from public.merchants
       where legal_name in ('Boucherie Martin', 'Poissonnerie du Port')
          or trade_name in ('Boucherie Martin', 'Poissonnerie du Port')
     )
);

delete from public.stands
where name in ('Boucherie Martin', 'Poissonnerie du Port')
   or merchant_id in (
     select id from public.merchants
     where legal_name in ('Boucherie Martin', 'Poissonnerie du Port')
        or trade_name in ('Boucherie Martin', 'Poissonnerie du Port')
   );

delete from public.merchants
where legal_name in ('Boucherie Martin', 'Poissonnerie du Port')
   or trade_name in ('Boucherie Martin', 'Poissonnerie du Port');

-- 4) Remove the hardcoded mock invoices used as placeholder content (getMockServiceCharges()).
-- Their pennylane_id always starts with "PLN-"; real Pennylane invoice ids are plain numbers.
delete from public.service_charges where pennylane_id like 'PLN-%';

commit;

-- Sanity check
select 'portal_access' as table_name, count(*) from public.portal_access
union all select 'merchants', count(*) from public.merchants
union all select 'stands', count(*) from public.stands
union all select 'service_charges', count(*) from public.service_charges;
