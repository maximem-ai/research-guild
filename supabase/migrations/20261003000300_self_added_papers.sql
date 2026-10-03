-- Self-added past papers: members whose work isn't attributed in OpenAlex (common for arXiv-only papers)
-- add a paper by arXiv ID or DOI. The `scholar` Edge Function looks it up at the source, checks the
-- member's display name against the author list, then calls add_publication with the service role, so
-- the title and co-authors (used by the co-author karma guard) always come from arXiv/OpenAlex.

set search_path = public, extensions;

create or replace function add_publication(p_actor uuid, p_source text, p_external_id text, p_title text,
  p_venue text, p_year int, p_url text, p_arxiv_id text, p_coauthor_names text[]) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not exists (select 1 from profiles where id = p_actor) then perform fail('Please complete your profile first.'); end if;
  if p_source not in ('arxiv','doi') then perform fail('Unknown paper source.'); end if;
  if coalesce(trim(p_external_id), '') = '' or coalesce(trim(p_title), '') = '' then perform fail('That paper has no title.'); end if;
  if exists (select 1 from profile_publications where user_id = p_actor
             and (external_id = p_external_id or (p_arxiv_id is not null and arxiv_id = p_arxiv_id))) then
    perform fail('That paper is already on your profile.');
  end if;
  if (select count(*) from profile_publications where user_id = p_actor and source in ('arxiv','doi')) >= 25 then
    perform fail('You can add up to 25 papers.');
  end if;
  insert into profile_publications (user_id, source, external_id, title, venue, year, url, arxiv_id, coauthor_names)
  values (p_actor, p_source, p_external_id, left(p_title, 500), left(p_venue, 300), p_year, p_url, p_arxiv_id,
          coalesce(p_coauthor_names, '{}'))
  returning id into v_id;
  if exists (select 1 from endorser_capabilities where user_id = p_actor) then
    perform enqueue_embedding('endorser', p_actor);
  end if;
  insert into audit_log (actor_id, action, entity, entity_id, detail)
  values (p_actor, 'add_publication', 'profile', p_actor::text,
          jsonb_build_object('source', p_source, 'external_id', p_external_id));
  return v_id;
end $$;

create or replace function remove_publication(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid();
begin
  delete from profile_publications where id = p_id and user_id = v_uid and source in ('arxiv','doi');
  if not found then perform fail('Paper not found.'); end if;
  if exists (select 1 from endorser_capabilities where user_id = v_uid) then
    perform enqueue_embedding('endorser', v_uid);
  end if;
  perform log_audit('remove_publication', 'profile', v_uid::text, jsonb_build_object('id', p_id));
end $$;

revoke execute on function add_publication(uuid, text, text, text, text, int, text, text, text[]) from public, anon, authenticated;
grant execute on function add_publication(uuid, text, text, text, text, int, text, text, text[]) to service_role;
revoke execute on function remove_publication(bigint) from public, anon;
grant execute on function remove_publication(bigint) to authenticated, service_role;
