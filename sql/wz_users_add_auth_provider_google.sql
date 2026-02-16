-- Suporte a contas criadas por OAuth (Google) e obrigacao de criar senha local.

alter table if exists public.wz_users
  add column if not exists auth_provider text,
  add column if not exists must_create_password boolean not null default false,
  add column if not exists password_created boolean not null default false;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'wz_users'
  ) then
    execute $sql$
      update public.wz_users
      set auth_provider = 'password'
      where coalesce(trim(auth_provider), '') = ''
    $sql$;
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.wz_users') is null then
    return;
  end if;

  update public.wz_users
  set password_created = true
  where password_created is distinct from true
    and must_create_password is false;
end;
$$;

alter table if exists public.wz_users
  alter column auth_provider set default 'password';

alter table if exists public.wz_users
  drop constraint if exists wz_users_auth_provider_chk;

-- Normaliza provedores legados para evitar falha ao recriar a constraint.
do $$
begin
  if to_regclass('public.wz_users') is null then
    return;
  end if;

  update public.wz_users
  set auth_provider = case
    when coalesce(nullif(btrim(lower(auth_provider)), ''), 'password') in (
      'password',
      'google',
      'apple',
      'github',
      'unknown'
    ) then coalesce(nullif(btrim(lower(auth_provider)), ''), 'password')
    else 'unknown'
  end
  where
    auth_provider is null
    or auth_provider <> btrim(lower(auth_provider))
    or btrim(lower(auth_provider)) = ''
    or btrim(lower(auth_provider)) not in (
      'password',
      'google',
      'apple',
      'github',
      'unknown'
    );
end;
$$;

alter table if exists public.wz_users
  add constraint wz_users_auth_provider_chk
  check (auth_provider in ('password', 'google', 'apple', 'github', 'unknown'));
