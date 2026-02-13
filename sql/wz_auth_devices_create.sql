-- Registro de dispositivos e sessoes de login.
-- Execute este arquivo uma vez para habilitar o painel de dispositivos.

create extension if not exists pgcrypto;

create table if not exists public.wz_auth_user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  auth_user_id text,
  email text not null,
  device_fingerprint text not null,
  device_kind text not null default 'unknown',
  platform text,
  os_family text,
  os_version text,
  browser_family text,
  browser_version text,
  device_label text,
  user_agent text,
  first_ip text,
  last_ip text,
  first_location text,
  last_location text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  login_count bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.wz_auth_user_devices
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id text,
  add column if not exists auth_user_id text,
  add column if not exists email text,
  add column if not exists device_fingerprint text,
  add column if not exists device_kind text not null default 'unknown',
  add column if not exists platform text,
  add column if not exists os_family text,
  add column if not exists os_version text,
  add column if not exists browser_family text,
  add column if not exists browser_version text,
  add column if not exists device_label text,
  add column if not exists user_agent text,
  add column if not exists first_ip text,
  add column if not exists last_ip text,
  add column if not exists first_location text,
  add column if not exists last_location text,
  add column if not exists first_seen_at timestamptz not null default now(),
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists login_count bigint not null default 1,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists wz_auth_user_devices_user_fingerprint_uidx
  on public.wz_auth_user_devices (user_id, device_fingerprint);

create index if not exists wz_auth_user_devices_user_id_idx
  on public.wz_auth_user_devices (user_id);

create index if not exists wz_auth_user_devices_email_idx
  on public.wz_auth_user_devices (email);

create index if not exists wz_auth_user_devices_last_seen_idx
  on public.wz_auth_user_devices (last_seen_at desc);

create table if not exists public.wz_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  auth_user_id text,
  email text not null,
  sid text not null,
  did_hash text,
  device_id uuid,
  login_method text not null default 'unknown',
  login_flow text not null default 'unknown',
  is_account_creation_session boolean not null default false,
  issued_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text,
  host text,
  ip text,
  location text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.wz_auth_sessions
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id text,
  add column if not exists auth_user_id text,
  add column if not exists email text,
  add column if not exists sid text,
  add column if not exists did_hash text,
  add column if not exists device_id uuid,
  add column if not exists login_method text not null default 'unknown',
  add column if not exists login_flow text not null default 'unknown',
  add column if not exists is_account_creation_session boolean not null default false,
  add column if not exists issued_at timestamptz not null default now(),
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_reason text,
  add column if not exists host text,
  add column if not exists ip text,
  add column if not exists location text,
  add column if not exists user_agent text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists wz_auth_sessions_user_sid_uidx
  on public.wz_auth_sessions (user_id, sid);

create index if not exists wz_auth_sessions_user_id_idx
  on public.wz_auth_sessions (user_id);

create index if not exists wz_auth_sessions_user_active_idx
  on public.wz_auth_sessions (user_id, revoked_at, last_seen_at desc);

create index if not exists wz_auth_sessions_device_id_idx
  on public.wz_auth_sessions (device_id);

create index if not exists wz_auth_sessions_email_idx
  on public.wz_auth_sessions (email);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'wz_auth_sessions_device_id_fkey'
      and conrelid = 'public.wz_auth_sessions'::regclass
  ) then
    alter table public.wz_auth_sessions
      add constraint wz_auth_sessions_device_id_fkey
      foreign key (device_id)
      references public.wz_auth_user_devices(id)
      on delete set null;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'wz_auth_user_devices_kind_chk'
      and conrelid = 'public.wz_auth_user_devices'::regclass
  ) then
    alter table public.wz_auth_user_devices
      add constraint wz_auth_user_devices_kind_chk
      check (device_kind in ('desktop', 'mobile', 'tablet', 'bot', 'unknown'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'wz_auth_sessions_login_method_chk'
      and conrelid = 'public.wz_auth_sessions'::regclass
  ) then
    alter table public.wz_auth_sessions
      add constraint wz_auth_sessions_login_method_chk
      check (login_method in ('password', 'email_code', 'sms_code', 'totp', 'passkey', 'trusted', 'exchange', 'sync', 'unknown'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'wz_auth_sessions_login_flow_chk'
      and conrelid = 'public.wz_auth_sessions'::regclass
  ) then
    alter table public.wz_auth_sessions
      add constraint wz_auth_sessions_login_flow_chk
      check (login_flow in ('login', 'register', 'unknown'));
  end if;
end;
$$;

create or replace function public.wz_auth_devices_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_wz_auth_user_devices_set_updated_at on public.wz_auth_user_devices;
create trigger trg_wz_auth_user_devices_set_updated_at
before update on public.wz_auth_user_devices
for each row
execute function public.wz_auth_devices_set_updated_at();

drop trigger if exists trg_wz_auth_sessions_set_updated_at on public.wz_auth_sessions;
create trigger trg_wz_auth_sessions_set_updated_at
before update on public.wz_auth_sessions
for each row
execute function public.wz_auth_devices_set_updated_at();

-- Compatibilidade com trusted devices ja existente no projeto.
alter table if exists public.wz_auth_trusted_devices
  add column if not exists user_id text,
  add column if not exists auth_user_id text,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_reason text;

create index if not exists wz_auth_trusted_devices_user_id_idx
  on public.wz_auth_trusted_devices (user_id);

create index if not exists wz_auth_trusted_devices_email_expires_idx
  on public.wz_auth_trusted_devices (email, expires_at desc);
