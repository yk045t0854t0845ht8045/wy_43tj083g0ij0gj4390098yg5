-- Permite registrar contas OAuth com provedor Discord em wz_users.

alter table if exists public.wz_users
  drop constraint if exists wz_users_auth_provider_chk;

alter table if exists public.wz_users
  add constraint wz_users_auth_provider_chk
  check (
    auth_provider in (
      'password',
      'google',
      'discord',
      'apple',
      'github',
      'microsoft',
      'unknown'
    )
  );
