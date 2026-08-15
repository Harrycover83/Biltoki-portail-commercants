-- Allow merchant users to access multiple halls while preserving admin access behavior.

create table if not exists public.merchant_hall_permissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  hall_id uuid not null references public.halls(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, hall_id)
);

create index if not exists idx_merchant_hall_permissions_profile_id
  on public.merchant_hall_permissions(profile_id);

create index if not exists idx_merchant_hall_permissions_hall_id
  on public.merchant_hall_permissions(hall_id);

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

alter table public.merchant_hall_permissions enable row level security;

drop policy if exists "merchant_hall_permissions_select_own" on public.merchant_hall_permissions;
create policy "merchant_hall_permissions_select_own"
  on public.merchant_hall_permissions for select
  using (profile_id = auth.uid() or public.is_admin_user());

drop policy if exists "merchant_hall_permissions_admin_write" on public.merchant_hall_permissions;
create policy "merchant_hall_permissions_admin_write"
  on public.merchant_hall_permissions for all
  using (public.is_admin_user())
  with check (public.is_admin_user());
