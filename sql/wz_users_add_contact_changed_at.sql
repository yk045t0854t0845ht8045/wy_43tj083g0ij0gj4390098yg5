-- Add contact change timestamps used by dashboard security tags
-- Run in Supabase SQL Editor

alter table if exists public.wz_users
  add column if not exists email_changed_at timestamptz,
  add column if not exists phone_changed_at timestamptz,
  add column if not exists password_changed_at timestamptz;
