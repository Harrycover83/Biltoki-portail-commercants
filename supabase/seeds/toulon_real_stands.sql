begin;

do $$
declare
  v_hall_id uuid;
  v_names text[] := array[
    'Bar a viande',
    'Balme',
    'All angus',
    'Chez Molinari',
    'La casa pincho',
    'Les tontons fromton',
    'Criee raynier',
    'Le rouget noir',
    'Baraka',
    'Le canon',
    'A casa corsa',
    'Falafels factory',
    'Emana pizza',
    'Chez elles',
    'Bar biltoki',
    'Easy sushi'
  ];
  v_name text;
  v_merchant_id uuid;
  v_index integer := 0;
begin
  select id
  into v_hall_id
  from public.halls
  where lower(name) like '%toulon%'
  order by created_at asc
  limit 1;

  if v_hall_id is null then
    raise exception 'Halle de Toulon introuvable. Creez la halle avant ce seed.';
  end if;

  foreach v_name in array v_names loop
    v_index := v_index + 1;

    insert into public.merchants (hall_id, legal_name, trade_name, active)
    values (v_hall_id, v_name, v_name, true)
    on conflict (hall_id, legal_name)
    do update set
      trade_name = excluded.trade_name,
      active = true
    returning id into v_merchant_id;

    if v_merchant_id is null then
      select id
      into v_merchant_id
      from public.merchants
      where hall_id = v_hall_id
        and legal_name = v_name
      limit 1;
    end if;

    if not exists (
      select 1
      from public.stands s
      where s.hall_id = v_hall_id
        and s.merchant_id = v_merchant_id
        and lower(s.name) = lower(v_name)
    ) then
      insert into public.stands (
        hall_id,
        merchant_id,
        name,
        number,
        linear_meters,
        start_date,
        active
      )
      values (
        v_hall_id,
        v_merchant_id,
        v_name,
        'T' || lpad(v_index::text, 2, '0'),
        8.000,
        current_date,
        true
      );
    end if;
  end loop;
end $$;

commit;
