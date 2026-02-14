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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'wz_auth_login_providers_provider_chk'
      and conrelid = 'public.wz_auth_login_providers'::regclass
  ) then
    alter table public.wz_auth_login_providers
      add constraint wz_auth_login_providers_provider_chk
      check (provider in ('password', 'google', 'apple', 'github', 'microsoft', 'unknown'));
  end if;
end;
$$;

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
