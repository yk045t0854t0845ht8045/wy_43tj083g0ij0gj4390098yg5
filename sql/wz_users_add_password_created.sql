-- Persistencia robusta para indicar se a conta ja possui senha local criada.
--
-- Objetivo:
-- - evitar falso-positivo de "criar senha novamente" apos logout/F5
-- - manter sincronia com must_create_password quando houver evidencias de senha

alter table if exists public.wz_users
  add column if not exists password_created boolean not null default false;

do $$
declare
  has_wz_users boolean;
  has_must_create_password boolean;
  has_password_changed_at boolean;
  has_login_providers boolean;
  has_auth_users boolean;
begin
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'wz_users'
  )
  into has_wz_users;

  if not has_wz_users then
    return;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wz_users'
      and column_name = 'must_create_password'
  )
  into has_must_create_password;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wz_users'
      and column_name = 'password_changed_at'
  )
  into has_password_changed_at;

  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'wz_auth_login_providers'
  )
  into has_login_providers;

  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'auth'
      and table_name = 'users'
  )
  into has_auth_users;

  -- 1) Se o perfil ja marca que nao precisa criar senha, considera senha criada.
  if has_must_create_password then
    update public.wz_users
    set password_created = true
    where password_created is distinct from true
      and must_create_password is false;
  end if;

  -- 2) Se ja houve alteracao de senha, senha claramente existe.
  if has_password_changed_at then
    update public.wz_users
    set password_created = true
    where password_created is distinct from true
      and password_changed_at is not null;
  end if;

  -- 3) Se existe vinculo de provedor interno de senha, marca como criada.
  if has_login_providers then
    update public.wz_users u
    set password_created = true
    from public.wz_auth_login_providers p
    where u.password_created is distinct from true
      and p.user_id::text = btrim(u.id::text)
      and lower(coalesce(p.provider, '')) = 'password';
  end if;

  -- 4) Fonte forte: Supabase Auth indica provider email/password.
  if has_auth_users then
    update public.wz_users u
    set password_created = true
    from auth.users au
    where u.password_created is distinct from true
      and coalesce(btrim(u.auth_user_id), '') <> ''
      and au.id::text = btrim(u.auth_user_id)
      and (
        lower(coalesce(au.raw_app_meta_data ->> 'provider', '')) in ('email', 'password')
        or exists (
          select 1
          from jsonb_array_elements_text(
            coalesce(au.raw_app_meta_data -> 'providers', '[]'::jsonb)
          ) as p(provider_name)
          where lower(p.provider_name) in ('email', 'password')
        )
      );
  end if;

  -- 5) Mantem consistencia entre as duas flags.
  if has_must_create_password then
    update public.wz_users
    set must_create_password = false
    where password_created = true
      and must_create_password is distinct from false;
  end if;
end;
$$;
