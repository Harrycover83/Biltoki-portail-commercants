-- Core schema for Biltoki merchants portal.

create extension if not exists pgcrypto;

create type public.user_role as enum ('merchant', 'admin');
create type public.period_status as enum ('draft', 'calculated', 'validated', 'closed');
create type public.sync_status as enum ('running', 'success', 'error');
create type public.allocation_rule_type as enum (
  'linear_meters',
  'equal_share',
  'custom_percentage',
  'specific_merchant'
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.halls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null,
  city text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.merchants (
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

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  role public.user_role not null default 'merchant',
  merchant_id uuid references public.merchants(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_hall_permissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  hall_id uuid not null references public.halls(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, hall_id)
);

create table if not exists public.merchant_hall_permissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  hall_id uuid not null references public.halls(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, hall_id)
);

create table if not exists public.stands (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid not null references public.halls(id) on delete restrict,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  name text not null,
  number text,
  linear_meters numeric(10, 3) not null check (linear_meters >= 0),
  start_date date not null,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create table if not exists public.service_charge_periods (
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

create table if not exists public.allocation_rules (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid not null references public.halls(id) on delete restrict,
  name text not null,
  rule_type public.allocation_rule_type not null,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (hall_id, name)
);

create unique index if not exists uq_default_allocation_rule_per_hall
  on public.allocation_rules(hall_id)
  where is_default = true;

create table if not exists public.service_charges (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid not null references public.halls(id) on delete restrict,
  period_id uuid not null references public.service_charge_periods(id) on delete restrict,
  label text not null,
  category text,
  allocation_rule_id uuid references public.allocation_rules(id) on delete set null,
  amount_excl_tax numeric(14, 2) not null check (amount_excl_tax >= 0),
  amount_tax numeric(14, 2) not null check (amount_tax >= 0),
  amount_incl_tax numeric(14, 2) not null check (amount_incl_tax >= 0),
  pennylane_id text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (hall_id, pennylane_id)
);

create table if not exists public.allocations (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.service_charge_periods(id) on delete restrict,
  service_charge_id uuid not null references public.service_charges(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  stand_id uuid not null references public.stands(id) on delete restrict,
  merchant_linear_meters numeric(10, 3) not null check (merchant_linear_meters >= 0),
  total_linear_meters numeric(10, 3) not null check (total_linear_meters >= 0),
  allocation_percentage numeric(9, 6) not null check (allocation_percentage >= 0),
  allocated_amount numeric(14, 2) not null check (allocated_amount >= 0),
  created_at timestamptz not null default now(),
  unique (service_charge_id, merchant_id)
);

create table if not exists public.pennylane_syncs (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid not null references public.halls(id) on delete restrict,
  sync_type text not null,
  status public.sync_status not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  records_processed integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_merchants_hall_id on public.merchants(hall_id);
create index if not exists idx_stands_hall_id on public.stands(hall_id);
create index if not exists idx_stands_merchant_id on public.stands(merchant_id);
create index if not exists idx_periods_hall_id on public.service_charge_periods(hall_id);
create index if not exists idx_charges_period_id on public.service_charges(period_id);
create index if not exists idx_allocations_period_id on public.allocations(period_id);
create index if not exists idx_allocations_merchant_id on public.allocations(merchant_id);
create index if not exists idx_sync_hall_id on public.pennylane_syncs(hall_id);

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

create or replace function public.can_access_hall(target_hall_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    exists (
      select 1
      from public.profiles p
      join public.merchants m on m.id = p.merchant_id
      where p.id = auth.uid()
        and p.role = 'merchant'
        and m.hall_id = target_hall_id
    )
    or exists (
      select 1
      from public.merchant_hall_permissions mhp
      join public.profiles p on p.id = mhp.profile_id
      where p.id = auth.uid()
        and p.role = 'merchant'
        and mhp.hall_id = target_hall_id
    )
    or exists (
      select 1
      from public.admin_hall_permissions ahp
      join public.profiles p on p.id = ahp.profile_id
      where p.id = auth.uid()
        and p.role = 'admin'
        and ahp.hall_id = target_hall_id
    )
  );
$$;

create or replace function public.prevent_write_on_closed_period()
returns trigger
language plpgsql
as $$
declare
  v_status public.period_status;
begin
  select status
  into v_status
  from public.service_charge_periods
  where id = coalesce(new.period_id, old.period_id);

  if v_status = 'closed' then
    raise exception 'Cannot modify data for a closed period';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.close_period(p_period_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    raise exception 'Only admin can close a period';
  end if;

  update public.service_charge_periods
  set status = 'closed',
      closed_at = now()
  where id = p_period_id
    and status <> 'closed';
end;
$$;

create or replace function public.recalculate_allocations_for_period(p_period_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hall_id uuid;
begin
  if not public.is_admin_user() then
    raise exception 'Only admin can calculate allocations';
  end if;

  select hall_id into v_hall_id
  from public.service_charge_periods
  where id = p_period_id;

  if v_hall_id is null then
    raise exception 'Unknown period';
  end if;

  delete from public.allocations a where a.period_id = p_period_id;

  with active_stands as (
    select s.id as stand_id,
           s.merchant_id,
           s.linear_meters
    from public.stands s
    join public.service_charge_periods p on p.id = p_period_id
    where s.hall_id = v_hall_id
      and s.active = true
      and s.start_date <= p.period_end
      and (s.end_date is null or s.end_date >= p.period_start)
  ),
  totals as (
    select coalesce(sum(linear_meters), 0) as total_linear_meters
    from active_stands
  )
  insert into public.allocations (
    period_id,
    service_charge_id,
    merchant_id,
    stand_id,
    merchant_linear_meters,
    total_linear_meters,
    allocation_percentage,
    allocated_amount
  )
  select
    p_period_id,
    sc.id,
    st.merchant_id,
    st.stand_id,
    st.linear_meters,
    t.total_linear_meters,
    case
      when t.total_linear_meters = 0 then 0
      else st.linear_meters / t.total_linear_meters
    end as allocation_percentage,
    case
      when t.total_linear_meters = 0 then 0
      else round(sc.amount_incl_tax * (st.linear_meters / t.total_linear_meters), 2)
    end as allocated_amount
  from public.service_charges sc
  join active_stands st on true
  cross join totals t
  where sc.period_id = p_period_id;

  update public.service_charge_periods
  set status = 'calculated'
  where id = p_period_id
    and status = 'draft';
end;
$$;

create trigger trg_service_charges_no_write_closed
before update or delete on public.service_charges
for each row execute function public.prevent_write_on_closed_period();

create trigger trg_allocations_no_write_closed
before update or delete on public.allocations
for each row execute function public.prevent_write_on_closed_period();

alter table public.organizations enable row level security;
alter table public.halls enable row level security;
alter table public.merchants enable row level security;
alter table public.profiles enable row level security;
alter table public.admin_hall_permissions enable row level security;
alter table public.merchant_hall_permissions enable row level security;
alter table public.stands enable row level security;
alter table public.service_charge_periods enable row level security;
alter table public.allocation_rules enable row level security;
alter table public.service_charges enable row level security;
alter table public.allocations enable row level security;
alter table public.pennylane_syncs enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "admin_read_profiles"
  on public.profiles for select
  using (public.is_admin_user());

create policy "halls_access_by_membership"
  on public.halls for select
  using (public.can_access_hall(id));

create policy "halls_admin_write"
  on public.halls for all
  using (public.is_admin_user())
  with check (public.is_admin_user());

create policy "merchants_access_by_hall"
  on public.merchants for select
  using (public.can_access_hall(hall_id));

create policy "merchants_admin_write"
  on public.merchants for all
  using (public.is_admin_user())
  with check (public.is_admin_user());

create policy "stands_access_by_hall"
  on public.stands for select
  using (public.can_access_hall(hall_id));

create policy "stands_admin_write"
  on public.stands for all
  using (public.is_admin_user())
  with check (public.is_admin_user());

create policy "periods_access_by_hall"
  on public.service_charge_periods for select
  using (public.can_access_hall(hall_id));

create policy "periods_admin_write"
  on public.service_charge_periods for all
  using (public.is_admin_user())
  with check (public.is_admin_user());

create policy "allocation_rules_access_by_hall"
  on public.allocation_rules for select
  using (public.can_access_hall(hall_id));

create policy "allocation_rules_admin_write"
  on public.allocation_rules for all
  using (public.is_admin_user())
  with check (public.is_admin_user());

create policy "charges_access_by_hall"
  on public.service_charges for select
  using (public.can_access_hall(hall_id));

create policy "charges_admin_write"
  on public.service_charges for all
  using (public.is_admin_user())
  with check (public.is_admin_user());

create policy "allocations_select_merchant_own"
  on public.allocations for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'merchant'
        and p.merchant_id = allocations.merchant_id
    )
    or exists (
      select 1
      from public.service_charge_periods scp
      where scp.id = allocations.period_id
        and public.can_access_hall(scp.hall_id)
    )
  );

create policy "allocations_admin_write"
  on public.allocations for all
  using (public.is_admin_user())
  with check (public.is_admin_user());

create policy "syncs_read_admin"
  on public.pennylane_syncs for select
  using (public.is_admin_user());

create policy "syncs_write_admin"
  on public.pennylane_syncs for all
  using (public.is_admin_user())
  with check (public.is_admin_user());

create policy "admin_hall_permissions_admin_only"
  on public.admin_hall_permissions for all
  using (public.is_admin_user())
  with check (public.is_admin_user());

create policy "merchant_hall_permissions_select_own"
  on public.merchant_hall_permissions for select
  using (profile_id = auth.uid() or public.is_admin_user());

create policy "merchant_hall_permissions_admin_write"
  on public.merchant_hall_permissions for all
  using (public.is_admin_user())
  with check (public.is_admin_user());

create policy "organizations_admin_only"
  on public.organizations for all
  using (public.is_admin_user())
  with check (public.is_admin_user());
