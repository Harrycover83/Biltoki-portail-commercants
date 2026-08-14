begin;

update auth.users
set
  encrypted_password = crypt('BiltokiTest!2026', gen_salt('bf')),
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  updated_at = now()
where lower(email) in ('jean.merchant@example.com', 'admin.biltoki@example.com');

commit;
