-- Suporte a contas criadas por OAuth (Google) e obrigacao de criar senha local.

alter table if exists public.wz_users
  add column if not exists auth_provider text,
  add column if not exists must_create_password boolean not null default false;

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

alter table if exists public.wz_users
  alter column auth_provider set default 'password';

alter table if exists public.wz_users
  drop constraint if exists wz_users_auth_provider_chk;

alter table if exists public.wz_users
  add constraint wz_users_auth_provider_chk
  check (auth_provider in ('password', 'google', 'apple', 'github', 'microsoft', 'unknown'));
