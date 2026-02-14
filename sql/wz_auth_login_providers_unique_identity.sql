-- Impede que a mesma identidade OAuth seja vinculada em mais de uma conta local.
-- Execute este script apos garantir que nao existem duplicidades antigas.

-- Diagnostico rapido de duplicidades por auth_user_id.
-- select provider, auth_user_id, count(*)
-- from public.wz_auth_login_providers
-- where provider in ('google', 'discord', 'apple', 'github', 'microsoft')
--   and coalesce(btrim(auth_user_id), '') <> ''
-- group by provider, auth_user_id
-- having count(*) > 1;

-- Diagnostico rapido de duplicidades por provider_user_id.
-- select provider, provider_user_id, count(*)
-- from public.wz_auth_login_providers
-- where provider in ('google', 'discord', 'apple', 'github', 'microsoft')
--   and coalesce(btrim(provider_user_id), '') <> ''
-- group by provider, provider_user_id
-- having count(*) > 1;

create unique index if not exists wz_auth_login_providers_provider_auth_uidx
  on public.wz_auth_login_providers (provider, auth_user_id)
  where provider in ('google', 'discord', 'apple', 'github', 'microsoft')
    and auth_user_id is not null
    and btrim(auth_user_id) <> '';

create unique index if not exists wz_auth_login_providers_provider_user_uidx
  on public.wz_auth_login_providers (provider, provider_user_id)
  where provider in ('google', 'discord', 'apple', 'github', 'microsoft')
    and provider_user_id is not null
    and btrim(provider_user_id) <> '';
