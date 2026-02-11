-- Add profile photo link support for dashboard account settings
alter table if exists public.wz_users
  add column if not exists photo_link text;
