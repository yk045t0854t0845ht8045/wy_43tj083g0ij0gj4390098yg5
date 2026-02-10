-- Onboarding finalizer schema upgrade for dashboard pendencias flow
-- Run in Supabase SQL Editor

alter table if exists public.wz_onboarding
  add column if not exists welcome_confirmed boolean not null default false,
  add column if not exists team_agents_count integer,
  add column if not exists operation_days text[],
  add column if not exists operation_start_time text,
  add column if not exists operation_end_time text,
  add column if not exists whatsapp_connected boolean not null default false,
  add column if not exists whatsapp_connected_at timestamptz,
  add column if not exists ui_step text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'wz_onboarding_team_agents_count_check'
  ) then
    alter table public.wz_onboarding
      add constraint wz_onboarding_team_agents_count_check
      check (team_agents_count is null or (team_agents_count >= 1 and team_agents_count <= 5000));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'wz_onboarding_ui_step_check'
  ) then
    alter table public.wz_onboarding
      add constraint wz_onboarding_ui_step_check
      check (
        ui_step is null
        or ui_step in ('welcome','company','goal','team','ai','whatsapp','improve','final')
      );
  end if;
end $$;

create index if not exists wz_onboarding_user_id_idx
  on public.wz_onboarding (user_id);
