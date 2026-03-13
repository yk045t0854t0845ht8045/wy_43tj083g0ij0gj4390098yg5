-- Fila de limpeza de arquivos do Supabase Storage.
-- Objetivo:
-- 1) enfileirar fotos/logos antigos quando referencia muda
-- 2) enfileirar fotos/logos quando registros sao excluidos
-- 3) permitir que a rota interna /api/internal/storage-cleanup processe essa fila

create extension if not exists pgcrypto;

create table if not exists public.wz_storage_cleanup_queue (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  object_path text not null,
  public_url text,
  source_table text,
  source_record_id text,
  reason text,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table if exists public.wz_storage_cleanup_queue
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists bucket text,
  add column if not exists object_path text,
  add column if not exists public_url text,
  add column if not exists source_table text,
  add column if not exists source_record_id text,
  add column if not exists reason text,
  add column if not exists last_error text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists processed_at timestamptz;

update public.wz_storage_cleanup_queue
set bucket = nullif(btrim(bucket), ''),
    object_path = nullif(btrim(object_path), ''),
    public_url = nullif(btrim(public_url), ''),
    source_table = nullif(btrim(source_table), ''),
    source_record_id = nullif(btrim(source_record_id), ''),
    reason = nullif(btrim(reason), ''),
    last_error = nullif(btrim(last_error), '');

delete from public.wz_storage_cleanup_queue
where bucket is null
   or object_path is null;

alter table if exists public.wz_storage_cleanup_queue
  alter column bucket set not null,
  alter column object_path set not null;

alter table if exists public.wz_storage_cleanup_queue
  drop constraint if exists wz_storage_cleanup_queue_bucket_check;

alter table if exists public.wz_storage_cleanup_queue
  add constraint wz_storage_cleanup_queue_bucket_check
  check (bucket in ('wz-user-photos', 'wz-onboarding-logos'));

create index if not exists wz_storage_cleanup_queue_processed_idx
  on public.wz_storage_cleanup_queue (processed_at, created_at);

create unique index if not exists wz_storage_cleanup_queue_pending_bucket_path_uidx
  on public.wz_storage_cleanup_queue (bucket, object_path)
  where processed_at is null;

create or replace function public.wz_storage_extract_object_path(
  p_bucket text,
  p_public_url text
)
returns text
language plpgsql
as $$
declare
  v_bucket text;
  v_public_url text;
  v_marker text;
  v_path text;
begin
  v_bucket := nullif(btrim(coalesce(p_bucket, '')), '');
  v_public_url := nullif(btrim(coalesce(p_public_url, '')), '');

  if v_bucket is null or v_public_url is null then
    return null;
  end if;

  v_marker := '/storage/v1/object/public/' || v_bucket || '/';

  if position(v_marker in v_public_url) = 0 then
    return null;
  end if;

  v_path := split_part(v_public_url, v_marker, 2);
  v_path := split_part(v_path, '?', 1);
  v_path := split_part(v_path, '#', 1);
  v_path := nullif(btrim(v_path), '');

  return v_path;
end;
$$;

create or replace function public.wz_enqueue_storage_cleanup(
  p_bucket text,
  p_public_url text,
  p_reason text default null,
  p_source_table text default null,
  p_source_record_id text default null
)
returns void
language plpgsql
as $$
declare
  v_bucket text;
  v_public_url text;
  v_object_path text;
begin
  v_bucket := nullif(btrim(coalesce(p_bucket, '')), '');
  v_public_url := nullif(btrim(coalesce(p_public_url, '')), '');

  if v_bucket is null or v_public_url is null then
    return;
  end if;

  v_object_path := public.wz_storage_extract_object_path(v_bucket, v_public_url);
  if v_object_path is null then
    return;
  end if;

  insert into public.wz_storage_cleanup_queue (
    bucket,
    object_path,
    public_url,
    source_table,
    source_record_id,
    reason,
    last_error,
    created_at,
    processed_at
  )
  values (
    v_bucket,
    v_object_path,
    v_public_url,
    nullif(btrim(coalesce(p_source_table, '')), ''),
    nullif(btrim(coalesce(p_source_record_id, '')), ''),
    nullif(btrim(coalesce(p_reason, '')), ''),
    null,
    now(),
    null
  )
  on conflict (bucket, object_path)
  where processed_at is null
  do update
    set public_url = excluded.public_url,
        source_table = coalesce(excluded.source_table, public.wz_storage_cleanup_queue.source_table),
        source_record_id = coalesce(excluded.source_record_id, public.wz_storage_cleanup_queue.source_record_id),
        reason = coalesce(excluded.reason, public.wz_storage_cleanup_queue.reason),
        last_error = null;
end;
$$;

create or replace function public.wz_storage_queue_user_photo_changes()
returns trigger
language plpgsql
as $$
declare
  v_old_photo text;
  v_new_photo text;
  v_record_id text;
begin
  if tg_op = 'DELETE' then
    v_old_photo := nullif(btrim(coalesce(to_jsonb(old) ->> 'photo_link', '')), '');
    v_record_id := nullif(btrim(coalesce(to_jsonb(old) ->> 'id', '')), '');

    perform public.wz_enqueue_storage_cleanup(
      'wz-user-photos',
      v_old_photo,
      'wz_users delete',
      tg_table_name,
      v_record_id
    );

    return old;
  end if;

  v_old_photo := nullif(btrim(coalesce(to_jsonb(old) ->> 'photo_link', '')), '');
  v_new_photo := nullif(btrim(coalesce(to_jsonb(new) ->> 'photo_link', '')), '');
  v_record_id := nullif(
    btrim(
      coalesce(
        to_jsonb(new) ->> 'id',
        to_jsonb(old) ->> 'id',
        ''
      )
    ),
    ''
  );

  if v_old_photo is not null and v_old_photo is distinct from v_new_photo then
    perform public.wz_enqueue_storage_cleanup(
      'wz-user-photos',
      v_old_photo,
      'wz_users photo_link changed',
      tg_table_name,
      v_record_id
    );
  end if;

  return new;
end;
$$;

create or replace function public.wz_storage_queue_company_logo_changes()
returns trigger
language plpgsql
as $$
declare
  v_old_logo text;
  v_new_logo text;
  v_record_id text;
begin
  if tg_op = 'DELETE' then
    v_old_logo := nullif(btrim(coalesce(to_jsonb(old) ->> 'company_logo_url', '')), '');
    v_record_id := nullif(btrim(coalesce(to_jsonb(old) ->> 'id', '')), '');

    perform public.wz_enqueue_storage_cleanup(
      'wz-onboarding-logos',
      v_old_logo,
      tg_table_name || ' delete',
      tg_table_name,
      v_record_id
    );

    return old;
  end if;

  v_old_logo := nullif(btrim(coalesce(to_jsonb(old) ->> 'company_logo_url', '')), '');
  v_new_logo := nullif(btrim(coalesce(to_jsonb(new) ->> 'company_logo_url', '')), '');
  v_record_id := nullif(
    btrim(
      coalesce(
        to_jsonb(new) ->> 'id',
        to_jsonb(old) ->> 'id',
        ''
      )
    ),
    ''
  );

  if v_old_logo is not null and v_old_logo is distinct from v_new_logo then
    perform public.wz_enqueue_storage_cleanup(
      'wz-onboarding-logos',
      v_old_logo,
      tg_table_name || ' company_logo_url changed',
      tg_table_name,
      v_record_id
    );
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.wz_users') is not null then
    drop trigger if exists trg_wz_storage_queue_user_photo_changes_update on public.wz_users;
    create trigger trg_wz_storage_queue_user_photo_changes_update
    after update of photo_link on public.wz_users
    for each row
    execute function public.wz_storage_queue_user_photo_changes();

    drop trigger if exists trg_wz_storage_queue_user_photo_changes_delete on public.wz_users;
    create trigger trg_wz_storage_queue_user_photo_changes_delete
    after delete on public.wz_users
    for each row
    execute function public.wz_storage_queue_user_photo_changes();
  end if;

  if to_regclass('public.wz_onboarding') is not null then
    drop trigger if exists trg_wz_storage_queue_onboarding_logo_changes_update on public.wz_onboarding;
    create trigger trg_wz_storage_queue_onboarding_logo_changes_update
    after update of company_logo_url on public.wz_onboarding
    for each row
    execute function public.wz_storage_queue_company_logo_changes();

    drop trigger if exists trg_wz_storage_queue_onboarding_logo_changes_delete on public.wz_onboarding;
    create trigger trg_wz_storage_queue_onboarding_logo_changes_delete
    after delete on public.wz_onboarding
    for each row
    execute function public.wz_storage_queue_company_logo_changes();
  end if;

  if to_regclass('public.wz_company_onboarding') is not null then
    drop trigger if exists trg_wz_storage_queue_company_logo_changes_update on public.wz_company_onboarding;
    create trigger trg_wz_storage_queue_company_logo_changes_update
    after update of company_logo_url on public.wz_company_onboarding
    for each row
    execute function public.wz_storage_queue_company_logo_changes();

    drop trigger if exists trg_wz_storage_queue_company_logo_changes_delete on public.wz_company_onboarding;
    create trigger trg_wz_storage_queue_company_logo_changes_delete
    after delete on public.wz_company_onboarding
    for each row
    execute function public.wz_storage_queue_company_logo_changes();
  end if;
end;
$$;
