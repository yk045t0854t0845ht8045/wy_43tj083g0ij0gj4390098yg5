-- Permite registrar sessoes com metodo de login Google.

-- Normaliza dados legados antes de recriar a constraint.
-- Sem isso, registros antigos (ex.: discord/microsoft) quebram o add constraint.
do $$
begin
  if to_regclass('public.wz_auth_sessions') is null then
    return;
  end if;

  update public.wz_auth_sessions
  set login_method = case
    when coalesce(nullif(btrim(lower(login_method)), ''), 'unknown') in (
      'password',
      'email_code',
      'sms_code',
      'totp',
      'passkey',
      'trusted',
      'exchange',
      'sync',
      'google',
      'unknown'
    ) then coalesce(nullif(btrim(lower(login_method)), ''), 'unknown')
    else 'unknown'
  end
  where
    login_method is null
    or login_method <> btrim(lower(login_method))
    or btrim(lower(login_method)) = ''
    or btrim(lower(login_method)) not in (
      'password',
      'email_code',
      'sms_code',
      'totp',
      'passkey',
      'trusted',
      'exchange',
      'sync',
      'google',
      'unknown'
    );
end;
$$;

alter table if exists public.wz_auth_sessions
  drop constraint if exists wz_auth_sessions_login_method_chk;

alter table if exists public.wz_auth_sessions
  add constraint wz_auth_sessions_login_method_chk
  check (
    login_method in (
      'password',
      'email_code',
      'sms_code',
      'totp',
      'passkey',
      'trusted',
      'exchange',
      'sync',
      'google',
      'unknown'
    )
  );
