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

-- Limpa dados invalidos/duplicados para permitir chave unica em user_id.
delete from public.wz_auth_2fa
where user_id is null
   or btrim(user_id) = '';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wz_auth_2fa'
      and column_name = 'updated_at'
  ) then
    with ranked as (
      select
        ctid,
        row_number() over (
          partition by user_id
          order by updated_at desc nulls last, created_at desc nulls last, ctid desc
        ) as rn
      from public.wz_auth_2fa
    )
    delete from public.wz_auth_2fa t
    using ranked r
    where t.ctid = r.ctid
      and r.rn > 1;
  else
    with ranked as (
      select
        ctid,
        row_number() over (
          partition by user_id
          order by created_at desc nulls last, ctid desc
        ) as rn
      from public.wz_auth_2fa
    )
    delete from public.wz_auth_2fa t
    using ranked r
    where t.ctid = r.ctid
      and r.rn > 1;
  end if;
end;
$$;

alter table if exists public.wz_auth_2fa
  alter column user_id set not null;

-- Garante chave de conflito para upsert (onConflict: user_id).
drop index if exists public.wz_auth_2fa_user_id_uidx;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'wz_auth_2fa'
      and c.conname = 'wz_auth_2fa_user_id_key'
  ) then
    alter table public.wz_auth_2fa
      add constraint wz_auth_2fa_user_id_key unique (user_id);
  end if;
end;
$$;

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
