-- Estado de lembretes de onboarding abandonado.
-- Mantem controle de envio sem tocar no updated_at do onboarding principal.

create extension if not exists pgcrypto;

create table if not exists public.wz_onboarding_reminders (
  id uuid primary key default gen_random_uuid(),
  onboarding_kind text not null,
  onboarding_id uuid not null,
  user_id text not null,
  email text,
  reminder_type text not null default 'abandonment_nudge',
  sent_for_updated_at timestamptz,
  sent_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.wz_onboarding_reminders
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists onboarding_kind text,
  add column if not exists onboarding_id uuid,
  add column if not exists user_id text,
  add column if not exists email text,
  add column if not exists reminder_type text not null default 'abandonment_nudge',
  add column if not exists sent_for_updated_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists last_error text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.wz_onboarding_reminders
set onboarding_kind = lower(btrim(coalesce(onboarding_kind, ''))),
    reminder_type = lower(btrim(coalesce(reminder_type, '')))
where onboarding_kind is not null
   or reminder_type is not null;

delete from public.wz_onboarding_reminders
where onboarding_id is null
   or user_id is null
   or btrim(user_id) = ''
   or onboarding_kind is null
   or btrim(onboarding_kind) = ''
   or reminder_type is null
   or btrim(reminder_type) = '';

alter table if exists public.wz_onboarding_reminders
  alter column onboarding_kind set not null,
  alter column onboarding_id set not null,
  alter column user_id set not null,
  alter column reminder_type set not null;

alter table if exists public.wz_onboarding_reminders
  drop constraint if exists wz_onboarding_reminders_kind_check;

alter table if exists public.wz_onboarding_reminders
  add constraint wz_onboarding_reminders_kind_check
  check (onboarding_kind in ('primary', 'company'));

alter table if exists public.wz_onboarding_reminders
  drop constraint if exists wz_onboarding_reminders_type_check;

alter table if exists public.wz_onboarding_reminders
  add constraint wz_onboarding_reminders_type_check
  check (reminder_type in ('abandonment_nudge'));

do $$
begin
  with ranked as (
    select
      ctid,
      row_number() over (
        partition by onboarding_kind, onboarding_id, reminder_type
        order by sent_at desc nulls last, last_attempt_at desc nulls last, updated_at desc nulls last, created_at desc nulls last, ctid desc
      ) as rn
    from public.wz_onboarding_reminders
  )
  delete from public.wz_onboarding_reminders t
  using ranked r
  where t.ctid = r.ctid
    and r.rn > 1;
end;
$$;

create unique index if not exists wz_onboarding_reminders_unique_idx
  on public.wz_onboarding_reminders (onboarding_kind, onboarding_id, reminder_type);

create index if not exists wz_onboarding_reminders_user_id_idx
  on public.wz_onboarding_reminders (user_id);

create index if not exists wz_onboarding_reminders_email_idx
  on public.wz_onboarding_reminders (email);

create index if not exists wz_onboarding_reminders_sent_at_idx
  on public.wz_onboarding_reminders (sent_at desc nulls last);

create index if not exists wz_onboarding_reminders_last_attempt_idx
  on public.wz_onboarding_reminders (last_attempt_at desc nulls last);

create or replace function public.wz_onboarding_reminders_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_wz_onboarding_reminders_set_updated_at on public.wz_onboarding_reminders;

create trigger trg_wz_onboarding_reminders_set_updated_at
before update on public.wz_onboarding_reminders
for each row
execute function public.wz_onboarding_reminders_set_updated_at();
