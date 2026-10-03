-- Security audit follow-ups.
--   1. A forced password change (app_metadata.must_change_password, writable by the service role
--      only) now blocks all data access until the password has been rotated.
--   2. Concurrent demotions/deactivations can no longer leave the tool without a super_admin.
--   3. Helper to revoke every session of a user (password reset, deactivation).

-- ---------------------------------------------------------------------------
-- 1. Forced password change enforced by the database
-- ---------------------------------------------------------------------------
-- Every RLS helper relies on this function, so a user whose token still carries the flag
-- cannot read or write anything through the API, only refresh their own profile/allowlist rows
-- needed to display the "change your password" screen.
create or replace function public.has_active_portal_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'must_change_password', 'false') <> 'true'
    and exists (
      select 1
      from public.profiles p
      join public.portal_access pa
        on pa.user_id = p.id or lower(pa.email) = lower(p.email)
      where p.id = auth.uid()
        and pa.active
    );
$$;

-- ---------------------------------------------------------------------------
-- 2. Serialize changes that could remove the last super_admin
-- ---------------------------------------------------------------------------
-- The lock is held until the end of the transaction, so the "is there another super_admin?"
-- check of a second concurrent transaction runs after the first one has committed.
create or replace function public.profiles_keep_super_admin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('biltoki.super_admin_guard'));

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

-- ---------------------------------------------------------------------------
-- 3. Session revocation (service role only)
-- ---------------------------------------------------------------------------
create or replace function public.admin_revoke_user_sessions(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('auth.refresh_tokens') is not null then
    delete from auth.refresh_tokens where user_id::text = p_user_id::text;
  end if;
  if to_regclass('auth.sessions') is not null then
    delete from auth.sessions where user_id = p_user_id;
  end if;
end;
$$;

revoke execute on function public.admin_revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.admin_revoke_user_sessions(uuid) to service_role;

notify pgrst, 'reload schema';
