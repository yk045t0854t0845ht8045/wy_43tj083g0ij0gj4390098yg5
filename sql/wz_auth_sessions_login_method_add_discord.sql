-- Permite gravar sessoes com login_method = 'discord'.

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
      'discord',
      'unknown'
    )
  );
