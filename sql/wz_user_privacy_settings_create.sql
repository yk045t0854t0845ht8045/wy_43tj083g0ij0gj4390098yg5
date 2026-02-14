-- Preferencias de dados e privacidade por usuario.
-- Execute este arquivo uma vez no Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.wz_user_privacy_settings (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  wz_user_id text,
  email text not null,

  required_data_processing boolean not null default true,
  required_security_and_fraud boolean not null default true,
  required_legal_compliance boolean not null default true,
  required_transactional_communications boolean not null default true,

  optional_product_analytics boolean not null default true,
  optional_personalized_experience boolean not null default true,
  optional_marketing_communications boolean not null default false,
  optional_sponsor_marketing boolean not null default false,
  optional_third_party_personalization boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.wz_user_privacy_settings
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id text,
  add column if not exists wz_user_id text,
  add column if not exists email text,
  add column if not exists required_data_processing boolean not null default true,
  add column if not exists required_security_and_fraud boolean not null default true,
  add column if not exists required_legal_compliance boolean not null default true,
  add column if not exists required_transactional_communications boolean not null default true,
  add column if not exists optional_product_analytics boolean not null default true,
  add column if not exists optional_personalized_experience boolean not null default true,
  add column if not exists optional_marketing_communications boolean not null default false,
  add column if not exists optional_sponsor_marketing boolean not null default false,
  add column if not exists optional_third_party_personalization boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists wz_user_privacy_settings_user_id_uidx
  on public.wz_user_privacy_settings (user_id);

create index if not exists wz_user_privacy_settings_wz_user_id_idx
  on public.wz_user_privacy_settings (wz_user_id);

create index if not exists wz_user_privacy_settings_email_idx
  on public.wz_user_privacy_settings (email);

create index if not exists wz_user_privacy_settings_updated_at_idx
  on public.wz_user_privacy_settings (updated_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'wz_user_privacy_settings_required_chk'
      and conrelid = 'public.wz_user_privacy_settings'::regclass
  ) then
    alter table public.wz_user_privacy_settings
      add constraint wz_user_privacy_settings_required_chk
      check (
        required_data_processing = true
        and required_security_and_fraud = true
        and required_legal_compliance = true
        and required_transactional_communications = true
      );
  end if;
end;
$$;

create or replace function public.wz_user_privacy_settings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_wz_user_privacy_settings_set_updated_at on public.wz_user_privacy_settings;
create trigger trg_wz_user_privacy_settings_set_updated_at
before update on public.wz_user_privacy_settings
for each row
execute function public.wz_user_privacy_settings_set_updated_at();
