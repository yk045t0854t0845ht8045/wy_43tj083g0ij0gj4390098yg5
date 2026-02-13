-- Ciclo de vida da conta (exclusao logica / reativacao).
-- Estado:
--   active            -> conta normal
--   pending_deletion  -> bloqueada por 14 dias, ainda pode reativar
--   deactivated       -> bloqueada sem reativacao

alter table if exists public.wz_users
  add column if not exists account_state text not null default 'active',
  add column if not exists account_original_email text,
  add column if not exists account_delete_requested_at timestamptz,
  add column if not exists account_restore_deadline_at timestamptz,
  add column if not exists account_deactivated_at timestamptz,
  add column if not exists account_email_reuse_at timestamptz,
  add column if not exists account_reactivated_at timestamptz;

update public.wz_users
set account_state = 'active'
where coalesce(btrim(account_state), '') = '';

update public.wz_users
set account_original_email = lower(btrim(email))
where coalesce(btrim(account_original_email), '') = ''
  and coalesce(btrim(email), '') <> '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'wz_users_account_state_check'
      and conrelid = 'public.wz_users'::regclass
  ) then
    alter table public.wz_users
      add constraint wz_users_account_state_check
      check (account_state in ('active', 'pending_deletion', 'deactivated'));
  end if;
end;
$$;

create index if not exists wz_users_account_state_idx
  on public.wz_users (account_state);

create index if not exists wz_users_account_restore_deadline_idx
  on public.wz_users (account_restore_deadline_at);

create index if not exists wz_users_account_email_reuse_idx
  on public.wz_users (account_email_reuse_at);

create index if not exists wz_users_account_original_email_idx
  on public.wz_users (account_original_email);
