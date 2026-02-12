-- Acesso para suporte na tabela wz_users.
-- 1 = ativo
-- 0 ou null = desativado

alter table if exists public.wz_users
  add column if not exists support_access smallint;

alter table if exists public.wz_users
  drop constraint if exists wz_users_support_access_chk;

alter table if exists public.wz_users
  add constraint wz_users_support_access_chk
  check (support_access in (0, 1));

