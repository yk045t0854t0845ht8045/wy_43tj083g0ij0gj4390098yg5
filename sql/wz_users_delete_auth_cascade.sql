-- Exclusao robusta de conta:
-- ao remover um registro de public.wz_users, remove tambem dados de autenticacao
-- vinculados (incluindo auth.users no Supabase) para evitar conta/senha orfa.

create or replace function public.wz_users_cleanup_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_wz_user_id text;
  v_auth_user_id text;
  v_email text;
  v_auth_user_uuid uuid;
begin
  v_wz_user_id := nullif(btrim(coalesce(to_jsonb(old) ->> 'id', '')), '');
  v_auth_user_id := nullif(btrim(coalesce(to_jsonb(old) ->> 'auth_user_id', '')), '');
  v_email := nullif(lower(btrim(coalesce(to_jsonb(old) ->> 'email', ''))), '');

  if to_regclass('public.wz_auth_login_providers') is not null then
    delete from public.wz_auth_login_providers
    where
      (v_wz_user_id is not null and (user_id = v_wz_user_id or auth_user_id = v_wz_user_id))
      or (v_auth_user_id is not null and (user_id = v_auth_user_id or auth_user_id = v_auth_user_id))
      or (v_email is not null and lower(email) = v_email);
  end if;

  if to_regclass('public.wz_auth_sessions') is not null then
    delete from public.wz_auth_sessions
    where
      (v_wz_user_id is not null and (user_id = v_wz_user_id or auth_user_id = v_wz_user_id))
      or (v_auth_user_id is not null and (user_id = v_auth_user_id or auth_user_id = v_auth_user_id))
      or (v_email is not null and lower(email) = v_email);
  end if;

  if to_regclass('public.wz_auth_user_devices') is not null then
    delete from public.wz_auth_user_devices
    where
      (v_wz_user_id is not null and (user_id = v_wz_user_id or auth_user_id = v_wz_user_id))
      or (v_auth_user_id is not null and (user_id = v_auth_user_id or auth_user_id = v_auth_user_id))
      or (v_email is not null and lower(email) = v_email);
  end if;

  if to_regclass('public.wz_auth_trusted_devices') is not null then
    delete from public.wz_auth_trusted_devices
    where
      (v_wz_user_id is not null and (user_id = v_wz_user_id or auth_user_id = v_wz_user_id))
      or (v_auth_user_id is not null and (user_id = v_auth_user_id or auth_user_id = v_auth_user_id))
      or (v_email is not null and lower(email) = v_email);
  end if;

  if to_regclass('public.wz_auth_passkeys') is not null then
    delete from public.wz_auth_passkeys
    where
      (v_wz_user_id is not null and user_id = v_wz_user_id)
      or (v_auth_user_id is not null and user_id = v_auth_user_id)
      or (v_email is not null and lower(email) = v_email);
  end if;

  if to_regclass('public.wz_auth_2fa_recovery_codes') is not null then
    delete from public.wz_auth_2fa_recovery_codes
    where
      (v_wz_user_id is not null and user_id = v_wz_user_id)
      or (v_auth_user_id is not null and user_id = v_auth_user_id);
  end if;

  if to_regclass('public.wz_auth_2fa') is not null then
    delete from public.wz_auth_2fa
    where
      (v_wz_user_id is not null and user_id = v_wz_user_id)
      or (v_auth_user_id is not null and user_id = v_auth_user_id);
  end if;

  if to_regclass('public.wz_user_privacy_settings') is not null then
    delete from public.wz_user_privacy_settings
    where
      (v_wz_user_id is not null and (user_id = v_wz_user_id or wz_user_id = v_wz_user_id))
      or (v_auth_user_id is not null and (user_id = v_auth_user_id or wz_user_id = v_auth_user_id))
      or (v_email is not null and lower(email) = v_email);
  end if;

  if to_regclass('public.wz_pending_auth') is not null and v_email is not null then
    delete from public.wz_pending_auth where lower(email) = v_email;
  end if;

  v_auth_user_uuid := null;

  if v_auth_user_id is not null then
    begin
      v_auth_user_uuid := v_auth_user_id::uuid;
    exception
      when invalid_text_representation then
        v_auth_user_uuid := null;
    end;
  end if;

  if v_auth_user_uuid is null and v_wz_user_id is not null then
    begin
      v_auth_user_uuid := v_wz_user_id::uuid;
    exception
      when invalid_text_representation then
        v_auth_user_uuid := null;
    end;
  end if;

  if v_auth_user_uuid is not null and to_regclass('auth.users') is not null then
    begin
      delete from auth.users where id = v_auth_user_uuid;
    exception
      when others then
        raise warning '[wz_users_cleanup_on_delete] falha ao excluir auth.users id=%: %',
          v_auth_user_uuid,
          sqlerrm;
    end;
  end if;

  return old;
end;
$$;

revoke all on function public.wz_users_cleanup_on_delete() from public;

do $$
begin
  if to_regclass('public.wz_users') is null then
    return;
  end if;

  drop trigger if exists trg_wz_users_cleanup_on_delete on public.wz_users;
  create trigger trg_wz_users_cleanup_on_delete
  after delete on public.wz_users
  for each row
  execute function public.wz_users_cleanup_on_delete();
end;
$$;
