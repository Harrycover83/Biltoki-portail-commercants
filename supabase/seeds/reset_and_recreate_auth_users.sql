begin;

do $$
declare
  merchant_email constant text := 'jean.merchant@example.com';
  admin_email constant text := 'admin.biltoki@example.com';
  shared_password constant text := 'Biltoki2026';
  merchant_id uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
begin
  -- Remove old users and related identities first.
  delete from auth.identities
  where lower(provider_id) in (lower(merchant_email), lower(admin_email));

  delete from auth.users
  where lower(email) in (lower(merchant_email), lower(admin_email));

  -- Recreate merchant user.
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
    crypt(shared_password, gen_salt('bf', 10)),
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

  -- Recreate admin user.
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
    crypt(shared_password, gen_salt('bf', 10)),
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
end $$;

commit;
