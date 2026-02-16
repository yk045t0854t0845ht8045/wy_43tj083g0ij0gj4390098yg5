-- Habilita o onboarding de OAuth Google no pending auth:
-- - flow aceita "google"
-- - stage aceita "phone" (etapa de coleta de celular)
--
-- Execute antes de publicar o fluxo novo de login Google.

alter table if exists public.wz_pending_auth
  add column if not exists flow text,
  add column if not exists stage text;

alter table if exists public.wz_pending_auth
  alter column flow set default 'login',
  alter column stage set default 'email';

do $$
declare
  c record;
begin
  if to_regclass('public.wz_pending_auth') is null then
    return;
  end if;

  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.wz_pending_auth'::regclass
      and contype = 'c'
      and (
        pg_get_constraintdef(oid) ilike '%flow%'
        or pg_get_constraintdef(oid) ilike '%stage%'
      )
  loop
    execute format(
      'alter table public.wz_pending_auth drop constraint if exists %I',
      c.conname
    );
  end loop;
end;
$$;

-- Normaliza dados legados para evitar falha ao recriar constraints.
do $$
begin
  if to_regclass('public.wz_pending_auth') is null then
    return;
  end if;

  update public.wz_pending_auth
  set flow = case
    when coalesce(nullif(btrim(lower(flow)), ''), 'login') in ('login', 'register', 'google')
      then coalesce(nullif(btrim(lower(flow)), ''), 'login')
    else 'login'
  end,
  stage = case
    when coalesce(nullif(btrim(lower(stage)), ''), 'email') in ('email', 'sms', 'phone')
      then coalesce(nullif(btrim(lower(stage)), ''), 'email')
    else 'email'
  end
  where
    flow is null
    or flow <> btrim(lower(flow))
    or btrim(lower(flow)) = ''
    or btrim(lower(flow)) not in ('login', 'register', 'google')
    or stage is null
    or stage <> btrim(lower(stage))
    or btrim(lower(stage)) = ''
    or btrim(lower(stage)) not in ('email', 'sms', 'phone');
end;
$$;

alter table if exists public.wz_pending_auth
  add constraint wz_pending_auth_flow_chk
  check (flow in ('login', 'register', 'google'));

alter table if exists public.wz_pending_auth
  add constraint wz_pending_auth_stage_chk
  check (stage in ('email', 'sms', 'phone'));
