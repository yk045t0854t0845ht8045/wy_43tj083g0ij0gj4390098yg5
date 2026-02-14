-- Evita falhas de OAuth quando o usuario nao possui celular cadastrado.
-- Alguns schemas antigos usam default '' em phone_e164, que viola check de E.164.

alter table if exists public.wz_users
  alter column phone_e164 drop default;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wz_users'
      and column_name = 'phone_e164'
  ) then
    update public.wz_users
    set phone_e164 = null
    where coalesce(trim(phone_e164), '') = '';
  end if;
end;
$$;

