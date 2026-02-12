-- Passkeys / Windows Hello para a conta.
-- Usado pelo endpoint /api/wz_users/passkeys.

create table if not exists public.wz_auth_passkeys (
  id bigserial primary key,
  user_id text not null,
  email text,
  credential_id text not null,
  label text,
  transports text[] not null default '{}',
  sign_count bigint not null default 0,
  attestation_object text,
  client_data_json text,
  authenticator_data text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table if exists public.wz_auth_passkeys
  add column if not exists id bigserial,
  add column if not exists user_id text,
  add column if not exists email text,
  add column if not exists credential_id text,
  add column if not exists label text,
  add column if not exists transports text[] not null default '{}',
  add column if not exists sign_count bigint not null default 0,
  add column if not exists attestation_object text,
  add column if not exists client_data_json text,
  add column if not exists authenticator_data text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_used_at timestamptz;

create unique index if not exists wz_auth_passkeys_credential_id_uidx
  on public.wz_auth_passkeys (credential_id);

create index if not exists wz_auth_passkeys_user_id_idx
  on public.wz_auth_passkeys (user_id);

create or replace function public.wz_auth_passkeys_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_wz_auth_passkeys_set_updated_at on public.wz_auth_passkeys;
create trigger trg_wz_auth_passkeys_set_updated_at
before update on public.wz_auth_passkeys
for each row
execute function public.wz_auth_passkeys_set_updated_at();
