-- Suporte para autenticacao em duas etapas (TOTP) no dashboard.
-- Observacao: o segredo e salvo em texto para compatibilidade imediata com o fluxo atual.
-- Se quiser nivel mais alto de seguranca, aplique criptografia no segredo em uma etapa futura.

alter table if exists public.wz_users
  add column if not exists two_factor_enabled boolean not null default false,
  add column if not exists two_factor_secret text,
  add column if not exists two_factor_enabled_at timestamptz,
  add column if not exists two_factor_disabled_at timestamptz;

update public.wz_users
set two_factor_enabled = false
where coalesce(two_factor_enabled, false) = true
  and (two_factor_secret is null or btrim(two_factor_secret) = '');
