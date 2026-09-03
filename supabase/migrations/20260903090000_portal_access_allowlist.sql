-- Portal access allowlist: only listed stand tenants can hold an account.
-- Accounts are provisioned by an operator script (service role); self-signup must be
-- disabled in the Supabase Auth settings for this allowlist to be authoritative.

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

-- A user may read only their own allowlist entry; admins read everything.
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
