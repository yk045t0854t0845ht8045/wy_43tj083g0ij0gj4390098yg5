-- Corrige contas ja afetadas pelo bug de OAuth que marcou
-- must_create_password=true mesmo com senha local existente.
--
-- Execute em producao uma vez apos publicar o patch de codigo.

do $$
declare
  has_wz_users boolean;
  has_must_create_password boolean;
  has_password_created boolean;
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
      and column_name = 'password_created'
  )
  into has_password_created;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wz_users'
      and column_name = 'must_create_password'
  )
  into has_must_create_password;

  if not has_must_create_password then
    return;
  end if;

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

  -- 1) Fonte mais forte: identidade de senha no Supabase Auth.
  if has_auth_users then
    update public.wz_users u
    set must_create_password = false
    from auth.users au
    where u.must_create_password is distinct from false
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

  -- 2) Se existe registro de provedor interno, tambem nao exige criacao de senha.
  if has_login_providers then
    update public.wz_users u
    set must_create_password = false
    from public.wz_auth_login_providers p
    where u.must_create_password is distinct from false
      and p.user_id::text = btrim(u.id::text)
      and lower(coalesce(p.provider, '')) = 'password';
  end if;

  -- 2.1) Remove registro stale de provedor password quando o Auth nao tem
  -- identidade de senha para aquele auth_user_id.
  if has_login_providers and has_auth_users then
    delete from public.wz_auth_login_providers p
    using public.wz_users u, auth.users au
    where p.user_id::text = btrim(u.id::text)
      and lower(coalesce(p.provider, '')) = 'password'
      and coalesce(btrim(u.auth_user_id), '') <> ''
      and au.id::text = btrim(u.auth_user_id)
      and not (
        lower(coalesce(au.raw_app_meta_data ->> 'provider', '')) in ('email', 'password')
        or exists (
          select 1
          from jsonb_array_elements_text(
            coalesce(au.raw_app_meta_data -> 'providers', '[]'::jsonb)
          ) as p2(provider_name)
          where lower(p2.provider_name) in ('email', 'password')
        )
      );
  end if;

  -- 3) Se ja alterou senha antes, tambem nao exige criacao.
  if has_password_changed_at then
    update public.wz_users
    set must_create_password = false
    where must_create_password is distinct from false
      and password_changed_at is not null;
  end if;

  -- 4) Sincroniza com password_created quando a coluna existe.
  if has_password_created then
    update public.wz_users
    set password_created = true
    where password_created is distinct from true
      and must_create_password is false;
  end if;
end;
$$;
