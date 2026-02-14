-- Habilita flow='discord' no wz_pending_auth para onboarding OAuth Discord.

alter table if exists public.wz_pending_auth
  drop constraint if exists wz_pending_auth_flow_chk;

alter table if exists public.wz_pending_auth
  add constraint wz_pending_auth_flow_chk
  check (flow in ('login', 'register', 'google', 'discord'));
