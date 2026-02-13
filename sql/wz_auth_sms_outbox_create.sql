-- Fila de fallback para envio de SMS quando o webhook selfhost estiver indisponivel.
-- Execute este script uma vez no banco (Supabase SQL editor).

create extension if not exists pgcrypto;

create table if not exists public.wz_auth_sms_outbox (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  message text not null,
  context text not null default 'auth',
  provider_hint text,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  max_attempts integer not null default 8,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_by text,
  sent_at timestamptz,
  last_error text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.wz_auth_sms_outbox
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists phone_e164 text,
  add column if not exists message text,
  add column if not exists context text not null default 'auth',
  add column if not exists provider_hint text,
  add column if not exists status text not null default 'pending',
  add column if not exists attempt_count integer not null default 0,
  add column if not exists max_attempts integer not null default 8,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists claimed_at timestamptz,
  add column if not exists claimed_by text,
  add column if not exists sent_at timestamptz,
  add column if not exists last_error text,
  add column if not exists meta jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists wz_auth_sms_outbox_pending_idx
  on public.wz_auth_sms_outbox (status, next_attempt_at, created_at);

create index if not exists wz_auth_sms_outbox_phone_idx
  on public.wz_auth_sms_outbox (phone_e164);

create index if not exists wz_auth_sms_outbox_created_idx
  on public.wz_auth_sms_outbox (created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'wz_auth_sms_outbox_status_chk'
      and conrelid = 'public.wz_auth_sms_outbox'::regclass
  ) then
    alter table public.wz_auth_sms_outbox
      add constraint wz_auth_sms_outbox_status_chk
      check (status in ('pending', 'processing', 'sent', 'failed'));
  end if;
end;
$$;

create or replace function public.wz_auth_sms_outbox_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_wz_auth_sms_outbox_set_updated_at on public.wz_auth_sms_outbox;
create trigger trg_wz_auth_sms_outbox_set_updated_at
before update on public.wz_auth_sms_outbox
for each row
execute function public.wz_auth_sms_outbox_set_updated_at();

