-- Registro dos provedores de login vinculados por conta (Google, senha, etc).
-- Utilizado na aba "Aplicativos Autorizados" e auditoria de autenticao.

create extension if not exists pgcrypto;

create table if not exists public.wz_auth_login_providers (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  auth_user_id text,
  email text not null,
  provider text not null default 'unknown',
  provider_user_id text,
  linked_at timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.wz_auth_login_providers
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id text,
  add column if not exists auth_user_id text,
  add column if not exists email text,
  add column if not exists provider text not null default 'unknown',
  add column if not exists provider_user_id text,
  add column if not exists linked_at timestamptz not null default now(),
  add column if not exists last_login_at timestamptz not null default now(),
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists wz_auth_login_providers_user_provider_uidx
  on public.wz_auth_login_providers (user_id, provider);

create index if not exists wz_auth_login_providers_user_id_idx
  on public.wz_auth_login_providers (user_id);

create index if not exists wz_auth_login_providers_auth_user_id_idx
  on public.wz_auth_login_providers (auth_user_id);

create index if not exists wz_auth_login_providers_email_idx
  on public.wz_auth_login_providers (email);

create index if not exists wz_auth_login_providers_last_login_idx
  on public.wz_auth_login_providers (last_login_at desc);

-- Impede que a mesma identidade OAuth externa seja vinculada a mais de uma conta.
-- Em bases legadas com duplicidade antiga, nao quebra o script: apenas alerta.
do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'wz_auth_login_providers_provider_auth_uidx'
  ) then
    if exists (
      select 1
      from public.wz_auth_login_providers
      where provider in ('google', 'azure', 'apple', 'github')
        and auth_user_id is not null
        and btrim(auth_user_id) <> ''
      group by provider, auth_user_id
      having count(*) > 1
    ) then
      raise warning 'Nao foi possivel criar wz_auth_login_providers_provider_auth_uidx: existem duplicidades antigas (provider + auth_user_id).';
    else
      create unique index wz_auth_login_providers_provider_auth_uidx
        on public.wz_auth_login_providers (provider, auth_user_id)
        where provider in ('google', 'azure', 'apple', 'github')
          and auth_user_id is not null
          and btrim(auth_user_id) <> '';
    end if;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'wz_auth_login_providers_provider_user_uidx'
  ) then
    if exists (
      select 1
      from public.wz_auth_login_providers
      where provider in ('google', 'azure', 'apple', 'github')
        and provider_user_id is not null
        and btrim(provider_user_id) <> ''
      group by provider, provider_user_id
      having count(*) > 1
    ) then
      raise warning 'Nao foi possivel criar wz_auth_login_providers_provider_user_uidx: existem duplicidades antigas (provider + provider_user_id).';
    else
      create unique index wz_auth_login_providers_provider_user_uidx
        on public.wz_auth_login_providers (provider, provider_user_id)
        where provider in ('google', 'azure', 'apple', 'github')
          and provider_user_id is not null
          and btrim(provider_user_id) <> '';
    end if;
  end if;
end;
$$;

-- Normaliza provedores legados para evitar falha ao adicionar a constraint.
update public.wz_auth_login_providers
set provider = case
  when coalesce(nullif(btrim(lower(provider)), ''), 'unknown') in (
    'password',
    'google',
    'azure',
    'apple',
    'github',
    'unknown'
  ) then coalesce(nullif(btrim(lower(provider)), ''), 'unknown')
  else 'unknown'
end
where
  provider is null
  or provider <> btrim(lower(provider))
  or btrim(lower(provider)) = ''
  or btrim(lower(provider)) not in (
    'password',
    'google',
    'azure',
    'apple',
    'github',
    'unknown'
  );

alter table if exists public.wz_auth_login_providers
  drop constraint if exists wz_auth_login_providers_provider_chk;

alter table if exists public.wz_auth_login_providers
  add constraint wz_auth_login_providers_provider_chk
  check (provider in ('password', 'google', 'azure', 'apple', 'github', 'unknown'));

create or replace function public.wz_auth_login_providers_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_wz_auth_login_providers_set_updated_at on public.wz_auth_login_providers;
create trigger trg_wz_auth_login_providers_set_updated_at
before update on public.wz_auth_login_providers
for each row
execute function public.wz_auth_login_providers_set_updated_at();
