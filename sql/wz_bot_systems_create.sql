-- Estrutura base do sistema de atendimento WhatsApp (MVP).
-- Tabela dedicada para configuracao inicial do bot apos onboarding.

create extension if not exists pgcrypto;

create table if not exists public.wz_bot_systems (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid,
  user_id text,
  auth_user_id text,
  email text,
  company_name text,
  whatsapp_connected boolean not null default false,
  welcome_message text,
  closing_message text,
  out_of_hours_message text,
  weekly_schedule jsonb not null default '[]'::jsonb,
  ai_instructions text,
  ai_fallback_message text,
  ai_response_tone text not null default 'professional',
  ai_response_size text not null default 'balanced',
  ai_collect_name boolean not null default false,
  ai_collect_email boolean not null default false,
  ai_collect_phone boolean not null default false,
  ai_transfer_to_human_when_uncertain boolean not null default false,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.wz_bot_systems
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists onboarding_id uuid,
  add column if not exists user_id text,
  add column if not exists auth_user_id text,
  add column if not exists email text,
  add column if not exists company_name text,
  add column if not exists whatsapp_connected boolean not null default false,
  add column if not exists welcome_message text,
  add column if not exists closing_message text,
  add column if not exists out_of_hours_message text,
  add column if not exists weekly_schedule jsonb not null default '[]'::jsonb,
  add column if not exists ai_instructions text,
  add column if not exists ai_fallback_message text,
  add column if not exists ai_response_tone text not null default 'professional',
  add column if not exists ai_response_size text not null default 'balanced',
  add column if not exists ai_collect_name boolean not null default false,
  add column if not exists ai_collect_email boolean not null default false,
  add column if not exists ai_collect_phone boolean not null default false,
  add column if not exists ai_transfer_to_human_when_uncertain boolean not null default false,
  add column if not exists status text not null default 'active',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Remove registros invalidos de user_id para garantir vinculacao por conta.
delete from public.wz_bot_systems
where user_id is null
   or btrim(user_id) = '';

update public.wz_bot_systems
set welcome_message = coalesce(nullif(btrim(welcome_message), ''), 'Ola! Recebemos sua mensagem e iniciaremos o atendimento em instantes.'),
    closing_message = coalesce(nullif(btrim(closing_message), ''), 'Atendimento encerrado por agora. Sempre que precisar, estamos por aqui.'),
    out_of_hours_message = coalesce(nullif(btrim(out_of_hours_message), ''), 'Estamos fora do horario de atendimento. Deixe sua mensagem e retornaremos no proximo periodo util.'),
    ai_instructions = coalesce(nullif(btrim(ai_instructions), ''), 'Atenda com objetividade, educacao e foco em resolver a demanda do cliente.'),
    ai_fallback_message = coalesce(nullif(btrim(ai_fallback_message), ''), 'Nao entendi completamente. Pode reformular sua mensagem com mais detalhes?'),
    ai_response_tone = case
      when coalesce(nullif(lower(btrim(ai_response_tone)), ''), 'professional') in ('professional', 'friendly', 'consultative', 'objective')
        then coalesce(nullif(lower(btrim(ai_response_tone)), ''), 'professional')
      else 'professional'
    end,
    ai_response_size = case
      when coalesce(nullif(lower(btrim(ai_response_size)), ''), 'balanced') in ('concise', 'balanced', 'detailed')
        then coalesce(nullif(lower(btrim(ai_response_size)), ''), 'balanced')
      else 'balanced'
    end,
    status = case
      when coalesce(nullif(lower(btrim(status)), ''), 'active') in ('active', 'draft', 'disabled')
        then coalesce(nullif(lower(btrim(status)), ''), 'active')
      else 'active'
    end,
    weekly_schedule = case
      when weekly_schedule is null then '[]'::jsonb
      when jsonb_typeof(weekly_schedule) <> 'array' then '[]'::jsonb
      else weekly_schedule
    end;
alter table if exists public.wz_bot_systems
  alter column user_id set not null,
  alter column welcome_message set not null,
  alter column closing_message set not null,
  alter column out_of_hours_message set not null,
  alter column ai_instructions set not null,
  alter column ai_fallback_message set not null;

-- Permite varios sistemas por usuario.
drop index if exists public.wz_bot_systems_user_id_uidx;
alter table if exists public.wz_bot_systems
  drop constraint if exists wz_bot_systems_user_id_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'wz_bot_systems'
      and c.conname = 'wz_bot_systems_onboarding_id_fkey'
  ) then
    alter table public.wz_bot_systems
      add constraint wz_bot_systems_onboarding_id_fkey
      foreign key (onboarding_id)
      references public.wz_onboarding (id)
      on delete set null;
  end if;
end;
$$;

alter table if exists public.wz_bot_systems
  drop constraint if exists wz_bot_systems_user_id_not_blank_check;

alter table if exists public.wz_bot_systems
  add constraint wz_bot_systems_user_id_not_blank_check
  check (btrim(user_id) <> '');

alter table if exists public.wz_bot_systems
  drop constraint if exists wz_bot_systems_welcome_message_not_blank_check;

alter table if exists public.wz_bot_systems
  add constraint wz_bot_systems_welcome_message_not_blank_check
  check (btrim(welcome_message) <> '');

alter table if exists public.wz_bot_systems
  drop constraint if exists wz_bot_systems_closing_message_not_blank_check;

alter table if exists public.wz_bot_systems
  add constraint wz_bot_systems_closing_message_not_blank_check
  check (btrim(closing_message) <> '');

alter table if exists public.wz_bot_systems
  drop constraint if exists wz_bot_systems_out_of_hours_message_not_blank_check;

alter table if exists public.wz_bot_systems
  add constraint wz_bot_systems_out_of_hours_message_not_blank_check
  check (btrim(out_of_hours_message) <> '');

alter table if exists public.wz_bot_systems
  drop constraint if exists wz_bot_systems_ai_instructions_not_blank_check;

alter table if exists public.wz_bot_systems
  add constraint wz_bot_systems_ai_instructions_not_blank_check
  check (btrim(ai_instructions) <> '');

alter table if exists public.wz_bot_systems
  drop constraint if exists wz_bot_systems_ai_fallback_message_not_blank_check;

alter table if exists public.wz_bot_systems
  add constraint wz_bot_systems_ai_fallback_message_not_blank_check
  check (btrim(ai_fallback_message) <> '');

alter table if exists public.wz_bot_systems
  drop constraint if exists wz_bot_systems_weekly_schedule_type_check;

alter table if exists public.wz_bot_systems
  add constraint wz_bot_systems_weekly_schedule_type_check
  check (jsonb_typeof(weekly_schedule) = 'array');

alter table if exists public.wz_bot_systems
  drop constraint if exists wz_bot_systems_ai_response_tone_check;

alter table if exists public.wz_bot_systems
  add constraint wz_bot_systems_ai_response_tone_check
  check (ai_response_tone in ('professional', 'friendly', 'consultative', 'objective'));

alter table if exists public.wz_bot_systems
  drop constraint if exists wz_bot_systems_ai_response_size_check;

alter table if exists public.wz_bot_systems
  add constraint wz_bot_systems_ai_response_size_check
  check (ai_response_size in ('concise', 'balanced', 'detailed'));

alter table if exists public.wz_bot_systems
  drop constraint if exists wz_bot_systems_status_check;

alter table if exists public.wz_bot_systems
  add constraint wz_bot_systems_status_check
  check (status in ('active', 'draft', 'disabled'));

create index if not exists wz_bot_systems_user_id_idx
  on public.wz_bot_systems (user_id);

create index if not exists wz_bot_systems_auth_user_id_idx
  on public.wz_bot_systems (auth_user_id);

create index if not exists wz_bot_systems_email_idx
  on public.wz_bot_systems (email);

create index if not exists wz_bot_systems_onboarding_id_idx
  on public.wz_bot_systems (onboarding_id);

create index if not exists wz_bot_systems_status_idx
  on public.wz_bot_systems (status);

create or replace function public.wz_bot_systems_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_wz_bot_systems_set_updated_at on public.wz_bot_systems;

create trigger trg_wz_bot_systems_set_updated_at
before update on public.wz_bot_systems
for each row
execute function public.wz_bot_systems_set_updated_at();
