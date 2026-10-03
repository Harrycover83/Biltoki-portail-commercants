-- Access-control hardening.
-- Goals:
--   1. A merchant can never change their own role / merchant link (no self-promotion to admin).
--   2. A merchant only sees their own rows (merchant, stands, allocations, invoices, payments)
--      plus the common service charges of the hall(s) they belong to.
--   3. Nothing is reachable anonymously, and any table without explicit policies is deny-by-default.
-- Server-side tooling (service role / direct database connection) is unaffected: it bypasses RLS
-- and is not subject to the profile guard below.

-- ---------------------------------------------------------------------------
-- Helper: merchant linked to the current user (null for admins / unlinked users)
-- ---------------------------------------------------------------------------
create or replace function public.current_merchant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.merchant_id
  from public.profiles p
  where p.id = auth.uid()
    and p.role = 'merchant';
$$;

-- ---------------------------------------------------------------------------
-- 1. Profiles: users may only edit their display name, never role/merchant/email
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (first_name, last_name) on public.profiles to authenticated;

create or replace function public.profiles_protect_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Requests coming through the API run as anon/authenticated (or carry a user JWT).
  if current_user in ('anon', 'authenticated') or auth.uid() is not null then
    if new.id is distinct from old.id
       or new.email is distinct from old.email
       or new.role is distinct from old.role
       or new.merchant_id is distinct from old.merchant_id
       or new.created_at is distinct from old.created_at then
      raise exception 'Modification of protected profile columns is not allowed'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_privileged_columns on public.profiles;
create trigger trg_profiles_protect_privileged_columns
  before update on public.profiles
  for each row execute function public.profiles_protect_privileged_columns();

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Merchants only read their own data. Admins keep full access through the
--    existing *_admin_write ("for all") policies.
-- ---------------------------------------------------------------------------
drop policy if exists "merchants_access_by_hall" on public.merchants;
drop policy if exists "merchants_select_own" on public.merchants;
create policy "merchants_select_own"
  on public.merchants for select
  using (id = public.current_merchant_id());

drop policy if exists "stands_access_by_hall" on public.stands;
drop policy if exists "stands_select_own" on public.stands;
create policy "stands_select_own"
  on public.stands for select
  using (merchant_id = public.current_merchant_id());

drop policy if exists "allocations_select_merchant_own" on public.allocations;
create policy "allocations_select_merchant_own"
  on public.allocations for select
  using (merchant_id = public.current_merchant_id());

-- Allocation rules are internal: admin-only (covered by allocation_rules_admin_write).
drop policy if exists "allocation_rules_access_by_hall" on public.allocation_rules;

-- Halls, periods and service charges stay readable per hall (common charges):
-- can_access_hall() only grants a merchant the hall(s) they belong to.

-- ---------------------------------------------------------------------------
-- 3. Tables created outside this folder (Prisma): invoices / payments
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.invoices') is not null then
    execute 'alter table public.invoices enable row level security';
    execute 'drop policy if exists "invoices_select_own" on public.invoices';
    execute 'create policy "invoices_select_own" on public.invoices for select
             using (merchant_id = public.current_merchant_id())';
    execute 'drop policy if exists "invoices_admin_all" on public.invoices';
    execute 'create policy "invoices_admin_all" on public.invoices for all
             using (public.is_admin_user()) with check (public.is_admin_user())';
  end if;

  if to_regclass('public.payments') is not null and to_regclass('public.invoices') is not null then
    execute 'alter table public.payments enable row level security';
    execute 'drop policy if exists "payments_select_own" on public.payments';
    execute 'create policy "payments_select_own" on public.payments for select
             using (exists (
               select 1 from public.invoices i
               where i.id = payments.invoice_id
                 and i.merchant_id = public.current_merchant_id()
             ))';
    execute 'drop policy if exists "payments_admin_all" on public.payments';
    execute 'create policy "payments_admin_all" on public.payments for all
             using (public.is_admin_user()) with check (public.is_admin_user())';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Deny-by-default: RLS on every public table (covers _prisma_migrations, future tables
--    created by tooling that forgot it). Tables without a policy become unreadable via the API.
-- ---------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', t.relname);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Privileges: no anonymous access, RPC functions only for signed-in users
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from public, anon;

revoke execute on function
  public.is_admin_user(),
  public.can_access_hall(uuid),
  public.current_merchant_id(),
  public.close_period(uuid),
  public.recalculate_allocations_for_period(uuid)
from public, anon;

grant execute on function
  public.is_admin_user(),
  public.can_access_hall(uuid),
  public.current_merchant_id(),
  public.close_period(uuid),
  public.recalculate_allocations_for_period(uuid)
to authenticated, service_role;

notify pgrst, 'reload schema';
