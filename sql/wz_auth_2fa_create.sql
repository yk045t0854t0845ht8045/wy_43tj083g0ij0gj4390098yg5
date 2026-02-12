-- Tabela dedicada para autenticacao em duas etapas (TOTP).
-- Fonte principal usada pelo endpoint /api/wz_users/two-factor.

create table if not exists public.wz_auth_2fa (
  user_id text,
  enabled boolean not null default false,
  secret text,
  enabled_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.wz_auth_2fa
  add column if not exists user_id text,
  add column if not exists enabled boolean not null default false,
  add column if not exists secret text,
  add column if not exists enabled_at timestamptz,
  add column if not exists disabled_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Garante chave de conflito para upsert (onConflict: user_id).
create unique index if not exists wz_auth_2fa_user_id_uidx
  on public.wz_auth_2fa (user_id);

create or replace function public.wz_auth_2fa_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_wz_auth_2fa_set_updated_at on public.wz_auth_2fa;
create trigger trg_wz_auth_2fa_set_updated_at
before update on public.wz_auth_2fa
for each row
execute function public.wz_auth_2fa_set_updated_at();

-- Backfill a partir de public.wz_users (quando existir), sem quebrar em schemas antigos.
do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'wz_users'
  ) then
    return;
  end if;

  execute $sql$
    insert into public.wz_auth_2fa (
      user_id,
      enabled,
      secret,
      enabled_at,
      disabled_at
    )
    select
      coalesce(
        nullif(btrim(to_jsonb(u) ->> 'auth_user_id'), ''),
        nullif(btrim(to_jsonb(u) ->> 'user_id'), ''),
        nullif(btrim(to_jsonb(u) ->> 'id'), '')
      ) as user_id,
      (
        lower(coalesce(to_jsonb(u) ->> 'two_factor_enabled', 'false')) in ('true', 't', '1')
        and nullif(
          upper(regexp_replace(coalesce(to_jsonb(u) ->> 'two_factor_secret', ''), '[^A-Za-z2-7]', '', 'g')),
          ''
        ) is not null
      ) as enabled,
      nullif(
        upper(regexp_replace(coalesce(to_jsonb(u) ->> 'two_factor_secret', ''), '[^A-Za-z2-7]', '', 'g')),
        ''
      ) as secret,
      case
        when lower(coalesce(to_jsonb(u) ->> 'two_factor_enabled', 'false')) in ('true', 't', '1')
          then nullif(to_jsonb(u) ->> 'two_factor_enabled_at', '')::timestamptz
        else null
      end as enabled_at,
      case
        when lower(coalesce(to_jsonb(u) ->> 'two_factor_enabled', 'false')) in ('true', 't', '1')
          then null
        else nullif(to_jsonb(u) ->> 'two_factor_disabled_at', '')::timestamptz
      end as disabled_at
    from public.wz_users u
    where coalesce(
      nullif(btrim(to_jsonb(u) ->> 'auth_user_id'), ''),
      nullif(btrim(to_jsonb(u) ->> 'user_id'), ''),
      nullif(btrim(to_jsonb(u) ->> 'id'), '')
    ) is not null
    on conflict (user_id) do update
    set
      enabled = excluded.enabled,
      secret = excluded.secret,
      enabled_at = excluded.enabled_at,
      disabled_at = excluded.disabled_at,
      updated_at = now();
  $sql$;
exception
  when others then
    raise notice 'wz_auth_2fa backfill ignorado: %', sqlerrm;
end;
$$;
