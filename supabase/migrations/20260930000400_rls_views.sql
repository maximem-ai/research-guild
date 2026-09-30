-- Endorse Commons: RLS policies, public views, grants (SPEC §12 "RLS summary")

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- enable RLS on every table
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['categories','topics','profiles','profile_interests','profile_categories',
    'profile_publications','endorser_capabilities','papers','paper_members','paper_topics','paper_versions',
    'paper_secrets','engagements','abstract_passes','feedback_messages','feedback_ratings','endorsements','nudges',
    'notifications','karma_events','badges','paper_embeddings','endorser_embeddings','embedding_jobs',
    'moderation_flags','reports','share_clicks','platform_config','audit_log','ai_screens','readiness_checks','pledges']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- reference data: public read
create policy categories_read on categories for select to anon, authenticated using (true);
create policy topics_read on topics for select to anon, authenticated using (true);
create policy platform_config_read on platform_config for select to anon, authenticated using (true);

-- people: read for signed-in users; writes via RPC only
create policy profiles_read on profiles for select to authenticated using (true);
create policy profile_interests_read on profile_interests for select to authenticated using (true);
create policy profile_categories_read on profile_categories for select to authenticated using (true);
create policy profile_publications_read on profile_publications for select to authenticated using (true);
create policy endorser_capabilities_read on endorser_capabilities for select to authenticated using (true);

-- papers: members, reviewers who engaged with the paper, moderators.
-- Other signed-in users browse open abstracts through the column-limited view `open_abstracts`.
create policy papers_read on papers for select to authenticated
  using (is_paper_member(id) or is_paper_endorser(id) or is_moderator());
create policy paper_members_read on paper_members for select to authenticated
  using (is_paper_member(paper_id) or is_paper_endorser(paper_id) or is_moderator());
create policy paper_topics_read on paper_topics for select to authenticated using (true);

create or replace function can_read_paper_versions(p_paper uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_paper_member(p_paper) or exists (
    select 1 from engagements e where e.paper_id = p_paper and e.endorser_id = auth.uid()
      and e.state in ('reviewing','endorsed_pending_author','endorsed'))
$$;
create policy paper_versions_read on paper_versions for select to authenticated
  using (can_read_paper_versions(paper_id));

-- secrets: members; the reviewer only while reviewing/pending AND after opening the full paper
create or replace function can_read_paper_secret(p_paper uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_paper_member(p_paper) or exists (
    select 1 from engagements e where e.paper_id = p_paper and e.endorser_id = auth.uid()
      and e.state in ('reviewing','endorsed_pending_author') and e.paper_opened_at is not null)
$$;
create policy paper_secrets_read on paper_secrets for select to authenticated using (can_read_paper_secret(paper_id));

-- engagements & threads: the paper's members and that engagement's endorser
create or replace function can_read_engagement(p_engagement uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from engagements e where e.id = p_engagement
                 and (e.endorser_id = auth.uid() or is_paper_member(e.paper_id)))
$$;
create policy engagements_read on engagements for select to authenticated
  using (endorser_id = auth.uid() or is_paper_member(paper_id) or is_moderator());
create policy feedback_messages_read on feedback_messages for select to authenticated
  using (can_read_engagement(engagement_id) or is_moderator());
create policy feedback_ratings_read on feedback_ratings for select to authenticated
  using (can_read_engagement(engagement_id) or is_moderator());
create policy endorsements_read on endorsements for select to authenticated
  using (endorser_id = auth.uid() or is_paper_member(paper_id) or is_moderator());
create policy nudges_read on nudges for select to authenticated
  using (endorser_id = auth.uid() or is_paper_member(paper_id));
create policy abstract_passes_read on abstract_passes for select to authenticated using (user_id = auth.uid());
create policy readiness_checks_read on readiness_checks for select to authenticated using (is_paper_member(paper_id));

-- notifications: own rows; update read_at only (column grant below)
create policy notifications_read on notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- karma & badges: public read (leaderboards)
create policy karma_events_read on karma_events for select to anon, authenticated using (true);
create policy badges_read on badges for select to anon, authenticated using (true);

-- pledges: own rows
create policy pledges_read on pledges for select to authenticated using (user_id = auth.uid());

-- trust & ops: moderators only; reports insertable by any signed-in user; share clicks by anyone
create policy moderation_flags_mod on moderation_flags for select to authenticated using (is_moderator());
create policy reports_mod on reports for select to authenticated using (is_moderator() or reporter_id = auth.uid());
create policy reports_insert on reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open');
create policy share_clicks_mod on share_clicks for select to authenticated using (is_moderator());
create policy share_clicks_insert on share_clicks for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
create policy audit_log_mod on audit_log for select to authenticated using (is_moderator());
create policy ai_screens_mod on ai_screens for select to authenticated using (is_moderator());
-- paper_embeddings, endorser_embeddings, embedding_jobs: no policies (service role only)

-- ---------------------------------------------------------------------------
-- table grants: reads are governed by RLS; writes go through RPCs
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant update (read_at) on notifications to authenticated;
grant insert (reporter_id, target_type, target_id, reason) on reports to authenticated;
grant insert (user_id, network, surface) on share_clicks to anon, authenticated;

-- ---------------------------------------------------------------------------
-- views (owner-privileged; expose only safe columns)
-- ---------------------------------------------------------------------------
create view open_abstracts as
  select p.id, p.title, p.abstract, p.primary_category, p.cross_list_categories, p.paper_type, p.status, p.posted_at,
         coalesce((select array_agg(pt.topic_id order by pt.topic_id) from paper_topics pt where pt.paper_id = p.id), '{}') as topic_ids
  from papers p
  where p.status in ('open','in_review') and auth.uid() is not null;

create view public_profiles as
  select pr.id, pr.handle::text as handle, pr.display_name, pr.headline, pr.bio, pr.avatar_path, pr.karma,
         pr.hf_username, pr.github_username, pr.homepage_url, pr.google_scholar_url, pr.orcid, pr.created_at,
         coalesce((select jsonb_agg(jsonb_build_object('category', c.category_code, 'status', c.status,
                     'accepting', c.accepting and (c.paused_until is null or c.paused_until <= now()),
                     'max_active_reviews', c.max_active_reviews) order by c.category_code)
                   from endorser_capabilities c where c.user_id = pr.id), '[]'::jsonb) as capabilities,
         coalesce((select jsonb_agg(jsonb_build_object('category', t.category_code, 'name', t.name) order by t.category_code, t.name)
                   from profile_interests i join topics t on t.id = i.topic_id where i.user_id = pr.id), '[]'::jsonb) as topics,
         coalesce((select array_agg(b.badge order by b.awarded_at) from badges b where b.user_id = pr.id), '{}') as badges,
         greatest(0, coalesce((select max(c.max_active_reviews) from endorser_capabilities c
                               where c.user_id = pr.id and c.accepting and c.status <> 'suspended'
                                 and (c.paused_until is null or c.paused_until <= now())), 0)
                     - (select count(*) from engagements e where e.endorser_id = pr.id and e.state = 'reviewing'))::int as open_slots
  from profiles pr
  where pr.public_availability;

-- endorser track record (§13b.A)
create view endorser_track_record as
  with base as (
    select e.endorser_id, e.category_code,
           count(*) filter (where e.author_confirmed_at is not null) as confirmed,
           count(*) filter (where e.arxiv_verified_at is not null) as verified_posted,
           count(*) filter (where e.removed_flag) as removed
    from endorsements e group by 1, 2
  ), timing as (
    select g.endorser_id, p.primary_category as category_code,
           percentile_cont(0.5) within group (order by extract(epoch from (g.decided_at - g.shared_at)) / 3600.0) as median_hours_to_decision,
           count(r.*) as rated, count(r.*) filter (where r.helpful) as rated_helpful
    from engagements g
    join papers p on p.id = g.paper_id
    left join feedback_ratings r on r.engagement_id = g.id
    where g.decided_at is not null or r.engagement_id is not null
    group by 1, 2
  )
  select coalesce(b.endorser_id, t.endorser_id) as endorser_id,
         coalesce(b.category_code, t.category_code) as category_code,
         coalesce(b.confirmed, 0) as confirmed,
         coalesce(b.verified_posted, 0) as verified_posted,
         coalesce(b.removed, 0) as removed,
         case when coalesce(b.confirmed, 0) >= 3 then round(b.verified_posted::numeric / b.confirmed, 3) end as posted_rate,
         round(t.median_hours_to_decision::numeric, 1) as median_hours_to_decision,
         case when coalesce(t.rated, 0) > 0 then round(t.rated_helpful::numeric / t.rated, 3) end as helpful_share
  from base b full join timing t on t.endorser_id = b.endorser_id and t.category_code = b.category_code;

create view pledge_stats as
  select count(*) filter (where status <> 'declined') as made,
         count(*) filter (where status = 'fulfilled') as fulfilled
  from pledges;

-- per-category leaderboards (monthly + all-time), refreshed daily by cron
create materialized view karma_leaderboard as
  with ev as (
    select k.user_id, k.points, k.created_at, pa.primary_category as category_code
    from karma_events k
    left join engagements e on e.id = k.engagement_id
    left join papers pa on pa.id = e.paper_id
  ), periods as (
    select 'all_time'::text as period, ev.* from ev
    union all
    select 'month', ev.* from ev where ev.created_at >= date_trunc('month', now())
  )
  select period, category_code, user_id, sum(points)::int as points
  from periods where category_code is not null group by 1, 2, 3
  union all
  select period, '*', user_id, sum(points)::int from periods group by 1, 3;
create unique index karma_leaderboard_uniq on karma_leaderboard(period, category_code, user_id);

grant select on open_abstracts to authenticated;
grant select on public_profiles, endorser_track_record, pledge_stats, karma_leaderboard to anon, authenticated;
revoke insert, update, delete on open_abstracts, public_profiles, endorser_track_record, pledge_stats from anon, authenticated;

-- ---------------------------------------------------------------------------
-- function grants: nothing is callable by clients unless listed here
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- used inside RLS policies / views (evaluated as the caller)
grant execute on function is_moderator(uuid), is_paper_member(uuid, uuid), is_paper_endorser(uuid, uuid),
  can_read_paper_versions(uuid), can_read_paper_secret(uuid), can_read_engagement(uuid),
  safe_uuid(text), recency_boost(timestamptz), is_open_state(engagement_state)
  to anon, authenticated;

-- client-callable RPCs (each re-checks auth.uid())
grant execute on function
  upsert_profile(text, text, text, text[], bigint[], boolean, text, text, text, text, text, text),
  set_avatar(text), set_public_availability(boolean), set_openalex_publications(text, jsonb),
  attest_capability(text, text), update_capability_settings(text, int, boolean, timestamptz), remove_capability(text),
  create_paper_draft(text, text, text, text[], paper_type, boolean, bigint[], text, text),
  update_abstract(uuid, text, text, text, text[], paper_type, bigint[], text, text),
  submit_readiness_check(uuid, jsonb), post_abstract(uuid), withdraw_paper(uuid),
  add_coauthor(uuid, text), remove_coauthor(uuid, uuid), set_endorsement_code(uuid, text),
  upload_version(uuid, text, text, int, text), share_paper(uuid), release_reviewer(uuid),
  accept_abstract(uuid), pass_abstract(uuid), withdraw_engagement(uuid), log_paper_open(uuid, uuid),
  mark_linkedin_checked(uuid), send_feedback(uuid, text, uuid), rate_feedback(uuid, boolean, text),
  record_endorsed(uuid), confirm_endorsement(uuid), record_declined(uuid, text),
  create_pledge(text, bigint[], uuid), decline_pledge(uuid), send_nudge(uuid, uuid),
  mark_all_notifications_read(), waitlist_position(uuid),
  match_papers_for_endorser(uuid, int), match_endorsers_for_paper(uuid, int),
  mod_set_endorsement_removed(uuid, boolean), mod_update_flag(bigint, text), mod_update_report(bigint, text),
  mod_set_config(text, jsonb), mod_set_capability_status(uuid, text, capability_status),
  orcid_valid(text)
  to authenticated;

-- server-only (service role): arXiv verification, embeddings, retention, cron helpers
grant execute on all functions in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Realtime: in-app notifications
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;
