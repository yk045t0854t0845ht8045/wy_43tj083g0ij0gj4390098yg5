-- Impede que a mesma identidade OAuth seja vinculada em mais de uma conta local.
-- Limpa duplicidades antigas e cria indices de unicidade por identidade externa.

-- Diagnostico rapido de duplicidades por auth_user_id.
-- select provider, auth_user_id, count(*)
-- from public.wz_auth_login_providers
-- where provider in ('google', 'apple', 'github')
--   and coalesce(btrim(auth_user_id), '') <> ''
-- group by provider, auth_user_id
-- having count(*) > 1;

-- Diagnostico rapido de duplicidades por provider_user_id.
-- select provider, provider_user_id, count(*)
-- from public.wz_auth_login_providers
-- where provider in ('google', 'apple', 'github')
--   and coalesce(btrim(provider_user_id), '') <> ''
-- group by provider, provider_user_id
-- having count(*) > 1;

-- Mantem apenas o registro mais recente por (provider, auth_user_id).
with ranked as (
  select
    ctid,
    row_number() over (
      partition by provider, auth_user_id
      order by
        last_login_at desc nulls last,
        linked_at desc nulls last,
        updated_at desc nulls last,
        created_at desc nulls last,
        ctid desc
    ) as rn
  from public.wz_auth_login_providers
  where provider in ('google', 'apple', 'github')
    and auth_user_id is not null
    and btrim(auth_user_id) <> ''
)
delete from public.wz_auth_login_providers t
using ranked r
where t.ctid = r.ctid
  and r.rn > 1;

-- Mantem apenas o registro mais recente por (provider, provider_user_id).
with ranked as (
  select
    ctid,
    row_number() over (
      partition by provider, provider_user_id
      order by
        last_login_at desc nulls last,
        linked_at desc nulls last,
        updated_at desc nulls last,
        created_at desc nulls last,
        ctid desc
    ) as rn
  from public.wz_auth_login_providers
  where provider in ('google', 'apple', 'github')
    and provider_user_id is not null
    and btrim(provider_user_id) <> ''
)
delete from public.wz_auth_login_providers t
using ranked r
where t.ctid = r.ctid
  and r.rn > 1;

create unique index if not exists wz_auth_login_providers_provider_auth_uidx
  on public.wz_auth_login_providers (provider, auth_user_id)
  where provider in ('google', 'apple', 'github')
    and auth_user_id is not null
    and btrim(auth_user_id) <> '';

create unique index if not exists wz_auth_login_providers_provider_user_uidx
  on public.wz_auth_login_providers (provider, provider_user_id)
  where provider in ('google', 'apple', 'github')
    and provider_user_id is not null
    and btrim(provider_user_id) <> '';
