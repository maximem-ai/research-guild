-- Rename: the one database message that named the app ("Endorse Commons" → ResearchGuild).
-- Same body as in 20260930000300_functions.sql except that message.

set search_path = public, extensions;
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
    perform fail(format('You must be at least %s to use ResearchGuild.', cfg_int('min_age')));
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
