-- Cadastro de onboarding inicial da empresa no dashboard.
-- Utilizado para abrir o modal de primeiro acesso e acompanhar progresso.

create extension if not exists pgcrypto;

create table if not exists public.wz_onboarding (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  auth_user_id text,
  email text,
  company_name text,
  company_logo_url text,
  company_cnpj text,
  industry text,
  is_online_business boolean not null default false,
  company_address text,
  company_city text,
  company_state text,
  company_postal_code text,
  welcome_confirmed boolean not null default false,
  team_agents_count integer,
  onboarding_goal text,
  monthly_conversations_tier text,
  operation_days text[],
  operation_start_time text,
  operation_end_time text,
  whatsapp_connected boolean not null default false,
  whatsapp_connected_at timestamptz,
  whatsapp_pairing_code text,
  whatsapp_pairing_expires_at timestamptz,
  ui_step text not null default 'company',
  completed boolean not null default false,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.wz_onboarding
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id text,
  add column if not exists auth_user_id text,
  add column if not exists email text,
  add column if not exists company_name text,
  add column if not exists company_logo_url text,
  add column if not exists company_cnpj text,
  add column if not exists industry text,
  add column if not exists is_online_business boolean not null default false,
  add column if not exists company_address text,
  add column if not exists company_city text,
  add column if not exists company_state text,
  add column if not exists company_postal_code text,
  add column if not exists welcome_confirmed boolean not null default false,
  add column if not exists team_agents_count integer,
  add column if not exists onboarding_goal text,
  add column if not exists monthly_conversations_tier text,
  add column if not exists operation_days text[],
  add column if not exists operation_start_time text,
  add column if not exists operation_end_time text,
  add column if not exists whatsapp_connected boolean not null default false,
  add column if not exists whatsapp_connected_at timestamptz,
  add column if not exists whatsapp_pairing_code text,
  add column if not exists whatsapp_pairing_expires_at timestamptz,
  add column if not exists ui_step text not null default 'company',
  add column if not exists completed boolean not null default false,
  add column if not exists completed_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Higieniza registros invalidos para garantir unicidade por user_id.
delete from public.wz_onboarding
where user_id is null
   or btrim(user_id) = '';

do $$
begin
  with ranked as (
    select
      ctid,
      row_number() over (
        partition by user_id
        order by updated_at desc nulls last, created_at desc nulls last, ctid desc
      ) as rn
    from public.wz_onboarding
  )
  delete from public.wz_onboarding t
  using ranked r
  where t.ctid = r.ctid
    and r.rn > 1;
end;
$$;

alter table if exists public.wz_onboarding
  alter column user_id set not null;

drop index if exists public.wz_onboarding_user_id_uidx;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'wz_onboarding'
      and c.conname = 'wz_onboarding_user_id_key'
  ) then
    alter table public.wz_onboarding
      add constraint wz_onboarding_user_id_key unique (user_id);
  end if;
end;
$$;

-- Normaliza CNPJ (apenas digitos) e UI step.
update public.wz_onboarding
set company_cnpj = nullif(regexp_replace(coalesce(company_cnpj, ''), '\D', '', 'g'), ''),
    company_postal_code = nullif(regexp_replace(coalesce(company_postal_code, ''), '\D', '', 'g'), ''),
    company_state = nullif(upper(regexp_replace(coalesce(company_state, ''), '[^A-Za-z]', '', 'g')), ''),
    onboarding_goal = case
      when coalesce(nullif(btrim(lower(onboarding_goal)), ''), '') in (
        'support',
        'sales',
        'scheduling',
        'billing',
        'mixed'
      ) then nullif(btrim(lower(onboarding_goal)), '')
      else null
    end,
    monthly_conversations_tier = case
      when coalesce(nullif(btrim(lower(monthly_conversations_tier)), ''), '') in (
        'up_to_300',
        '301_1000',
        '1001_3000',
        '3001_10000',
        '10001_plus'
      ) then nullif(btrim(lower(monthly_conversations_tier)), '')
      else null
    end,
    ui_step = case
      when coalesce(nullif(btrim(lower(ui_step)), ''), 'company') in (
        'welcome',
        'company',
        'goal',
        'team',
        'ai',
        'whatsapp',
        'improve',
        'final'
      ) then coalesce(nullif(btrim(lower(ui_step)), ''), 'company')
      else 'company'
    end
where
  company_cnpj is not null
  or company_postal_code is not null
  or company_state is not null
  or onboarding_goal is not null
  or monthly_conversations_tier is not null
  or ui_step is null
  or ui_step <> btrim(lower(ui_step))
  or btrim(lower(ui_step)) not in (
    'welcome',
    'company',
    'goal',
    'team',
    'ai',
    'whatsapp',
    'improve',
    'final'
  );

update public.wz_onboarding
set company_address = null,
    company_city = null,
    company_state = null,
    company_postal_code = null
where is_online_business = true
  and (
    company_address is not null
    or company_city is not null
    or company_state is not null
    or company_postal_code is not null
  );

update public.wz_onboarding
set team_agents_count = null
where team_agents_count is not null
  and (team_agents_count < 1 or team_agents_count > 5000);

alter table if exists public.wz_onboarding
  drop constraint if exists wz_onboarding_team_agents_count_check;

alter table if exists public.wz_onboarding
  add constraint wz_onboarding_team_agents_count_check
  check (team_agents_count is null or (team_agents_count >= 1 and team_agents_count <= 5000));

alter table if exists public.wz_onboarding
  drop constraint if exists wz_onboarding_company_cnpj_check;

alter table if exists public.wz_onboarding
  add constraint wz_onboarding_company_cnpj_check
  check (company_cnpj is null or company_cnpj ~ '^[0-9]{14}$');

alter table if exists public.wz_onboarding
  drop constraint if exists wz_onboarding_company_postal_code_check;

alter table if exists public.wz_onboarding
  add constraint wz_onboarding_company_postal_code_check
  check (company_postal_code is null or company_postal_code ~ '^[0-9]{8}$');

alter table if exists public.wz_onboarding
  drop constraint if exists wz_onboarding_company_state_check;

alter table if exists public.wz_onboarding
  add constraint wz_onboarding_company_state_check
  check (company_state is null or company_state ~ '^[A-Z]{2}$');

alter table if exists public.wz_onboarding
  drop constraint if exists wz_onboarding_online_address_check;

alter table if exists public.wz_onboarding
  add constraint wz_onboarding_online_address_check
  check (
    is_online_business = false
    or (
      company_address is null
      and company_city is null
      and company_state is null
      and company_postal_code is null
    )
  );

alter table if exists public.wz_onboarding
  drop constraint if exists wz_onboarding_goal_check;

alter table if exists public.wz_onboarding
  add constraint wz_onboarding_goal_check
  check (
    onboarding_goal is null
    or onboarding_goal in ('support', 'sales', 'scheduling', 'billing', 'mixed')
  );

alter table if exists public.wz_onboarding
  drop constraint if exists wz_onboarding_monthly_conversations_tier_check;

alter table if exists public.wz_onboarding
  add constraint wz_onboarding_monthly_conversations_tier_check
  check (
    monthly_conversations_tier is null
    or monthly_conversations_tier in (
      'up_to_300',
      '301_1000',
      '1001_3000',
      '3001_10000',
      '10001_plus'
    )
  );

alter table if exists public.wz_onboarding
  drop constraint if exists wz_onboarding_ui_step_check;

alter table if exists public.wz_onboarding
  add constraint wz_onboarding_ui_step_check
  check (
    ui_step in ('welcome', 'company', 'goal', 'team', 'ai', 'whatsapp', 'improve', 'final')
  );

create index if not exists wz_onboarding_user_id_idx
  on public.wz_onboarding (user_id);

create index if not exists wz_onboarding_auth_user_id_idx
  on public.wz_onboarding (auth_user_id);

create index if not exists wz_onboarding_email_idx
  on public.wz_onboarding (email);

create or replace function public.wz_onboarding_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_wz_onboarding_set_updated_at on public.wz_onboarding;
create trigger trg_wz_onboarding_set_updated_at
before update on public.wz_onboarding
for each row
execute function public.wz_onboarding_set_updated_at();
