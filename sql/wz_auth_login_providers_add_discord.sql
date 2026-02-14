-- Permite registrar o provedor Discord na tabela wz_auth_login_providers.

alter table if exists public.wz_auth_login_providers
  drop constraint if exists wz_auth_login_providers_provider_chk;

alter table if exists public.wz_auth_login_providers
  add constraint wz_auth_login_providers_provider_chk
  check (
    provider in (
      'password',
      'google',
      'discord',
      'apple',
      'github',
      'microsoft',
      'unknown'
    )
  );
