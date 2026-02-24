-- Reset completo de dados de autenticacao e cadastro.
-- Use apenas em desenvolvimento/homologacao.
-- ATENCAO: este script remove TODOS os usuarios em auth.users.

do $$
begin
  if to_regclass('public.wz_auth_challenges') is not null then
    delete from public.wz_auth_challenges;
  end if;

  if to_regclass('public.wz_pending_auth') is not null then
    delete from public.wz_pending_auth;
  end if;

  if to_regclass('public.wz_auth_login_providers') is not null then
    delete from public.wz_auth_login_providers;
  end if;

  if to_regclass('public.wz_auth_sessions') is not null then
    delete from public.wz_auth_sessions;
  end if;

  if to_regclass('public.wz_auth_user_devices') is not null then
    delete from public.wz_auth_user_devices;
  end if;

  if to_regclass('public.wz_auth_trusted_devices') is not null then
    delete from public.wz_auth_trusted_devices;
  end if;

  if to_regclass('public.wz_auth_passkeys') is not null then
    delete from public.wz_auth_passkeys;
  end if;

  if to_regclass('public.wz_auth_2fa_recovery_codes') is not null then
    delete from public.wz_auth_2fa_recovery_codes;
  end if;

  if to_regclass('public.wz_auth_2fa') is not null then
    delete from public.wz_auth_2fa;
  end if;

  if to_regclass('public.wz_auth_sms_outbox') is not null then
    delete from public.wz_auth_sms_outbox;
  end if;

  if to_regclass('public.wz_user_privacy_settings') is not null then
    delete from public.wz_user_privacy_settings;
  end if;

  if to_regclass('public.wz_onboarding') is not null then
    delete from public.wz_onboarding;
  end if;

  if to_regclass('public.wz_users') is not null then
    delete from public.wz_users;
  end if;

  if to_regclass('auth.users') is not null then
    begin
      delete from auth.users;
    exception
      when others then
        raise warning '[wz_auth_full_reset] falha ao excluir auth.users: %', sqlerrm;
    end;
  end if;
end;
$$;

