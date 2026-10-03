-- Keyless deploy: nothing secret has to be copied between dashboards.
-- 1. pg_cron authenticates to Edge Functions with a generated token kept in Vault (`cron_token`),
--    instead of a hand-copied service-role key. Only `project_url` must be stored once.
-- 2. arXiv verification runs in the `verify-arxiv` Edge Function (which already holds the
--    service-role key), so the Next.js app needs no server secret at all.
-- 3. The retention job also removes orphaned PDF uploads (an upload whose version row was never created).

set search_path = public, extensions;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'vault')
     and not exists (select 1 from vault.secrets where name = 'cron_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cron_token',
                                'Shared secret pg_cron sends to the embed/retention Edge Functions');
  end if;
exception when others then
  raise notice 'cron_token not created: %', sqlerrm;
end $$;

create or replace function check_cron_token(p_token text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  if p_token is null or length(p_token) < 32 or not exists (select 1 from pg_namespace where nspname = 'vault') then
    return false;
  end if;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'cron_token'$q$ into v;
  return v is not null and v = p_token;
end $$;

create or replace function invoke_edge_function(p_name text, p_body jsonb default '{}') returns bigint
language plpgsql security definer set search_path = public as $$
declare v_url text; v_token text; v_id bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net')
     or not exists (select 1 from pg_namespace where nspname = 'vault') then
    return null;
  end if;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'project_url'$q$ into v_url;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'cron_token'$q$ into v_token;
  if v_url is null or v_token is null then return null; end if;
  execute $q$select net.http_post(url := $1, headers := $2, body := $3, timeout_milliseconds := 60000)$q$
    into v_id
    using rtrim(v_url, '/') || '/functions/v1/' || p_name,
          jsonb_build_object('Content-Type', 'application/json', 'x-cron-token', v_token),
          p_body;
  return v_id;
end $$;

create or replace function orphaned_paper_objects(p_limit int default 200) returns table (name text)
language sql stable security definer set search_path = public as $$
  select o.name from storage.objects o
  where o.bucket_id = 'papers' and o.created_at < now() - interval '1 day'
    and not exists (select 1 from paper_versions v where v.storage_path = o.name)
  order by o.created_at limit p_limit
$$;

revoke execute on function check_cron_token(text), invoke_edge_function(text, jsonb), orphaned_paper_objects(int)
  from public, anon, authenticated;
grant execute on function check_cron_token(text), orphaned_paper_objects(int) to service_role;
