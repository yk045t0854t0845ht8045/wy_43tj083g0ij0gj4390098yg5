-- Adiciona marca/modelo de celular para o painel de dispositivos.
-- Execute este ALTER em producao antes de publicar o codigo.

alter table if exists public.wz_auth_user_devices
  add column if not exists device_brand text,
  add column if not exists device_model text;
