create extension if not exists pgcrypto;

create type public.app_role as enum ('merchant', 'admin');
create type public.period_status as enum ('draft', 'calculated', 'validated', 'closed');
create type public.allocation_rule as enum ('linear_meters', 'equal_share', 'custom_percentage', 'specific_merchant');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.halls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  city text not null,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid not null references public.halls(id) on delete restrict,
  legal_name text not null,
  trade_name text,
  email text,
  phone text,
  pennylane_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (hall_id, legal_name),
  unique (hall_id, pennylane_id)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  first_name text,
  last_name text,
  role public.app_role not null default 'merchant',
  merchant_id uuid references public.merchants(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.stands (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid not null references public.halls(id) on delete restrict,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  name text,
  number text not null,
  linear_meters numeric(10,2) not null check (linear_meters >= 0),
  start_date date,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (hall_id, number)
);

create table public.service_charge_periods (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid not null references public.halls(id) on delete restrict,
  label text not null,
  period_start date not null,
  period_end date not null,
  status public.period_status not null default 'draft',
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (hall_id, label)
);

create table public.service_charges (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid not null references public.halls(id) on delete restrict,
  period_id uuid not null references public.service_charge_periods(id) on delete cascade,
  label text not null,
  category text not null,
  amount_excl_tax bigint not null check (amount_excl_tax >= 0),
  amount_tax bigint not null check (amount_tax >= 0),
  amount_incl_tax bigint not null check (amount_incl_tax >= 0),
  pennylane_id text,
  source text not null default 'manual',
  allocation_rule public.allocation_rule not null default 'linear_meters',
  created_at timestamptz not null default now(),
  unique (hall_id, period_id, label, category),
  unique (hall_id, pennylane_id)
);

create table public.allocations (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.service_charge_periods(id) on delete cascade,
  service_charge_id uuid not null references public.service_charges(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  stand_id uuid references public.stands(id) on delete set null,
  merchant_linear_meters numeric(10,2) not null check (merchant_linear_meters >= 0),
  total_linear_meters numeric(10,2) not null check (total_linear_meters > 0),
  allocation_percentage numeric(7,4) not null check (allocation_percentage >= 0 and allocation_percentage <= 100),
  allocated_amount_cents bigint not null check (allocated_amount_cents >= 0),
  created_at timestamptz not null default now(),
  unique (period_id, service_charge_id, merchant_id)
);

create table public.pennylane_syncs (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid not null references public.halls(id) on delete restrict,
  sync_type text not null,
  status text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  records_processed integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index halls_organization_id_idx on public.halls(organization_id);
create index merchants_hall_id_idx on public.merchants(hall_id);
create index profiles_merchant_id_idx on public.profiles(merchant_id);
create index stands_hall_id_idx on public.stands(hall_id);
create index stands_merchant_id_idx on public.stands(merchant_id);
create index service_charge_periods_hall_id_idx on public.service_charge_periods(hall_id);
create index service_charges_period_id_idx on public.service_charges(period_id);
create index allocations_merchant_id_idx on public.allocations(merchant_id);
create index allocations_period_id_idx on public.allocations(period_id);
create index pennylane_syncs_hall_id_idx on public.pennylane_syncs(hall_id);

create function public.current_user_role() returns public.app_role
language sql
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.current_user_merchant_id() returns uuid
language sql
stable
as $$
  select merchant_id from public.profiles where id = auth.uid();
$$;

create function public.ensure_period_is_mutable() returns trigger
language plpgsql
as $$
declare
  period_state public.period_status;
begin
  select status into period_state from public.service_charge_periods where id = coalesce(new.period_id, old.period_id);

  if period_state = 'closed' then
    raise exception 'Période clôturée: modification interdite';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger service_charges_block_when_closed
before insert or update or delete on public.service_charges
for each row execute function public.ensure_period_is_mutable();

create trigger allocations_block_when_closed
before insert or update or delete on public.allocations
for each row execute function public.ensure_period_is_mutable();

alter table public.organizations enable row level security;
alter table public.halls enable row level security;
alter table public.merchants enable row level security;
alter table public.profiles enable row level security;
alter table public.stands enable row level security;
alter table public.service_charge_periods enable row level security;
alter table public.service_charges enable row level security;
alter table public.allocations enable row level security;
alter table public.pennylane_syncs enable row level security;

create policy profiles_self_or_admin on public.profiles
for select
using (
  id = auth.uid()
  or public.current_user_role() = 'admin'
);

create policy merchants_admin_or_self on public.merchants
for select
using (
  public.current_user_role() = 'admin'
  or id = public.current_user_merchant_id()
);

create policy stands_admin_or_self on public.stands
for select
using (
  public.current_user_role() = 'admin'
  or merchant_id = public.current_user_merchant_id()
);

create policy periods_admin_or_hall on public.service_charge_periods
for select
using (
  public.current_user_role() = 'admin'
  or exists (
    select 1
    from public.merchants m
    where m.id = public.current_user_merchant_id()
      and m.hall_id = service_charge_periods.hall_id
  )
);

create policy charges_admin_or_hall on public.service_charges
for select
using (
  public.current_user_role() = 'admin'
  or exists (
    select 1
    from public.merchants m
    where m.id = public.current_user_merchant_id()
      and m.hall_id = service_charges.hall_id
  )
);

create policy allocations_admin_or_self on public.allocations
for select
using (
  public.current_user_role() = 'admin'
  or merchant_id = public.current_user_merchant_id()
);

create policy syncs_admin_only on public.pennylane_syncs
for select
using (public.current_user_role() = 'admin');

create policy admin_write_profiles on public.profiles
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy admin_write_merchants on public.merchants
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy admin_write_stands on public.stands
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy admin_write_periods on public.service_charge_periods
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy admin_write_charges on public.service_charges
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy admin_write_allocations on public.allocations
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy admin_write_syncs on public.pennylane_syncs
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy admin_read_halls on public.halls
for select
using (public.current_user_role() = 'admin');

create policy admin_write_halls on public.halls
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy admin_read_organizations on public.organizations
for select
using (public.current_user_role() = 'admin');

create policy admin_write_organizations on public.organizations
for all
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');
