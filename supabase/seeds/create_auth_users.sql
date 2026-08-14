begin;

do $$
declare
  merchant_email constant text := 'jean.merchant@example.com';
  admin_email constant text := 'admin.biltoki@example.com';
  merchant_password constant text := 'TempM3rchant!2026';
  admin_password constant text := 'TempAdm1n!2026';
  merchant_id uuid;
  admin_id uuid;
begin
  select id into merchant_id
  from auth.users
  where lower(email) = lower(merchant_email)
  limit 1;

  if merchant_id is null then
    merchant_id := gen_random_uuid();

    insert into auth.users (
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      is_sso_user,
      is_anonymous
    )
    values (
      merchant_id,
      'authenticated',
      'authenticated',
      merchant_email,
      crypt(merchant_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now(),
      false,
      false
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      merchant_id,
      jsonb_build_object(
        'sub', merchant_id::text,
        'email', merchant_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      merchant_email,
      now(),
      now(),
      now()
    );
  end if;

  select id into admin_id
  from auth.users
  where lower(email) = lower(admin_email)
  limit 1;

  if admin_id is null then
    admin_id := gen_random_uuid();

    insert into auth.users (
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      is_sso_user,
      is_anonymous
    )
    values (
      admin_id,
      'authenticated',
      'authenticated',
      admin_email,
      crypt(admin_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now(),
      false,
      false
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      admin_id,
      jsonb_build_object(
        'sub', admin_id::text,
        'email', admin_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      admin_email,
      now(),
      now(),
      now()
    );
  end if;
end $$;

commit;
