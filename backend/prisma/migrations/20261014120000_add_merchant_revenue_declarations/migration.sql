-- Monthly revenue declared by each merchant.
-- A merchant reads and writes only their own months; Biltoki staff read the merchants of their halls.
-- Amounts are integer cents. Popina covers the hall's own tills, so this is the only per-merchant source.

create table if not exists public.merchant_revenue_declarations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  month date not null,
  amount_cents bigint not null,
  declared_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merchant_revenue_declarations_unique_month unique (merchant_id, month),
  constraint merchant_revenue_declarations_month_is_first_day check (month = date_trunc('month', month)::date),
  constraint merchant_revenue_declarations_amount_range check (amount_cents >= 0 and amount_cents <= 100000000000)
);

create index if not exists merchant_revenue_declarations_month_idx
  on public.merchant_revenue_declarations (month);

-- Keeps the audit columns honest: the author and the update time come from the server, never from the client.
create or replace function public.merchant_revenue_declarations_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if current_user in ('anon', 'authenticated') or auth.uid() is not null then
    new.declared_by := auth.uid();
  end if;
  if tg_op = 'UPDATE' then
    new.merchant_id := old.merchant_id;
    new.month := old.month;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_merchant_revenue_declarations_stamp on public.merchant_revenue_declarations;
create trigger trg_merchant_revenue_declarations_stamp
  before insert or update on public.merchant_revenue_declarations
  for each row execute function public.merchant_revenue_declarations_stamp();

alter table public.merchant_revenue_declarations enable row level security;

revoke all on public.merchant_revenue_declarations from anon;
revoke all on public.merchant_revenue_declarations from authenticated;
grant select, insert, update, delete on public.merchant_revenue_declarations to authenticated;

drop policy if exists "revenue_declarations_select_own" on public.merchant_revenue_declarations;
create policy "revenue_declarations_select_own"
  on public.merchant_revenue_declarations for select
  to authenticated
  using (merchant_id = public.current_merchant_id());

drop policy if exists "revenue_declarations_select_staff" on public.merchant_revenue_declarations;
create policy "revenue_declarations_select_staff"
  on public.merchant_revenue_declarations for select
  to authenticated
  using (
    public.is_staff_user()
    and exists (
      select 1 from public.merchants m
      where m.id = merchant_revenue_declarations.merchant_id
        and public.can_staff_access_hall(m.hall_id)
    )
  );

-- Months are declared once they have started, never in advance.
drop policy if exists "revenue_declarations_insert_own" on public.merchant_revenue_declarations;
create policy "revenue_declarations_insert_own"
  on public.merchant_revenue_declarations for insert
  to authenticated
  with check (
    merchant_id = public.current_merchant_id()
    and month <= date_trunc('month', now())::date
  );

drop policy if exists "revenue_declarations_update_own" on public.merchant_revenue_declarations;
create policy "revenue_declarations_update_own"
  on public.merchant_revenue_declarations for update
  to authenticated
  using (merchant_id = public.current_merchant_id())
  with check (merchant_id = public.current_merchant_id());

drop policy if exists "revenue_declarations_delete_own" on public.merchant_revenue_declarations;
create policy "revenue_declarations_delete_own"
  on public.merchant_revenue_declarations for delete
  to authenticated
  using (merchant_id = public.current_merchant_id());
