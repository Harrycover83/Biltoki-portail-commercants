-- Role model, step 2/2: scoped access per role. Requires 20261004090000_add_role_values.sql
-- and 20261003160000_harden_access_control.sql to be applied first.
--
--   merchant         own data + common charges of own hall(s)           (unchanged)
--   hall_manager     read-only, exactly ONE hall (admin_hall_permissions)
--   network_manager  read-only, the halls assigned in admin_hall_permissions
--   hq               read-only, all halls
--   super_admin      read + write everywhere, and the only one who manages accounts
--
-- Data changes go through the backend (service role) or super_admin. Hall-scoped staff and hq
-- never write through the API.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists job_title text;
alter table public.portal_access add column if not exists job_title text;

-- ---------------------------------------------------------------------------
-- Legacy admins become super_admin (single test admin today), then 'admin' is frozen
-- ---------------------------------------------------------------------------
delete from public.admin_hall_permissions ahp
using public.profiles p
where p.id = ahp.profile_id and p.role = 'admin';

update public.profiles set role = 'super_admin', merchant_id = null where role = 'admin';
update public.portal_access set role = 'super_admin', merchant_id = null where role = 'admin';

alter table public.profiles drop constraint if exists profiles_role_not_legacy;
alter table public.profiles add constraint profiles_role_not_legacy check (role <> 'admin');
alter table public.portal_access drop constraint if exists portal_access_role_not_legacy;
alter table public.portal_access add constraint portal_access_role_not_legacy check (role <> 'admin');

-- Only merchants are linked to a merchant record.
alter table public.profiles drop constraint if exists profiles_role_scope_check;
alter table public.profiles add constraint profiles_role_scope_check check (
  (role = 'merchant' and merchant_id is not null) or (role <> 'merchant' and merchant_id is null)
) not valid;

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so they can read profiles through RLS)
-- ---------------------------------------------------------------------------
-- A deactivated or removed allowlist entry cuts access to the data API immediately,
-- without waiting for the user's access token to expire.
create or replace function public.has_active_portal_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.portal_access pa
      on pa.user_id = p.id or lower(pa.email) = lower(p.email)
    where p.id = auth.uid()
      and pa.active
  );
$$;

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
    and p.role = 'merchant'
    and public.has_active_portal_access();
$$;

-- Administrateur total. Kept under its historical name: every *_admin_write policy, the admin
-- RPCs and the admin reads now mean "super_admin".
create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_active_portal_access()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    );
$$;

create or replace function public.is_staff_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_active_portal_access()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('hall_manager', 'network_manager', 'hq', 'super_admin')
    );
$$;

-- Hall visibility for non-merchant accounts.
create or replace function public.can_staff_access_hall(target_hall_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_active_portal_access()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role in ('hq', 'super_admin')
          or (
            p.role in ('hall_manager', 'network_manager')
            and exists (
              select 1
              from public.admin_hall_permissions ahp
              where ahp.profile_id = p.id
                and ahp.hall_id = target_hall_id
            )
          )
        )
    );
$$;

create or replace function public.can_access_hall(target_hall_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_staff_access_hall(target_hall_id)
    or (
      public.has_active_portal_access()
      and (
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
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------
-- Hall scopes only make sense for hall_manager (max 1 hall) and network_manager.
create or replace function public.admin_hall_permissions_check()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role public.user_role;
begin
  select role into v_role from public.profiles where id = new.profile_id;

  if v_role is null or v_role not in ('hall_manager', 'network_manager') then
    raise exception 'Hall scopes can only be assigned to hall_manager or network_manager accounts'
      using errcode = '23514';
  end if;

  if v_role = 'hall_manager' and exists (
    select 1 from public.admin_hall_permissions
    where profile_id = new.profile_id and id <> new.id
  ) then
    raise exception 'A hall_manager can only be assigned to one hall'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_admin_hall_permissions_check on public.admin_hall_permissions;
create trigger trg_admin_hall_permissions_check
  before insert or update on public.admin_hall_permissions
  for each row execute function public.admin_hall_permissions_check();

-- A role change can never leave stale or invalid hall scopes behind.
create or replace function public.profiles_sync_hall_scopes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if new.role not in ('hall_manager', 'network_manager') then
      delete from public.admin_hall_permissions where profile_id = new.id;
    elsif new.role = 'hall_manager' and (
      select count(*) from public.admin_hall_permissions where profile_id = new.id
    ) > 1 then
      raise exception 'A hall_manager can only be assigned to one hall'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_hall_scopes on public.profiles;
create trigger trg_profiles_sync_hall_scopes
  before update of role on public.profiles
  for each row execute function public.profiles_sync_hall_scopes();

-- The tool must always keep at least one super_admin.
create or replace function public.profiles_keep_super_admin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.role = 'super_admin'
     and (tg_op = 'DELETE' or new.role <> 'super_admin')
     and not exists (
       select 1 from public.profiles where role = 'super_admin' and id <> old.id
     ) then
    raise exception 'At least one super_admin must remain'
      using errcode = '23514';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_profiles_keep_super_admin on public.profiles;
create trigger trg_profiles_keep_super_admin
  before update of role or delete on public.profiles
  for each row execute function public.profiles_keep_super_admin();

-- Users still cannot touch their own privileged columns (job_title is now protected too).
create or replace function public.profiles_protect_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') or auth.uid() is not null then
    if new.id is distinct from old.id
       or new.email is distinct from old.email
       or new.role is distinct from old.role
       or new.merchant_id is distinct from old.merchant_id
       or new.job_title is distinct from old.job_title
       or new.created_at is distinct from old.created_at then
      raise exception 'Modification of protected profile columns is not allowed'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Read policies for staff (scoped by hall). Writes stay super_admin only
-- through the existing *_admin_write policies.
-- ---------------------------------------------------------------------------
drop policy if exists "merchants_select_staff" on public.merchants;
create policy "merchants_select_staff"
  on public.merchants for select
  using (public.can_staff_access_hall(hall_id));

drop policy if exists "stands_select_staff" on public.stands;
create policy "stands_select_staff"
  on public.stands for select
  using (public.can_staff_access_hall(hall_id));

drop policy if exists "allocation_rules_select_staff" on public.allocation_rules;
create policy "allocation_rules_select_staff"
  on public.allocation_rules for select
  using (public.can_staff_access_hall(hall_id));

drop policy if exists "pennylane_syncs_select_staff" on public.pennylane_syncs;
create policy "pennylane_syncs_select_staff"
  on public.pennylane_syncs for select
  using (public.can_staff_access_hall(hall_id));

drop policy if exists "allocations_select_staff" on public.allocations;
create policy "allocations_select_staff"
  on public.allocations for select
  using (
    exists (
      select 1
      from public.service_charge_periods scp
      where scp.id = allocations.period_id
        and public.can_staff_access_hall(scp.hall_id)
    )
  );

do $$
begin
  if to_regclass('public.invoices') is not null then
    execute 'drop policy if exists "invoices_select_staff" on public.invoices';
    execute 'create policy "invoices_select_staff" on public.invoices for select
             using (exists (
               select 1 from public.merchants m
               where m.id = invoices.merchant_id
                 and public.can_staff_access_hall(m.hall_id)
             ))';
  end if;

  if to_regclass('public.payments') is not null and to_regclass('public.invoices') is not null then
    execute 'drop policy if exists "payments_select_staff" on public.payments';
    execute 'create policy "payments_select_staff" on public.payments for select
             using (exists (
               select 1
               from public.invoices i
               join public.merchants m on m.id = i.merchant_id
               where i.id = payments.invoice_id
                 and public.can_staff_access_hall(m.hall_id)
             ))';
  end if;
end;
$$;

-- A staff member can read their own scope (for display purposes).
drop policy if exists "admin_hall_permissions_select_own" on public.admin_hall_permissions;
create policy "admin_hall_permissions_select_own"
  on public.admin_hall_permissions for select
  using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Audit log of account administration (written by the backend only)
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  target_email text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_log_created_at on public.admin_audit_log(created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admin_audit_log_select_super_admin" on public.admin_audit_log;
create policy "admin_audit_log_select_super_admin"
  on public.admin_audit_log for select
  using (public.is_admin_user());

revoke all on public.admin_audit_log from anon;
revoke insert, update, delete on public.admin_audit_log from authenticated;

-- ---------------------------------------------------------------------------
-- Atomic account administration, callable by the backend (service role) only
-- ---------------------------------------------------------------------------
create or replace function public.admin_save_user_access(
  p_user_id uuid,
  p_email text,
  p_first_name text,
  p_last_name text,
  p_role public.user_role,
  p_job_title text,
  p_merchant_id uuid,
  p_hall_ids uuid[],
  p_active boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(p_email));
  v_halls uuid[] := coalesce(
    (select array_agg(distinct h) from unnest(coalesce(p_hall_ids, '{}'::uuid[])) as h), '{}'::uuid[]
  );
begin
  if p_role = 'admin' then
    raise exception 'The legacy admin role cannot be assigned' using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Unknown auth user' using errcode = '22023';
  end if;

  if p_role = 'merchant' then
    if p_merchant_id is null or cardinality(v_halls) > 0 then
      raise exception 'A merchant account needs a merchant and no hall scope' using errcode = '22023';
    end if;
    if not exists (select 1 from public.merchants where id = p_merchant_id) then
      raise exception 'Unknown merchant' using errcode = '22023';
    end if;
  else
    if p_merchant_id is not null then
      raise exception 'Only merchant accounts can be linked to a merchant' using errcode = '22023';
    end if;
    if p_role = 'hall_manager' and cardinality(v_halls) <> 1 then
      raise exception 'A hall_manager needs exactly one hall' using errcode = '22023';
    end if;
    if p_role = 'network_manager' and cardinality(v_halls) < 1 then
      raise exception 'A network_manager needs at least one hall' using errcode = '22023';
    end if;
    if p_role in ('hq', 'super_admin') and cardinality(v_halls) > 0 then
      raise exception 'hq and super_admin accounts see every hall: no hall scope allowed' using errcode = '22023';
    end if;
    if (select count(*) from public.halls where id = any(v_halls)) <> cardinality(v_halls) then
      raise exception 'Unknown hall' using errcode = '22023';
    end if;
  end if;

  -- Order matters: scopes are cleared before the role changes, then re-created for the new role.
  delete from public.admin_hall_permissions where profile_id = p_user_id;

  insert into public.profiles (id, email, first_name, last_name, role, merchant_id, job_title)
  values (p_user_id, v_email, p_first_name, p_last_name, p_role, p_merchant_id, nullif(btrim(p_job_title), ''))
  on conflict (id) do update
    set email = excluded.email,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        role = excluded.role,
        merchant_id = excluded.merchant_id,
        job_title = excluded.job_title;

  insert into public.portal_access (
    email, first_name, last_name, role, merchant_id, job_title, user_id, active, provisioned_at
  )
  values (
    v_email, p_first_name, p_last_name, p_role, p_merchant_id, nullif(btrim(p_job_title), ''),
    p_user_id, p_active, now()
  )
  on conflict (email) do update
    set first_name = excluded.first_name,
        last_name = excluded.last_name,
        role = excluded.role,
        merchant_id = excluded.merchant_id,
        job_title = excluded.job_title,
        user_id = excluded.user_id,
        active = excluded.active;

  if p_role in ('hall_manager', 'network_manager') then
    insert into public.admin_hall_permissions (profile_id, hall_id)
    select p_user_id, h from unnest(v_halls) as h;
  end if;

  if not exists (
    select 1
    from public.profiles p
    join public.portal_access pa on pa.user_id = p.id
    where p.role = 'super_admin' and pa.active
  ) then
    raise exception 'At least one active super_admin must remain' using errcode = '23514';
  end if;
end;
$$;

revoke execute on function public.admin_save_user_access(
  uuid, text, text, text, public.user_role, text, uuid, uuid[], boolean
) from public, anon, authenticated;
grant execute on function public.admin_save_user_access(
  uuid, text, text, text, public.user_role, text, uuid, uuid[], boolean
) to service_role;

-- ---------------------------------------------------------------------------
-- Function privileges for the new helpers
-- ---------------------------------------------------------------------------
revoke execute on function
  public.is_staff_user(),
  public.can_staff_access_hall(uuid),
  public.has_active_portal_access()
from public, anon;

grant execute on function
  public.is_staff_user(),
  public.can_staff_access_hall(uuid),
  public.has_active_portal_access()
to authenticated, service_role;

notify pgrst, 'reload schema';
