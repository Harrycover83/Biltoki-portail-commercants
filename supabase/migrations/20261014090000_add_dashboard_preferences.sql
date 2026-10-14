-- Personal dashboard layout: which widgets each staff member shows, and in which order.
-- A user only ever reads and writes their own row; the layout carries no data access, it is display-only.

create table if not exists public.dashboard_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  widgets jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint dashboard_preferences_widgets_is_array check (jsonb_typeof(widgets) = 'array')
);

alter table public.dashboard_preferences enable row level security;

drop policy if exists "dashboard_preferences_select_own" on public.dashboard_preferences;
create policy "dashboard_preferences_select_own"
  on public.dashboard_preferences for select
  to authenticated
  using (profile_id = auth.uid());

drop policy if exists "dashboard_preferences_insert_own" on public.dashboard_preferences;
create policy "dashboard_preferences_insert_own"
  on public.dashboard_preferences for insert
  to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "dashboard_preferences_update_own" on public.dashboard_preferences;
create policy "dashboard_preferences_update_own"
  on public.dashboard_preferences for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "dashboard_preferences_delete_own" on public.dashboard_preferences;
create policy "dashboard_preferences_delete_own"
  on public.dashboard_preferences for delete
  to authenticated
  using (profile_id = auth.uid());

revoke all on public.dashboard_preferences from anon;
