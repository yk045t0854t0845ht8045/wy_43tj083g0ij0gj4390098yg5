-- Codigos de recuperacao da autenticacao em 2 etapas.
-- Cada codigo e de uso unico, 6 digitos, sem expiracao.
-- Usado pelos endpoints de 2FA/login (fallback quando TOTP falhar).

create table if not exists public.wz_auth_2fa_recovery_codes (
  id bigserial primary key,
  user_id text not null,
  code_hash text not null,
  salt text not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.wz_auth_2fa_recovery_codes
  add column if not exists id bigserial,
  add column if not exists user_id text,
  add column if not exists code_hash text,
  add column if not exists salt text,
  add column if not exists used_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists wz_auth_2fa_recovery_codes_user_id_idx
  on public.wz_auth_2fa_recovery_codes (user_id);

create index if not exists wz_auth_2fa_recovery_codes_user_unused_idx
  on public.wz_auth_2fa_recovery_codes (user_id, used_at);

create or replace function public.wz_auth_2fa_recovery_codes_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_wz_auth_2fa_recovery_codes_set_updated_at on public.wz_auth_2fa_recovery_codes;
create trigger trg_wz_auth_2fa_recovery_codes_set_updated_at
before update on public.wz_auth_2fa_recovery_codes
for each row
execute function public.wz_auth_2fa_recovery_codes_set_updated_at();
