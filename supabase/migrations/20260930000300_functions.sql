-- Endorse Commons: helper functions, state-machine RPCs, triggers (SPEC §4, §5, §8, §12, §13b)
-- All state transitions happen here, in SECURITY DEFINER functions, so rules can't be bypassed
-- from the client. Every RPC writes audit_log.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- small helpers
-- ---------------------------------------------------------------------------
create or replace function cfg_int(p_key text) returns int
language sql stable security definer set search_path = public as $$
  select (value #>> '{}')::int from platform_config where key = p_key
$$;

create or replace function cfg_bool(p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((value #>> '{}')::boolean, false) from platform_config where key = p_key
$$;

create or replace function fail(p_message text) returns void
language plpgsql as $$
begin
  raise exception using message = p_message, errcode = 'P0001';
end $$;

-- the signed-in user, who must have completed onboarding
create or replace function require_uid() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v uuid := auth.uid();
begin
  if v is null then
    raise exception using message = 'You need to sign in first.', errcode = '28000';
  end if;
  if not exists (select 1 from profiles where id = v) then
    raise exception using message = 'Please complete your profile first.', errcode = 'P0001';
  end if;
  return v;
end $$;

create or replace function is_moderator(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = p_uid and role = 'moderator')
$$;

create or replace function is_paper_member(p_paper uuid, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from paper_members where paper_id = p_paper and user_id = p_uid)
$$;

create or replace function is_paper_endorser(p_paper uuid, p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from engagements where paper_id = p_paper and endorser_id = p_uid)
$$;

create or replace function safe_uuid(p text) returns uuid
language sql immutable as $$
  select case when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p::uuid end
$$;

create or replace function log_audit(p_action text, p_entity text, p_entity_id text, p_detail jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into audit_log (actor_id, action, entity, entity_id, detail)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_detail)
$$;

create or replace function notify_user(p_uid uuid, p_type text, p_payload jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, payload) values (p_uid, p_type, coalesce(p_payload, '{}'))
$$;

create or replace function notify_paper_members(p_paper uuid, p_type text, p_payload jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, payload)
  select user_id, p_type, coalesce(p_payload, '{}') || jsonb_build_object('paper_id', p_paper)
  from paper_members where paper_id = p_paper
$$;

-- ORCID checksum (ISO 7064 11,2)
create or replace function orcid_valid(p text) returns boolean
language plpgsql immutable as $$
declare digits text; total int := 0; i int; r int; check_char text;
begin
  if p is null then return true; end if;
  if p !~ '^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$' then return false; end if;
  digits := replace(p, '-', '');
  for i in 1..15 loop
    total := (total + substr(digits, i, 1)::int) * 2;
  end loop;
  r := (12 - (total % 11)) % 11;
  check_char := case when r = 10 then 'X' else r::text end;
  return check_char = substr(digits, 16, 1);
end $$;

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on profiles for each row execute function touch_updated_at();
create trigger papers_touch before update on papers for each row
  when (old.title is distinct from new.title or old.abstract is distinct from new.abstract
        or old.primary_category is distinct from new.primary_category
        or old.cross_list_categories is distinct from new.cross_list_categories
        or old.paper_type is distinct from new.paper_type
        or old.peer_review_proof_url is distinct from new.peer_review_proof_url
        or old.repo_url is distinct from new.repo_url)
  execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- capacity helpers
-- ---------------------------------------------------------------------------
create or replace function endorser_is_available(p_uid uuid, p_cat text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from endorser_capabilities c
    where c.user_id = p_uid and c.category_code = p_cat and c.status <> 'suspended'
      and c.accepting and (c.paused_until is null or c.paused_until <= now()))
$$;

create or replace function endorser_max(p_uid uuid, p_cat text) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select max_active_reviews from endorser_capabilities where user_id = p_uid and category_code = p_cat),
    (select max(max_active_reviews) from endorser_capabilities where user_id = p_uid),
    cfg_int('default_endorser_max_active_reviews'), 3)
$$;

create or replace function endorser_reviewing_count(p_uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from engagements where endorser_id = p_uid and state = 'reviewing'
$$;

create or replace function paper_reviewing_count(p_paper uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from engagements where paper_id = p_paper and state = 'reviewing'
$$;

create or replace function is_open_state(s engagement_state) returns boolean
language sql immutable as $$
  select s in ('accepted','waitlisted','reviewing','endorsed_pending_author')
$$;

-- keep paper.status in sync between open and in_review
create or replace function refresh_paper_status(p_paper uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update papers p set status = case
      when exists (select 1 from engagements e where e.paper_id = p.id
                   and e.state in ('reviewing','endorsed_pending_author')) then 'in_review'::paper_status
      else 'open'::paper_status end
  where p.id = p_paper and p.status in ('open','in_review');
end $$;

-- ---------------------------------------------------------------------------
-- co-authorship & karma (§8)
-- ---------------------------------------------------------------------------
create or replace function are_coauthors(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select a <> b and (
    exists (select 1 from profile_publications pa
            join profile_publications pb on pa.source = pb.source and pa.external_id = pb.external_id
            where pa.user_id = a and pb.user_id = b)
    or exists (select 1 from profile_publications p join profiles pr on pr.id = b
               where p.user_id = a and exists (select 1 from unnest(p.coauthor_names) n
                                               where lower(trim(n)) = lower(trim(pr.display_name))))
    or exists (select 1 from profile_publications p join profiles pr on pr.id = a
               where p.user_id = b and exists (select 1 from unnest(p.coauthor_names) n
                                               where lower(trim(n)) = lower(trim(pr.display_name)))))
$$;

create or replace function award_karma(p_uid uuid, p_kind text, p_points int, p_engagement uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_endorser uuid; v_paper uuid; v_rows int;
begin
  if p_engagement is not null then
    select endorser_id, paper_id into v_endorser, v_paper from engagements where id = p_engagement;
    -- no karma between users who are co-authors in profile_publications
    if exists (select 1 from paper_members m where m.paper_id = v_paper and are_coauthors(v_endorser, m.user_id)) then
      insert into audit_log (actor_id, action, entity, entity_id, detail)
      values (auth.uid(), 'karma_skipped_coauthors', 'engagement', p_engagement::text,
              jsonb_build_object('user_id', p_uid, 'kind', p_kind));
      return false;
    end if;
    insert into karma_events (user_id, kind, points, engagement_id)
    values (p_uid, p_kind, p_points, p_engagement)
    on conflict (user_id, kind, engagement_id) do nothing;
  else
    insert into karma_events (user_id, kind, points, engagement_id)
    select p_uid, p_kind, p_points, null
    where not exists (select 1 from karma_events where user_id = p_uid and kind = p_kind and engagement_id is null);
  end if;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end $$;

create or replace function karma_events_cache() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profiles set karma = karma + new.points where id = new.user_id;
  return new;
end $$;
create trigger karma_events_cache after insert on karma_events for each row execute function karma_events_cache();

create or replace function award_badge(p_uid uuid, p_badge text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_rows int;
begin
  insert into badges (user_id, badge) values (p_uid, p_badge) on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    perform notify_user(p_uid, 'badge', jsonb_build_object('badge', p_badge));
  end if;
  return v_rows > 0;
end $$;

-- ---------------------------------------------------------------------------
-- self-review guard (§2.10) — enforced at the table level
-- ---------------------------------------------------------------------------
create or replace function guard_no_self_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'engagements' then
    if exists (select 1 from paper_members where paper_id = new.paper_id and user_id = new.endorser_id) then
      perform fail('You can''t review a paper you are an author of.');
    end if;
  else
    if exists (select 1 from engagements where paper_id = new.paper_id and endorser_id = new.user_id) then
      perform fail('A reviewer of this paper can''t be added as an author.');
    end if;
  end if;
  return new;
end $$;
create trigger engagements_no_self_review before insert or update of paper_id, endorser_id on engagements
  for each row execute function guard_no_self_review();
create trigger paper_members_no_self_review before insert or update of paper_id, user_id on paper_members
  for each row execute function guard_no_self_review();

-- ---------------------------------------------------------------------------
-- embeddings queue
-- ---------------------------------------------------------------------------
create or replace function enqueue_embedding(p_type text, p_id uuid) returns void
language sql security definer set search_path = public as $$
  insert into embedding_jobs (target_type, target_id) values (p_type, p_id)
  on conflict (target_type, target_id) where status = 'queued' do nothing
$$;

create or replace function papers_enqueue_embedding() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('open','in_review') and (tg_op = 'INSERT' or old.title is distinct from new.title
      or old.abstract is distinct from new.abstract or old.status is distinct from new.status) then
    perform enqueue_embedding('paper', new.id);
  end if;
  return new;
end $$;
create trigger papers_enqueue_embedding after insert or update on papers
  for each row execute function papers_enqueue_embedding();

-- ---------------------------------------------------------------------------
-- profile & capability RPCs
-- ---------------------------------------------------------------------------
create or replace function upsert_profile(
  p_handle text, p_display_name text, p_linkedin_url text, p_category_codes text[], p_topic_ids bigint[],
  p_age_confirmed boolean, p_headline text default null, p_bio text default null,
  p_google_scholar_url text default null, p_orcid text default null, p_homepage_url text default null,
  p_hf_username text default null)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_github text;
  v_exists boolean;
begin
  if v_uid is null then perform fail('You need to sign in first.'); end if;
  select exists (select 1 from profiles where id = v_uid) into v_exists;
  if not v_exists and not coalesce(p_age_confirmed, false) then
    perform fail(format('You must be at least %s to use Endorse Commons.', cfg_int('min_age')));
  end if;
  if coalesce(cardinality(p_category_codes), 0) = 0 then
    perform fail('Choose at least one category of interest.');
  end if;
  if exists (select 1 from unnest(p_category_codes) c where not exists (select 1 from categories where code = c and active)) then
    perform fail('Unknown category.');
  end if;
  if p_orcid is not null and p_orcid <> '' and not orcid_valid(p_orcid) then
    perform fail('That ORCID iD is not valid (checksum failed).');
  end if;
  if exists (select 1 from profiles where handle = lower(p_handle) and id <> v_uid) then
    perform fail('That handle is taken.');
  end if;

  select i.identity_data->>'user_name' into v_github
  from auth.identities i where i.user_id = v_uid and i.provider = 'github' limit 1;

  insert into profiles (id, handle, display_name, headline, bio, linkedin_url, google_scholar_url, orcid,
                        homepage_url, hf_username, github_username)
  values (v_uid, lower(p_handle), trim(p_display_name), nullif(trim(p_headline), ''), nullif(trim(p_bio), ''),
          trim(p_linkedin_url), nullif(trim(p_google_scholar_url), ''), nullif(upper(trim(p_orcid)), ''),
          nullif(trim(p_homepage_url), ''), nullif(trim(p_hf_username), ''), v_github)
  on conflict (id) do update set
    handle = excluded.handle, display_name = excluded.display_name, headline = excluded.headline,
    bio = excluded.bio, linkedin_url = excluded.linkedin_url, google_scholar_url = excluded.google_scholar_url,
    orcid = excluded.orcid, homepage_url = excluded.homepage_url, hf_username = excluded.hf_username,
    github_username = coalesce(excluded.github_username, profiles.github_username);

  delete from profile_categories where user_id = v_uid;
  insert into profile_categories (user_id, category_code) select v_uid, c from unnest(p_category_codes) c
  on conflict do nothing;

  delete from profile_interests where user_id = v_uid;
  insert into profile_interests (user_id, topic_id)
  select v_uid, t.id from topics t where t.id = any(coalesce(p_topic_ids, '{}'))
  on conflict do nothing;

  if exists (select 1 from endorser_capabilities where user_id = v_uid) then
    perform enqueue_embedding('endorser', v_uid);
  end if;
  perform log_audit(case when v_exists then 'update_profile' else 'create_profile' end, 'profile', v_uid::text);
  return v_uid;
end $$;

create or replace function set_avatar(p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid();
begin
  if p_path is not null and p_path not like v_uid::text || '/%' then perform fail('Invalid avatar path.'); end if;
  update profiles set avatar_path = p_path where id = v_uid;
  perform log_audit('set_avatar', 'profile', v_uid::text);
end $$;

create or replace function set_public_availability(p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid();
begin
  if p_on and not exists (select 1 from endorser_capabilities where user_id = v_uid) then
    perform fail('Add an endorser category first.');
  end if;
  update profiles set public_availability = p_on where id = v_uid;
  perform log_audit('set_public_availability', 'profile', v_uid::text, jsonb_build_object('on', p_on));
end $$;

create or replace function set_openalex_publications(p_author_id text, p_works jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid(); v_count int;
begin
  if p_author_id is not null and p_author_id !~ '^A\d+$' then perform fail('Invalid OpenAlex author ID.'); end if;
  update profiles set openalex_author_id = p_author_id where id = v_uid;
  delete from profile_publications where user_id = v_uid and source = 'openalex';
  insert into profile_publications (user_id, source, external_id, title, venue, year, url, arxiv_id, coauthor_names)
  select v_uid, 'openalex', w->>'external_id', left(w->>'title', 500), left(w->>'venue', 300),
         nullif(w->>'year', '')::int, w->>'url', w->>'arxiv_id',
         coalesce(array(select jsonb_array_elements_text(w->'coauthor_names')), '{}')
  from jsonb_array_elements(coalesce(p_works, '[]'::jsonb)) w
  where coalesce(w->>'external_id', '') <> '' and coalesce(w->>'title', '') <> ''
  limit 25
  on conflict do nothing;
  get diagnostics v_count = row_count;
  if exists (select 1 from endorser_capabilities where user_id = v_uid) then
    perform enqueue_embedding('endorser', v_uid);
  end if;
  perform log_audit('set_openalex_publications', 'profile', v_uid::text, jsonb_build_object('count', v_count));
  return v_count;
end $$;

create or replace function attest_capability(p_category text, p_evidence_url text) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid();
begin
  if not exists (select 1 from categories where code = p_category and active) then perform fail('Unknown category.'); end if;
  if p_evidence_url !~ '^https://arxiv\.org/auth/show-endorsers/' then
    perform fail('Evidence must be an arXiv "show endorsers" link (https://arxiv.org/auth/show-endorsers/<id>).');
  end if;
  insert into endorser_capabilities (user_id, category_code, evidence_url, max_active_reviews)
  values (v_uid, p_category, p_evidence_url, least(greatest(coalesce(cfg_int('default_endorser_max_active_reviews'), 3), 1), 10))
  on conflict (user_id, category_code) do update
    set evidence_url = excluded.evidence_url, attested_at = now();
  perform enqueue_embedding('endorser', v_uid);
  perform log_audit('attest_capability', 'endorser_capability', v_uid::text || ':' || p_category,
                    jsonb_build_object('evidence_url', p_evidence_url));
end $$;

create or replace function update_capability_settings(p_category text, p_max_active int, p_accepting boolean,
  p_paused_until timestamptz default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid();
begin
  if p_max_active not between 1 and 10 then perform fail('Capacity must be between 1 and 10.'); end if;
  update endorser_capabilities set max_active_reviews = p_max_active, accepting = p_accepting,
         paused_until = p_paused_until
  where user_id = v_uid and category_code = p_category;
  if not found then perform fail('You have no endorser capability in that category.'); end if;
  perform promote_waitlist_for_endorser(v_uid);
  perform log_audit('update_capability_settings', 'endorser_capability', v_uid::text || ':' || p_category,
    jsonb_build_object('max', p_max_active, 'accepting', p_accepting, 'paused_until', p_paused_until));
end $$;

create or replace function remove_capability(p_category text) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid();
begin
  delete from endorser_capabilities where user_id = v_uid and category_code = p_category and status <> 'suspended';
  perform log_audit('remove_capability', 'endorser_capability', v_uid::text || ':' || p_category);
end $$;

-- ---------------------------------------------------------------------------
-- papers (author side)
-- ---------------------------------------------------------------------------
create or replace function validate_paper_input(p_primary text, p_cross text[], p_type paper_type,
  p_proof text, p_topic_ids bigint[]) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from categories where code = p_primary and active) then
    perform fail('Choose a valid primary category.');
  end if;
  if exists (select 1 from unnest(coalesce(p_cross, '{}')) c
             where c = p_primary or not exists (select 1 from categories where code = c and active)) then
    perform fail('Cross-list categories must be valid and different from the primary category.');
  end if;
  if p_primary like 'cs.%' and p_type in ('survey_review','position') and coalesce(trim(p_proof), '') = '' then
    perform fail('arXiv CS only accepts review/survey and position papers that already passed peer review. Add a peer-review proof URL or DOI.');
  end if;
  if coalesce(trim(p_proof), '') <> '' and p_proof !~* '^(https?://\S+|(doi:)?10\.\d{4,9}/\S+)$' then
    perform fail('Peer-review proof must be a URL or a DOI.');
  end if;
  if coalesce(cardinality(p_topic_ids), 0) > 3 then perform fail('Pick at most 3 sub-topics.'); end if;
  if exists (select 1 from unnest(coalesce(p_topic_ids, '{}')) t
             where not exists (select 1 from topics x where x.id = t
                               and (x.category_code = p_primary or x.category_code = any(coalesce(p_cross, '{}'))))) then
    perform fail('Sub-topics must belong to your primary or cross-list categories.');
  end if;
  if exists (select 1 from topics where category_code = p_primary) and coalesce(cardinality(p_topic_ids), 0) = 0 then
    perform fail('Pick 1–3 sub-topics so the right endorsers can find your abstract.');
  end if;
end $$;

create or replace function create_paper_draft(
  p_title text, p_abstract text, p_primary_category text, p_cross_list text[], p_paper_type paper_type,
  p_own_work boolean, p_topic_ids bigint[], p_peer_review_proof_url text default null, p_repo_url text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid(); v_id uuid;
begin
  if not coalesce(p_own_work, false) then
    perform fail('You must confirm: "I am an author of this paper and I''m submitting it myself."');
  end if;
  perform validate_paper_input(p_primary_category, p_cross_list, p_paper_type, p_peer_review_proof_url, p_topic_ids);
  insert into papers (owner_id, title, abstract, primary_category, cross_list_categories, paper_type,
                      peer_review_proof_url, repo_url, own_work_attested_at)
  values (v_uid, trim(p_title), trim(p_abstract), p_primary_category, coalesce(p_cross_list, '{}'), p_paper_type,
          nullif(trim(p_peer_review_proof_url), ''), nullif(trim(p_repo_url), ''), now())
  returning id into v_id;
  insert into paper_members (paper_id, user_id, role) values (v_id, v_uid, 'owner');
  insert into paper_topics (paper_id, topic_id) select v_id, t from unnest(coalesce(p_topic_ids, '{}')) t;
  perform log_audit('create_paper_draft', 'paper', v_id::text);
  return v_id;
end $$;

create or replace function update_abstract(
  p_paper uuid, p_title text, p_abstract text, p_primary_category text, p_cross_list text[],
  p_paper_type paper_type, p_topic_ids bigint[], p_peer_review_proof_url text default null, p_repo_url text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid(); p papers;
begin
  select * into p from papers where id = p_paper for update;
  if not found or p.owner_id <> v_uid then perform fail('Only the paper owner can edit the abstract.'); end if;
  if p.status not in ('draft','open','in_review') then perform fail('This paper is closed and can''t be edited.'); end if;
  if p.status <> 'draft' and (p.primary_category <> p_primary_category or p.paper_type <> p_paper_type) then
    perform fail('Category and paper type are locked once the abstract is posted.');
  end if;
  perform validate_paper_input(p_primary_category, p_cross_list, p_paper_type, p_peer_review_proof_url, p_topic_ids);
  update papers set title = trim(p_title), abstract = trim(p_abstract), primary_category = p_primary_category,
         cross_list_categories = coalesce(p_cross_list, '{}'), paper_type = p_paper_type,
         peer_review_proof_url = nullif(trim(p_peer_review_proof_url), ''), repo_url = nullif(trim(p_repo_url), '')
  where id = p_paper;
  delete from paper_topics where paper_id = p_paper;
  insert into paper_topics (paper_id, topic_id) select p_paper, t from unnest(coalesce(p_topic_ids, '{}')) t;
  perform log_audit('update_abstract', 'paper', p_paper::text);
end $$;

-- arXiv readiness check (§13b.B). Item ids are mirrored in src/lib/readiness.ts.
create or replace function evaluate_readiness(p_answers jsonb, p_paper papers) returns text[]
language plpgsql stable set search_path = public as $$
declare v_failed text[] := '{}';
begin
  if coalesce(p_answers->>'paper_type', '') <> p_paper.paper_type::text
     or (p_paper.primary_category like 'cs.%' and p_paper.paper_type in ('survey_review','position')
         and p_paper.peer_review_proof_url is null) then
    v_failed := array_append(v_failed, 'paper_type');
  end if;
  if coalesce(p_answers->>'english_complete', '') <> 'true' then v_failed := array_append(v_failed, 'english_complete'); end if;
  if coalesce(p_answers->>'draft_finished', '') <> 'true' then v_failed := array_append(v_failed, 'draft_finished'); end if;
  if coalesce(p_answers->>'primary_category', '') <> p_paper.primary_category then v_failed := array_append(v_failed, 'primary_category'); end if;
  if coalesce(p_answers->>'own_work', '') <> 'true' then v_failed := array_append(v_failed, 'own_work'); end if;
  -- item 6 (has_endorsement_code) is informational: posting is allowed without it
  if coalesce(p_answers->>'no_mass_asking', '') <> 'true' then v_failed := array_append(v_failed, 'no_mass_asking'); end if;
  return v_failed;
end $$;

create or replace function submit_readiness_check(p_paper uuid, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid(); p papers; v_failed text[]; v_row readiness_checks;
begin
  select * into p from papers where id = p_paper;
  if not found or not is_paper_member(p_paper, v_uid) then perform fail('Paper not found.'); end if;
  if p.status <> 'draft' then perform fail('The readiness check is only needed before posting.'); end if;
  v_failed := evaluate_readiness(p_answers, p);
  insert into readiness_checks (paper_id, answers, passed, failed_items, checked_at)
  values (p_paper, p_answers, cardinality(v_failed) = 0, v_failed, clock_timestamp())
  returning * into v_row;
  perform log_audit('submit_readiness_check', 'paper', p_paper::text, jsonb_build_object('passed', v_row.passed));
  return jsonb_build_object('passed', v_row.passed, 'failed_items', to_jsonb(v_row.failed_items), 'id', v_row.id);
end $$;

create or replace function post_abstract(p_paper uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid(); p papers; v_check readiness_checks; v_open int;
begin
  select * into p from papers where id = p_paper for update;
  if not found or p.owner_id <> v_uid then perform fail('Only the paper owner can post the abstract.'); end if;
  if p.status <> 'draft' then perform fail('This abstract is already posted.'); end if;
  select * into v_check from readiness_checks where paper_id = p_paper order by checked_at desc limit 1;
  if v_check.id is null or not v_check.passed or v_check.checked_at < p.updated_at
     or cardinality(evaluate_readiness(v_check.answers, p)) > 0 then
    perform fail('Pass the arXiv readiness check for the current version of your abstract before posting.');
  end if;
  select count(*) into v_open from papers where owner_id = v_uid and status in ('open','in_review');
  if v_open >= cfg_int('max_open_papers_per_author') then
    perform fail(format('You can have at most %s open papers at a time.', cfg_int('max_open_papers_per_author')));
  end if;
  update papers set status = 'open', posted_at = now() where id = p_paper;
  perform log_audit('post_abstract', 'paper', p_paper::text);
end $$;

create or replace function withdraw_paper(p_paper uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid(); p papers; r record;
begin
  select * into p from papers where id = p_paper for update;
  if not found or p.owner_id <> v_uid then perform fail('Only the paper owner can withdraw it.'); end if;
  if p.status not in ('draft','open','in_review') then perform fail('This paper is already closed.'); end if;
  update papers set status = 'withdrawn', closed_at = now() where id = p_paper;
  delete from endorsements where paper_id = p_paper and author_confirmed_at is null;
  for r in select * from engagements where paper_id = p_paper and is_open_state(state) loop
    update engagements set state = 'released_by_author', closed_at = now() where id = r.id;
    perform notify_user(r.endorser_id, 'paper_withdrawn', jsonb_build_object('paper_id', p_paper, 'engagement_id', r.id));
  end loop;
  perform log_audit('withdraw_paper', 'paper', p_paper::text);
end $$;

create or replace function add_coauthor(p_paper uuid, p_handle text) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid(); v_target uuid;
begin
  if not exists (select 1 from papers where id = p_paper and owner_id = v_uid and status in ('draft','open','in_review')) then
    perform fail('Only the owner of an open paper can add co-authors.');
  end if;
  select id into v_target from profiles where handle = lower(p_handle);
  if v_target is null then perform fail('No member with that handle.'); end if;
  insert into paper_members (paper_id, user_id, role) values (p_paper, v_target, 'coauthor') on conflict do nothing;
  perform notify_user(v_target, 'coauthor_added', jsonb_build_object('paper_id', p_paper));
  perform log_audit('add_coauthor', 'paper', p_paper::text, jsonb_build_object('user_id', v_target));
end $$;

create or replace function remove_coauthor(p_paper uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid();
begin
  if not exists (select 1 from papers where id = p_paper and owner_id = v_uid) then
    perform fail('Only the owner can remove co-authors.');
  end if;
  delete from paper_members where paper_id = p_paper and user_id = p_user and role = 'coauthor';
  perform log_audit('remove_coauthor', 'paper', p_paper::text, jsonb_build_object('user_id', p_user));
end $$;

create or replace function set_endorsement_code(p_paper uuid, p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid(); p papers; v_code text := upper(trim(p_code));
begin
  select * into p from papers where id = p_paper;
  if not found or not is_paper_member(p_paper, v_uid) then perform fail('Paper not found.'); end if;
  if p.status not in ('open','in_review') then perform fail('The paper must be open to set a code.'); end if;
  if v_code !~ '^[A-Z0-9]{6}$' then perform fail('An arXiv endorsement code is 6 letters or digits.'); end if;
  if exists (select 1 from paper_secrets where endorsement_code = v_code and paper_id <> p_paper) then
    perform fail('That endorsement code is already registered on another paper.');
  end if;
  insert into paper_secrets (paper_id, endorsement_code, category_code) values (p_paper, v_code, p.primary_category)
  on conflict (paper_id) do update set endorsement_code = excluded.endorsement_code, set_at = now();
  perform log_audit('set_endorsement_code', 'paper', p_paper::text);
end $$;

create or replace function upload_version(p_paper uuid, p_storage_path text, p_sha256 text, p_size_bytes int,
  p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid(); p papers; v_id uuid; v_no int; r record;
begin
  select * into p from papers where id = p_paper for update;
  if not found or not is_paper_member(p_paper, v_uid) then perform fail('Paper not found.'); end if;
  if p.status not in ('open','in_review') then perform fail('You can only upload to an open paper.'); end if;
  if p_storage_path not like p_paper::text || '/%' or p_storage_path !~ '\.pdf$' then
    perform fail('Invalid storage path.');
  end if;
  if p_size_bytes > cfg_int('max_pdf_bytes') then perform fail('PDFs must be 10 MB or smaller.'); end if;
  if not exists (select 1 from paper_versions where paper_id = p_paper)
     and not exists (select 1 from engagements where paper_id = p_paper and is_open_state(state)) then
    perform fail('You can upload the full paper once at least one endorser has accepted your abstract.');
  end if;
  select coalesce(max(version_no), 0) + 1 into v_no from paper_versions where paper_id = p_paper;
  insert into paper_versions (paper_id, version_no, storage_path, sha256, size_bytes, note, uploaded_by)
  values (p_paper, v_no, p_storage_path, lower(p_sha256), p_size_bytes, nullif(trim(p_note), ''), v_uid)
  returning id into v_id;
  for r in select id, endorser_id from engagements where paper_id = p_paper
           and state in ('reviewing','endorsed_pending_author') loop
    update engagements set last_activity_at = now() where id = r.id;
    perform notify_user(r.endorser_id, 'new_version',
      jsonb_build_object('paper_id', p_paper, 'engagement_id', r.id, 'version_no', v_no));
  end loop;
  perform log_audit('upload_version', 'paper_version', v_id::text, jsonb_build_object('paper_id', p_paper, 'version_no', v_no));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- waitlist & sharing (§5)
-- ---------------------------------------------------------------------------
create or replace function start_reviewing(p_engagement uuid, p_promoted boolean) returns void
language plpgsql security definer set search_path = public as $$
declare e engagements;
begin
  update engagements set state = 'reviewing', waitlist_reason = null, reviewing_since = now(),
         last_activity_at = now()
  where id = p_engagement returning * into e;
  perform refresh_paper_status(e.paper_id);
  if p_promoted then
    perform notify_user(e.endorser_id, 'waitlist_promoted', jsonb_build_object('paper_id', e.paper_id, 'engagement_id', e.id));
    perform notify_paper_members(e.paper_id, 'waitlist_promoted', jsonb_build_object('engagement_id', e.id));
    perform log_audit('promote_waitlist', 'engagement', e.id::text);
  else
    perform notify_user(e.endorser_id, 'paper_shared', jsonb_build_object('paper_id', e.paper_id, 'engagement_id', e.id));
  end if;
end $$;

create or replace function promote_waitlist(p_paper uuid) returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_promoted int := 0; v_cat text;
begin
  select primary_category into v_cat from papers where id = p_paper and status in ('open','in_review') for update;
  if v_cat is null then return 0; end if;
  for r in select id, endorser_id from engagements
           where paper_id = p_paper and state = 'waitlisted'
           order by waitlisted_at, accepted_at loop
    exit when paper_reviewing_count(p_paper) >= cfg_int('max_active_reviewers_per_paper');
    if endorser_reviewing_count(r.endorser_id) < endorser_max(r.endorser_id, v_cat) then
      perform start_reviewing(r.id, true);
      v_promoted := v_promoted + 1;
    end if;
  end loop;
  return v_promoted;
end $$;

create or replace function promote_waitlist_for_endorser(p_uid uuid) returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_promoted int := 0;
begin
  for r in select e.id, e.paper_id, p.primary_category from engagements e join papers p on p.id = e.paper_id
           where e.endorser_id = p_uid and e.state = 'waitlisted' and p.status in ('open','in_review')
           order by e.waitlisted_at, e.accepted_at loop
    if endorser_reviewing_count(p_uid) < endorser_max(p_uid, r.primary_category)
       and paper_reviewing_count(r.paper_id) < cfg_int('max_active_reviewers_per_paper') then
      perform start_reviewing(r.id, true);
      v_promoted := v_promoted + 1;
    end if;
  end loop;
  return v_promoted;
end $$;

-- whenever an engagement leaves `reviewing` for a terminal reason, promote waitlists (§5.3)
create or replace function engagements_after_state_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.state = 'reviewing' and new.state in ('declined','withdrawn_by_endorser','released_by_author','expired') then
    perform refresh_paper_status(new.paper_id);
    perform promote_waitlist(new.paper_id);
    perform promote_waitlist_for_endorser(new.endorser_id);
  elsif old.state = 'endorsed_pending_author' and new.state = 'released_by_author' then
    perform refresh_paper_status(new.paper_id);
    perform promote_waitlist(new.paper_id);
  end if;
  return new;
end $$;
create trigger engagements_after_state_change after update of state on engagements
  for each row when (old.state is distinct from new.state) execute function engagements_after_state_change();

create or replace function waitlist_position(p_engagement uuid) returns int
language plpgsql stable security definer set search_path = public as $$
declare e engagements;
begin
  select * into e from engagements where id = p_engagement;
  if e.id is null or e.state <> 'waitlisted' then return null; end if;
  if not (e.endorser_id = auth.uid() or is_paper_member(e.paper_id, auth.uid())) then return null; end if;
  if e.waitlist_reason = 'endorser_full' then
    return (select count(*) from engagements x where x.endorser_id = e.endorser_id and x.state = 'waitlisted'
            and (x.waitlisted_at, x.accepted_at) <= (e.waitlisted_at, e.accepted_at))::int;
  end if;
  return (select count(*) from engagements x where x.paper_id = e.paper_id and x.state = 'waitlisted'
          and (x.waitlisted_at, x.accepted_at) <= (e.waitlisted_at, e.accepted_at))::int;
end $$;

-- ---------------------------------------------------------------------------
-- engagements (endorser side)
-- ---------------------------------------------------------------------------
create or replace function nudge_responded(p_paper uuid, p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_sent timestamptz;
begin
  update nudges set responded_at = now()
  where paper_id = p_paper and endorser_id = p_uid and responded_at is null
  returning sent_at into v_sent;
  if v_sent is not null and v_sent > now() - interval '72 hours' then
    perform award_karma(p_uid, 'nudge_response:' || p_paper::text, 1, null);
  end if;
end $$;

create or replace function accept_abstract(p_paper uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid(); p papers; v_id uuid;
begin
  select * into p from papers where id = p_paper for update;
  if not found or p.status not in ('open','in_review') then perform fail('This abstract is not open for review.'); end if;
  if is_paper_member(p_paper, v_uid) then perform fail('You can''t review a paper you are an author of.'); end if;
  if not endorser_is_available(v_uid, p.primary_category) then
    perform fail(format('You need an active (not paused) endorser capability in %s to accept this abstract.', p.primary_category));
  end if;
  if exists (select 1 from engagements where paper_id = p_paper and endorser_id = v_uid) then
    perform fail('You have already engaged with this paper.');
  end if;
  insert into engagements (paper_id, endorser_id) values (p_paper, v_uid) returning id into v_id;
  delete from abstract_passes where paper_id = p_paper and user_id = v_uid;
  perform nudge_responded(p_paper, v_uid);
  perform notify_paper_members(p_paper, 'abstract_accepted',
    jsonb_build_object('engagement_id', v_id, 'endorser_id', v_uid));
  perform log_audit('accept_abstract', 'engagement', v_id::text, jsonb_build_object('paper_id', p_paper));
  return v_id;
end $$;

create or replace function pass_abstract(p_paper uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid();
begin
  if not exists (select 1 from papers where id = p_paper and status in ('open','in_review')) then
    perform fail('This abstract is not open.');
  end if;
  insert into abstract_passes (paper_id, user_id) values (p_paper, v_uid) on conflict do nothing;
  perform nudge_responded(p_paper, v_uid);
  perform log_audit('pass_abstract', 'paper', p_paper::text);
end $$;

create or replace function share_paper(p_engagement uuid) returns engagement_state
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid(); e engagements; p papers;
begin
  select * into e from engagements where id = p_engagement;
  if not found or not is_paper_member(e.paper_id, v_uid) then perform fail('Engagement not found.'); end if;
  select * into p from papers where id = e.paper_id for update;
  select * into e from engagements where id = p_engagement for update;
  if e.state <> 'accepted' then perform fail('You can only share with a reviewer who has accepted and not yet received the paper.'); end if;
  if p.status not in ('open','in_review') then perform fail('This paper is closed.'); end if;
  if not exists (select 1 from paper_versions where paper_id = p.id and deleted_at is null) then
    perform fail('Upload the full paper (PDF) before sharing.');
  end if;
  if not exists (select 1 from paper_secrets where paper_id = p.id) then
    perform fail('Add your arXiv endorsement code before sharing the full paper.');
  end if;
  update engagements set shared_at = now(), last_activity_at = now() where id = e.id;
  if paper_reviewing_count(p.id) >= cfg_int('max_active_reviewers_per_paper') then
    update engagements set state = 'waitlisted', waitlist_reason = 'paper_full', waitlisted_at = now() where id = e.id;
    perform notify_user(e.endorser_id, 'waitlisted', jsonb_build_object('paper_id', p.id, 'engagement_id', e.id, 'reason', 'paper_full'));
  elsif endorser_reviewing_count(e.endorser_id) >= endorser_max(e.endorser_id, p.primary_category) then
    update engagements set state = 'waitlisted', waitlist_reason = 'endorser_full', waitlisted_at = now() where id = e.id;
    perform notify_user(e.endorser_id, 'waitlisted', jsonb_build_object('paper_id', p.id, 'engagement_id', e.id, 'reason', 'endorser_full'));
  else
    perform start_reviewing(e.id, false);
  end if;
  perform log_audit('share_paper', 'engagement', e.id::text);
  return (select state from engagements where id = e.id);
end $$;

create or replace function release_reviewer(p_engagement uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid(); e engagements;
begin
  select * into e from engagements where id = p_engagement for update;
  if not found or not is_paper_member(e.paper_id, v_uid) then perform fail('Engagement not found.'); end if;
  if not is_open_state(e.state) then perform fail('This review is already closed.'); end if;
  delete from endorsements where engagement_id = e.id and author_confirmed_at is null;
  update engagements set state = 'released_by_author', closed_at = now() where id = e.id;
  perform notify_user(e.endorser_id, 'released', jsonb_build_object('paper_id', e.paper_id, 'engagement_id', e.id));
  perform log_audit('release_reviewer', 'engagement', e.id::text);
end $$;

create or replace function withdraw_engagement(p_engagement uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid(); e engagements;
begin
  select * into e from engagements where id = p_engagement for update;
  if not found or e.endorser_id <> v_uid then perform fail('Engagement not found.'); end if;
  if e.state not in ('accepted','waitlisted','reviewing') then perform fail('You can''t withdraw at this stage.'); end if;
  update engagements set state = 'withdrawn_by_endorser', closed_at = now() where id = e.id;
  perform notify_paper_members(e.paper_id, 'reviewer_withdrew', jsonb_build_object('engagement_id', e.id));
  perform log_audit('withdraw_engagement', 'engagement', e.id::text);
end $$;

-- called by the server action that issues the 5-minute signed URL; unlocks the endorse action
create or replace function log_paper_open(p_engagement uuid, p_version uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid(); e engagements; v paper_versions;
begin
  select * into e from engagements where id = p_engagement for update;
  if not found or e.endorser_id <> v_uid then perform fail('Engagement not found.'); end if;
  if e.state not in ('reviewing','endorsed_pending_author','endorsed') then
    perform fail('The full paper is available once the author has shared it with you and you are reviewing.');
  end if;
  select * into v from paper_versions where id = p_version and paper_id = e.paper_id;
  if not found or v.storage_path is null then perform fail('That version is no longer available.'); end if;
  update engagements set paper_opened_at = coalesce(paper_opened_at, now()), paper_opened_version = v.id,
         last_activity_at = case when state = 'reviewing' then now() else last_activity_at end
  where id = e.id;
  perform log_audit('log_paper_open', 'engagement', e.id::text, jsonb_build_object('version_id', v.id));
  return v.storage_path;
end $$;

create or replace function mark_linkedin_checked(p_engagement uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid(); e engagements;
begin
  select * into e from engagements where id = p_engagement for update;
  if not found or e.endorser_id <> v_uid then perform fail('Engagement not found.'); end if;
  if e.state <> 'reviewing' then perform fail('You can only do this while reviewing.'); end if;
  update engagements set linkedin_checked_at = now(), last_activity_at = now() where id = e.id;
  perform log_audit('mark_linkedin_checked', 'engagement', e.id::text);
end $$;

create or replace function send_feedback(p_engagement uuid, p_body text, p_version uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := require_uid(); e engagements; v_last uuid; v_round int; v_id uuid; v_reviews int;
begin
  select * into e from engagements where id = p_engagement for update;
  if not found or not (e.endorser_id = v_uid or is_paper_member(e.paper_id, v_uid)) then
    perform fail('Engagement not found.');
  end if;
  if e.state not in ('reviewing','endorsed_pending_author') then
    perform fail('Feedback is only possible while a review is active.');
  end if;
  if coalesce(trim(p_body), '') = '' then perform fail('Write something first.'); end if;
  if p_version is not null and not exists (select 1 from paper_versions where id = p_version and paper_id = e.paper_id) then
    perform fail('Unknown paper version.');
  end if;

  if v_uid = e.endorser_id then
    select sender_id into v_last from feedback_messages where engagement_id = e.id order by created_at desc limit 1;
    if v_last is null or v_last <> e.endorser_id then
      v_round := e.feedback_rounds + 1;   -- a reviewer turn after the author (or first message) opens a new round
      update engagements set feedback_rounds = v_round, last_activity_at = now() where id = e.id;
      if v_round <= 3 then
        perform award_karma(e.endorser_id, 'feedback_round_' || v_round, 3, e.id);
      end if;
      if v_round = 1 then
        perform award_badge(e.endorser_id, 'first_review');
        select count(*) into v_reviews from engagements where endorser_id = e.endorser_id and feedback_rounds > 0;
        if v_reviews >= 10 then perform award_badge(e.endorser_id, '10_reviews'); end if;
      end if;
    else
      v_round := greatest(e.feedback_rounds, 1);
      update engagements set last_activity_at = now() where id = e.id;
    end if;
    insert into feedback_messages (engagement_id, sender_id, round, body, paper_version_id)
    values (e.id, v_uid, v_round, p_body, p_version) returning id into v_id;
    perform notify_paper_members(e.paper_id, 'feedback', jsonb_build_object('engagement_id', e.id, 'round', v_round));
  else
    v_round := e.feedback_rounds;
    insert into feedback_messages (engagement_id, sender_id, round, body, paper_version_id)
    values (e.id, v_uid, v_round, p_body, p_version) returning id into v_id;
    perform notify_user(e.endorser_id, 'feedback', jsonb_build_object('paper_id', e.paper_id, 'engagement_id', e.id, 'round', v_round));
  end if;
  perform log_audit('send_feedback', 'engagement', e.id::text, jsonb_build_object('round', v_round));
  return v_id;
end $$;

create or replace function rate_feedback(p_engagement uuid, p_helpful boolean, p_comment text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid(); e engagements;
begin
  select * into e from engagements where id = p_engagement;
  if not found or not is_paper_member(e.paper_id, v_uid) then perform fail('Engagement not found.'); end if;
  if e.feedback_rounds < 1 then perform fail('There is no feedback to rate yet.'); end if;
  if exists (select 1 from feedback_ratings where engagement_id = e.id) then perform fail('You already rated this feedback.'); end if;
  insert into feedback_ratings (engagement_id, rated_by, helpful, comment)
  values (e.id, v_uid, p_helpful, nullif(trim(p_comment), ''));
  if p_helpful then perform award_karma(e.endorser_id, 'feedback_helpful', 2, e.id); end if;
  perform award_karma(v_uid, 'rated_feedback', 1, e.id);
  perform notify_user(e.endorser_id, 'feedback_rated', jsonb_build_object('paper_id', e.paper_id, 'engagement_id', e.id, 'helpful', p_helpful));
  perform log_audit('rate_feedback', 'engagement', e.id::text, jsonb_build_object('helpful', p_helpful));
end $$;

-- first reviewer decision fulfills the pay-it-forward pledge (§13b.C)
create or replace function fulfill_pledges(p_uid uuid, p_engagement uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_rows int;
begin
  update pledges set status = 'fulfilled', fulfilled_engagement_id = p_engagement
  where user_id = p_uid and status in ('pending','reminded');
  get diagnostics v_rows = row_count;
  if v_rows > 0 and award_badge(p_uid, 'pay_it_forward') then
    perform award_karma(p_uid, 'pledge_fulfilled', 5, p_engagement);
  end if;
end $$;

create or replace function record_endorsed(p_engagement uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid(); e engagements; p papers; v_cat text;
begin
  select * into e from engagements where id = p_engagement;
  if not found or e.endorser_id <> v_uid then perform fail('Engagement not found.'); end if;
  select * into p from papers where id = e.paper_id for update;
  select * into e from engagements where id = p_engagement for update;
  if e.state <> 'reviewing' then perform fail('You can only endorse while reviewing.'); end if;
  if e.paper_opened_at is null then perform fail('Open the full paper on the platform before endorsing.'); end if;
  if e.linkedin_checked_at is null then perform fail('Confirm you checked the author''s LinkedIn before endorsing.'); end if;
  if p.status not in ('open','in_review') then perform fail('This paper is closed.'); end if;
  if exists (select 1 from endorsements where paper_id = p.id) then
    perform fail('Another reviewer has already recorded an endorsement for this paper.');
  end if;
  select category_code into v_cat from paper_secrets where paper_id = p.id;
  insert into endorsements (engagement_id, paper_id, endorser_id, category_code)
  values (e.id, p.id, v_uid, coalesce(v_cat, p.primary_category));
  update engagements set state = 'endorsed_pending_author', decided_at = now(), last_activity_at = now() where id = e.id;
  perform award_karma(v_uid, 'decision', 3, e.id);
  perform fulfill_pledges(v_uid, e.id);
  perform notify_paper_members(p.id, 'endorsement_recorded', jsonb_build_object('engagement_id', e.id));
  perform log_audit('record_endorsed', 'engagement', e.id::text);
end $$;

create or replace function confirm_endorsement(p_engagement uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid(); e engagements; r record;
begin
  select * into e from engagements where id = p_engagement;
  if not found or not is_paper_member(e.paper_id, v_uid) then perform fail('Engagement not found.'); end if;
  perform 1 from papers where id = e.paper_id for update;
  select * into e from engagements where id = p_engagement for update;
  if e.state <> 'endorsed_pending_author' then perform fail('There is no endorsement awaiting your confirmation.'); end if;

  update endorsements set author_confirmed_at = now() where engagement_id = e.id;
  update papers set status = 'endorsed', endorsed_at = now(), closed_at = now() where id = e.paper_id;
  update engagements set state = 'endorsed', closed_at = now() where id = e.id;
  -- endorsed ends everything: fan out to every other open engagement (§5.5)
  for r in select id, endorser_id from engagements
           where paper_id = e.paper_id and id <> e.id and is_open_state(state) loop
    update engagements set state = 'closed_endorsed_elsewhere', closed_at = now() where id = r.id;
    perform notify_user(r.endorser_id, 'endorsed_elsewhere', jsonb_build_object('paper_id', e.paper_id, 'engagement_id', r.id));
  end loop;
  perform notify_user(e.endorser_id, 'endorsement_confirmed', jsonb_build_object('paper_id', e.paper_id, 'engagement_id', e.id));
  perform notify_paper_members(e.paper_id, 'add_arxiv_id', jsonb_build_object('day', 0));
  perform log_audit('confirm_endorsement', 'engagement', e.id::text);
end $$;

create or replace function record_declined(p_engagement uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid(); e engagements;
begin
  select * into e from engagements where id = p_engagement for update;
  if not found or e.endorser_id <> v_uid then perform fail('Engagement not found.'); end if;
  if e.state <> 'reviewing' then perform fail('You can only decline while reviewing.'); end if;
  if coalesce(trim(p_reason), '') = '' then perform fail('Please give the author a reason.'); end if;
  update engagements set state = 'declined', decided_at = now(), closed_at = now(), decline_reason = trim(p_reason)
  where id = e.id;
  perform award_karma(v_uid, 'decision', 3, e.id);   -- same points as endorsing (§2.8)
  perform fulfill_pledges(v_uid, e.id);
  perform notify_paper_members(e.paper_id, 'declined', jsonb_build_object('engagement_id', e.id));
  perform log_audit('record_declined', 'engagement', e.id::text);
end $$;

-- ---------------------------------------------------------------------------
-- arXiv verification (§13b.A) — service role only; the server action queries the arXiv API first
-- ---------------------------------------------------------------------------
create or replace function verify_arxiv_posting(p_actor uuid, p_paper uuid, p_arxiv_id text,
  p_arxiv_categories text[], p_author_matched boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p papers; en endorsements; v_confirmed boolean := false;
begin
  select * into p from papers where id = p_paper for update;
  if not found or not is_paper_member(p_paper, p_actor) then perform fail('Paper not found.'); end if;
  if p.status not in ('endorsed','posted') then perform fail('Add the arXiv ID after your endorsement is confirmed.'); end if;
  if p_arxiv_id !~ '^(\d{4}\.\d{4,5}|[a-z\-]+(\.[A-Z]{2})?/\d{7})$' then perform fail('That doesn''t look like an arXiv ID.'); end if;
  select * into en from endorsements where paper_id = p_paper and author_confirmed_at is not null;
  if en.id is null then perform fail('No confirmed endorsement for this paper.'); end if;
  if not coalesce(p_author_matched, false) then
    perform fail('Your display name doesn''t match any author listed on arXiv for that ID.');
  end if;
  if not (en.category_code = any(coalesce(p_arxiv_categories, '{}'))) then
    perform fail(format('That arXiv paper isn''t listed in %s, the endorsed category.', en.category_code));
  end if;

  update papers set status = 'posted', arxiv_id = p_arxiv_id, arxiv_verified_at = coalesce(arxiv_verified_at, now())
  where id = p_paper;
  update endorsements set arxiv_verified_at = coalesce(arxiv_verified_at, now()) where id = en.id;
  perform award_karma(en.endorser_id, 'endorsed_posted', 5, en.engagement_id);

  update endorser_capabilities set status = 'confirmed', confirmed_at = now()
  where user_id = en.endorser_id and category_code = en.category_code and status = 'claimed';
  if found then
    v_confirmed := true;
    perform award_badge(en.endorser_id, 'confirmed_endorser');
  end if;

  -- pay-it-forward reminder: arXiv verified posting date + 3 months
  update pledges set remind_on = (now() + interval '3 months')::date
  where source_paper_id = p_paper and status = 'pending' and remind_on is null;

  perform notify_user(en.endorser_id, 'endorsed_paper_posted',
    jsonb_build_object('paper_id', p_paper, 'arxiv_id', p_arxiv_id, 'capability_confirmed', v_confirmed));
  insert into audit_log (actor_id, action, entity, entity_id, detail)
  values (p_actor, 'verify_arxiv_posting', 'paper', p_paper::text, jsonb_build_object('arxiv_id', p_arxiv_id));
  return jsonb_build_object('verified', true, 'capability_confirmed', v_confirmed);
end $$;

-- ---------------------------------------------------------------------------
-- pledges (§13b.C)
-- ---------------------------------------------------------------------------
create or replace function create_pledge(p_category text, p_topic_ids bigint[] default '{}', p_source_paper uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid(); v_id uuid; v_remind date;
begin
  if not exists (select 1 from categories where code = p_category) then perform fail('Unknown category.'); end if;
  if p_source_paper is not null then
    if not is_paper_member(p_source_paper, v_uid) then perform fail('Paper not found.'); end if;
    select (arxiv_verified_at + interval '3 months')::date into v_remind from papers where id = p_source_paper;
  end if;
  insert into pledges (user_id, source_paper_id, category_code, topic_ids, remind_on)
  values (v_uid, p_source_paper, p_category, coalesce(p_topic_ids, '{}'), v_remind)
  on conflict (user_id, category_code) do update
    set topic_ids = excluded.topic_ids,
        source_paper_id = coalesce(excluded.source_paper_id, pledges.source_paper_id),
        remind_on = coalesce(pledges.remind_on, excluded.remind_on),
        status = case when pledges.status = 'declined' then 'pending'::pledge_status else pledges.status end
  returning id into v_id;
  perform log_audit('create_pledge', 'pledge', v_id::text);
  return v_id;
end $$;

create or replace function decline_pledge(p_pledge uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid();
begin
  update pledges set status = 'declined' where id = p_pledge and user_id = v_uid and status in ('pending','reminded');
  if not found then perform fail('Pledge not found.'); end if;
  perform log_audit('decline_pledge', 'pledge', p_pledge::text);
end $$;

-- ---------------------------------------------------------------------------
-- nudges (§7) — in-app only, max N per paper per week
-- ---------------------------------------------------------------------------
create or replace function send_nudge(p_paper uuid, p_endorser uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_uid(); p papers; v_recent int;
begin
  select * into p from papers where id = p_paper for update;
  if not found or not is_paper_member(p_paper, v_uid) then perform fail('Paper not found.'); end if;
  if p.status not in ('open','in_review') then perform fail('Only open papers can nudge endorsers.'); end if;
  if is_paper_member(p_paper, p_endorser) then perform fail('You can''t nudge a co-author.'); end if;
  if not endorser_is_available(p_endorser, p.primary_category) then perform fail('That endorser is not accepting right now.'); end if;
  if exists (select 1 from engagements where paper_id = p_paper and endorser_id = p_endorser) then
    perform fail('That endorser already engaged with your paper.');
  end if;
  select count(*) into v_recent from nudges where paper_id = p_paper and sent_at > now() - interval '7 days';
  if v_recent >= cfg_int('max_nudges_per_paper_per_week') then
    perform fail(format('You can nudge at most %s endorsers per paper per week.', cfg_int('max_nudges_per_paper_per_week')));
  end if;
  begin
    insert into nudges (paper_id, endorser_id) values (p_paper, p_endorser);
  exception when unique_violation then
    perform fail('You already nudged this endorser for this paper.');
  end;
  perform notify_user(p_endorser, 'nudge', jsonb_build_object('paper_id', p_paper));
  perform log_audit('send_nudge', 'paper', p_paper::text, jsonb_build_object('endorser_id', p_endorser));
end $$;

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create or replace function mark_all_notifications_read() returns void
language sql security definer set search_path = public as $$
  update notifications set read_at = now() where user_id = auth.uid() and read_at is null
$$;

-- ---------------------------------------------------------------------------
-- moderation (role 'moderator')
-- ---------------------------------------------------------------------------
create or replace function require_moderator() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v uuid := require_uid();
begin
  if not is_moderator(v) then perform fail('Moderators only.'); end if;
  return v;
end $$;

create or replace function mod_set_endorsement_removed(p_endorsement uuid, p_removed boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_moderator(); en endorsements;
begin
  update endorsements set removed_flag = p_removed where id = p_endorsement returning * into en;
  if en.id is null then perform fail('Endorsement not found.'); end if;
  if p_removed then
    perform award_karma(en.endorser_id, 'endorsement_removed', -10, en.engagement_id);
    perform notify_user(en.endorser_id, 'endorsement_removed', jsonb_build_object('paper_id', en.paper_id));
  end if;
  perform log_audit('mod_set_endorsement_removed', 'endorsement', p_endorsement::text, jsonb_build_object('removed', p_removed));
end $$;

create or replace function mod_update_flag(p_flag bigint, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_moderator();
begin
  update moderation_flags set status = p_status where id = p_flag;
  perform log_audit('mod_update_flag', 'moderation_flag', p_flag::text, jsonb_build_object('status', p_status));
end $$;

create or replace function mod_update_report(p_report bigint, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_moderator();
begin
  update reports set status = p_status where id = p_report;
  perform log_audit('mod_update_report', 'report', p_report::text, jsonb_build_object('status', p_status));
end $$;

create or replace function mod_set_config(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_moderator();
begin
  if not exists (select 1 from platform_config where key = p_key) then perform fail('Unknown config key.'); end if;
  update platform_config set value = p_value where key = p_key;
  perform log_audit('mod_set_config', 'platform_config', p_key, jsonb_build_object('value', p_value));
end $$;

create or replace function mod_set_capability_status(p_user uuid, p_category text, p_status capability_status) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := require_moderator();
begin
  update endorser_capabilities set status = p_status,
    confirmed_at = case when p_status = 'confirmed' then coalesce(confirmed_at, now()) else confirmed_at end
  where user_id = p_user and category_code = p_category;
  perform log_audit('mod_set_capability_status', 'endorser_capability', p_user::text || ':' || p_category,
                    jsonb_build_object('status', p_status));
end $$;

-- ---------------------------------------------------------------------------
-- matching (§7)
-- ---------------------------------------------------------------------------
create or replace function smart_match_active(p_cat text) returns boolean
language sql stable security definer set search_path = public as $$
  select (select count(*) from papers where primary_category = p_cat and status <> 'draft')
           >= coalesce(cfg_int('smart_match_min_papers'), 50)
     and (select count(*) from endorser_capabilities where category_code = p_cat and status <> 'suspended')
           >= coalesce(cfg_int('smart_match_min_endorsers'), 30)
$$;

create or replace function recency_boost(p_ts timestamptz) returns numeric
language sql stable as $$
  select greatest(0, 1 - extract(epoch from (now() - coalesce(p_ts, now()))) / (14 * 86400))::numeric
$$;

create or replace function match_papers_for_endorser(p_uid uuid, p_limit int default 30)
returns table (paper_id uuid, title text, abstract text, primary_category text, cross_list_categories text[],
               paper_type paper_type, status paper_status, posted_at timestamptz, topic_ids bigint[],
               shared_topics int, score numeric, can_accept boolean, at_capacity boolean, nudged boolean)
language plpgsql stable security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare v_full boolean;
begin
  if p_uid is distinct from auth.uid() and coalesce(auth.role(), '') <> 'service_role' then
    perform fail('Not allowed.');
  end if;
  v_full := endorser_reviewing_count(p_uid) >=
            coalesce((select max(max_active_reviews) from endorser_capabilities where user_id = p_uid),
                     cfg_int('default_endorser_max_active_reviews'));
  return query
  with caps as (
    select category_code from endorser_capabilities where user_id = p_uid and status <> 'suspended'
  ), my_cats as (
    select category_code from profile_categories where user_id = p_uid union select category_code from caps
  ), my_topics as (
    select topic_id from profile_interests where user_id = p_uid
  ), cand as (
    select p.*,
      (select count(*)::int from paper_topics pt where pt.paper_id = p.id and pt.topic_id in (select topic_id from my_topics)) as st,
      (select array_agg(pt.topic_id order by pt.topic_id) from paper_topics pt where pt.paper_id = p.id) as tids
    from papers p
    where p.status in ('open','in_review')
      and not is_paper_member(p.id, p_uid)
      and not exists (select 1 from engagements e where e.paper_id = p.id and e.endorser_id = p_uid)
      and not exists (select 1 from abstract_passes a where a.paper_id = p.id and a.user_id = p_uid)
  )
  select c.id, c.title, c.abstract, c.primary_category, c.cross_list_categories, c.paper_type, c.status, c.posted_at,
         coalesce(c.tids, '{}'), c.st,
         (3 * c.st
          + 2 * (case when c.primary_category in (select category_code from my_cats) then 1 else 0 end)
          + 1 * (case when c.cross_list_categories && array(select category_code from my_cats) then 1 else 0 end)
          + recency_boost(c.posted_at)
          - 2 * (case when v_full then 1 else 0 end)
          + coalesce((select 4 * (1 - (pe.embedding <=> ee.embedding))
                      from paper_embeddings pe, endorser_embeddings ee
                      where pe.paper_id = c.id and ee.user_id = p_uid and smart_match_active(c.primary_category)), 0)
         )::numeric as score,
         endorser_is_available(p_uid, c.primary_category),
         v_full,
         exists (select 1 from nudges n where n.paper_id = c.id and n.endorser_id = p_uid)
  from cand c
  where c.primary_category in (select category_code from caps)
     or c.cross_list_categories && array(select category_code from caps)
     or c.st > 0
     or c.primary_category in (select category_code from my_cats)
  order by 11 desc, c.posted_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
end $$;

create or replace function match_endorsers_for_paper(p_paper uuid, p_limit int default 20)
returns table (user_id uuid, handle text, display_name text, headline text, public_availability boolean,
               karma int, capability_status capability_status, shared_topics int, score numeric,
               at_capacity boolean, nudged boolean)
language plpgsql stable security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare p papers;
begin
  select * into p from papers where id = p_paper;
  if p.id is null or (not is_paper_member(p_paper, auth.uid()) and coalesce(auth.role(), '') <> 'service_role') then
    perform fail('Paper not found.');
  end if;
  return query
  select pr.id, pr.handle::text, pr.display_name, pr.headline, pr.public_availability, pr.karma, c.status,
         st.n,
         (3 * st.n + 2
          + (case when exists (select 1 from endorser_capabilities c2 where c2.user_id = pr.id
                               and c2.category_code = any(p.cross_list_categories)) then 1 else 0 end)
          + coalesce((select 4 * (1 - (pe.embedding <=> ee.embedding)) from paper_embeddings pe, endorser_embeddings ee
                      where pe.paper_id = p.id and ee.user_id = pr.id and smart_match_active(p.primary_category)), 0)
          - 2 * (case when endorser_reviewing_count(pr.id) >= c.max_active_reviews then 1 else 0 end))::numeric,
         endorser_reviewing_count(pr.id) >= c.max_active_reviews,
         exists (select 1 from nudges n where n.paper_id = p.id and n.endorser_id = pr.id)
  from endorser_capabilities c
  join profiles pr on pr.id = c.user_id
  cross join lateral (select count(*)::int as n from profile_interests i
                      join paper_topics pt on pt.topic_id = i.topic_id and pt.paper_id = p.id
                      where i.user_id = pr.id) st
  where c.category_code = p.primary_category
    and endorser_is_available(pr.id, p.primary_category)
    and not is_paper_member(p.id, pr.id)
    and not exists (select 1 from engagements e where e.paper_id = p.id and e.endorser_id = pr.id)
  order by 9 desc, pr.karma desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
end $$;

-- ---------------------------------------------------------------------------
-- embeddings (service role; used by the `embed` Edge Function)
-- ---------------------------------------------------------------------------
create or replace function claim_embedding_jobs(p_limit int default 20)
returns table (job_id bigint, target_type text, target_id uuid, content text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  return query
  with ready as (
    select j.id, j.target_type, j.target_id from embedding_jobs j
    where j.status = 'queued' and j.attempts < 5 and (
      (j.target_type = 'paper' and exists (select 1 from papers p where p.id = j.target_id
                                           and smart_match_active(p.primary_category)))
      or (j.target_type = 'endorser' and exists (select 1 from endorser_capabilities c where c.user_id = j.target_id
                                                 and smart_match_active(c.category_code))))
    order by j.id limit p_limit
    for update skip locked
  ), bumped as (
    update embedding_jobs j set attempts = j.attempts + 1 from ready where j.id = ready.id returning j.id
  )
  select r.id, r.target_type, r.target_id,
    case when r.target_type = 'paper' then
      (select p.title || E'\n\n' || p.abstract from papers p where p.id = r.target_id)
    else
      (select concat_ws(E'\n', pr.bio,
         (select string_agg(t.name, ', ') from profile_interests i join topics t on t.id = i.topic_id where i.user_id = pr.id),
         (select string_agg(pp.title, E'\n') from profile_publications pp where pp.user_id = pr.id))
       from profiles pr where pr.id = r.target_id)
    end
  from ready r;
end $$;

create or replace function store_embedding(p_job bigint, p_embedding text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare j embedding_jobs;
begin
  select * into j from embedding_jobs where id = p_job;
  if j.id is null then return; end if;
  if j.target_type = 'paper' then
    insert into paper_embeddings (paper_id, embedding) values (j.target_id, p_embedding::vector)
    on conflict (paper_id) do update set embedding = excluded.embedding, updated_at = now();
  else
    insert into endorser_embeddings (user_id, embedding) values (j.target_id, p_embedding::vector)
    on conflict (user_id) do update set embedding = excluded.embedding, updated_at = now();
  end if;
  update embedding_jobs set status = 'done' where id = p_job;
end $$;

-- ---------------------------------------------------------------------------
-- retention (service role; used by the `retention` Edge Function)
-- ---------------------------------------------------------------------------
create or replace function versions_due_for_deletion(p_limit int default 200)
returns table (version_id uuid, storage_path text)
language sql stable security definer set search_path = public as $$
  select v.id, v.storage_path from paper_versions v join papers p on p.id = v.paper_id
  where v.storage_path is not null and p.closed_at is not null
    and p.status in ('endorsed','posted','withdrawn','expired')
    and p.closed_at < now() - make_interval(days => coalesce(cfg_int('retention_days_after_close'), 30))
  order by p.closed_at limit p_limit
$$;

create or replace function mark_version_deleted(p_version uuid) returns void
language sql security definer set search_path = public as $$
  update paper_versions set storage_path = null, deleted_at = now() where id = p_version;
  insert into audit_log (action, entity, entity_id) values ('retention_delete', 'paper_version', p_version::text);
$$;
