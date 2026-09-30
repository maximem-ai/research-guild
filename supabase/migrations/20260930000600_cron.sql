-- Endorse Commons: scheduled jobs (SPEC §12 "Cron jobs", §13b)

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- hourly: expiries, expiry reminders, waitlist promotion, ghosting pattern flags
-- ---------------------------------------------------------------------------
create or replace function run_hourly_maintenance() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_accept_ttl int := coalesce(cfg_int('accept_ttl_days'), 7);
  v_review_ttl int := coalesce(cfg_int('review_ttl_days'), 10);
  v_remind int := coalesce(cfg_int('reminder_before_expiry_days'), 3);
  v_expired_accepted int := 0; v_expired_reviewing int := 0; v_warned int := 0; v_promoted int := 0;
begin
  -- accepted but never shared within accept_ttl_days
  for r in select id, paper_id, endorser_id from engagements
           where state = 'accepted' and accepted_at < now() - make_interval(days => v_accept_ttl) loop
    update engagements set state = 'expired', closed_at = now() where id = r.id;
    perform notify_user(r.endorser_id, 'expired', jsonb_build_object('paper_id', r.paper_id, 'engagement_id', r.id, 'stage', 'accepted'));
    perform notify_paper_members(r.paper_id, 'expired', jsonb_build_object('engagement_id', r.id, 'stage', 'accepted'));
    v_expired_accepted := v_expired_accepted + 1;
  end loop;

  -- reviewing with no reviewer activity within review_ttl_days (ghosting: −3)
  for r in select id, paper_id, endorser_id from engagements
           where state = 'reviewing' and last_activity_at < now() - make_interval(days => v_review_ttl) loop
    update engagements set state = 'expired', closed_at = now() where id = r.id;
    perform award_karma(r.endorser_id, 'ghosting', -3, r.id);
    perform notify_user(r.endorser_id, 'expired', jsonb_build_object('paper_id', r.paper_id, 'engagement_id', r.id, 'stage', 'reviewing'));
    perform notify_paper_members(r.paper_id, 'expired', jsonb_build_object('engagement_id', r.id, 'stage', 'reviewing'));
    v_expired_reviewing := v_expired_reviewing + 1;
  end loop;

  -- in-app nudges before expiry
  for r in select id, paper_id, endorser_id from engagements
           where state = 'accepted' and expiry_warned_at is null
             and accepted_at < now() - make_interval(days => greatest(v_accept_ttl - v_remind, 0)) loop
    update engagements set expiry_warned_at = now() where id = r.id;
    perform notify_paper_members(r.paper_id, 'expiring_soon', jsonb_build_object('engagement_id', r.id, 'stage', 'accepted'));
    v_warned := v_warned + 1;
  end loop;
  for r in select id, paper_id, endorser_id from engagements
           where state = 'reviewing' and (expiry_warned_at is null or expiry_warned_at < last_activity_at)
             and last_activity_at < now() - make_interval(days => greatest(v_review_ttl - v_remind, 0)) loop
    update engagements set expiry_warned_at = now() where id = r.id;
    perform notify_user(r.endorser_id, 'expiring_soon', jsonb_build_object('paper_id', r.paper_id, 'engagement_id', r.id, 'stage', 'reviewing'));
    v_warned := v_warned + 1;
  end loop;

  -- promote any waitlists that can move (safety net for the trigger)
  for r in select distinct paper_id from engagements where state = 'waitlisted' loop
    v_promoted := v_promoted + promote_waitlist(r.paper_id);
  end loop;
  for r in select distinct endorser_id from engagements where state = 'waitlisted' loop
    v_promoted := v_promoted + promote_waitlist_for_endorser(r.endorser_id);
  end loop;

  -- ghosting pattern: 3+ ghosting penalties in 90 days
  insert into moderation_flags (kind, subject_user, detail)
  select 'ghosting_pattern', k.user_id, jsonb_build_object('count_90d', count(*))
  from karma_events k where k.kind = 'ghosting' and k.created_at > now() - interval '90 days'
  group by k.user_id having count(*) >= 3
    and not exists (select 1 from moderation_flags f where f.kind = 'ghosting_pattern'
                    and f.subject_user = k.user_id and f.status = 'open');

  return jsonb_build_object('expired_accepted', v_expired_accepted, 'expired_reviewing', v_expired_reviewing,
                            'warned', v_warned, 'promoted', v_promoted);
end $$;

-- ---------------------------------------------------------------------------
-- daily: leaderboards, mutual-endorsement detection, pledge + arXiv-ID reminders
-- (PDF retention runs in the `retention` Edge Function, which calls versions_due_for_deletion)
-- ---------------------------------------------------------------------------
create or replace function detect_mutual_endorsements() returns int
language plpgsql security definer set search_path = public as $$
declare v_rows int;
begin
  insert into moderation_flags (kind, subject_user, paper_id, detail)
  select 'mutual_endorsement', a.endorser_id, a.paper_id,
         jsonb_build_object('other_user', pb.owner_id, 'other_paper', b.paper_id)
  from endorsements a
  join papers pa on pa.id = a.paper_id
  join endorsements b on b.endorser_id = pa.owner_id and b.author_confirmed_at is not null
  join papers pb on pb.id = b.paper_id and pb.owner_id = a.endorser_id
  where a.author_confirmed_at is not null
    and abs(extract(epoch from (a.author_confirmed_at - b.author_confirmed_at))) <= 365 * 86400
    and a.endorser_id < pa.owner_id
    and not exists (select 1 from moderation_flags f where f.kind = 'mutual_endorsement' and f.paper_id = a.paper_id);
  get diagnostics v_rows = row_count;
  return v_rows;
end $$;

create or replace function run_daily_maintenance() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; v_pledges int := 0; v_arxiv int := 0; v_mutual int;
begin
  refresh materialized view concurrently karma_leaderboard;
  v_mutual := detect_mutual_endorsements();

  -- pay-it-forward: remind on arXiv verified posting date + 3 months
  for r in select id, user_id, category_code from pledges
           where status = 'pending' and remind_on is not null and remind_on <= current_date loop
    update pledges set status = 'reminded', reminded_at = now() where id = r.id;
    perform notify_user(r.user_id, 'pledge_reminder', jsonb_build_object('pledge_id', r.id, 'category', r.category_code));
    v_pledges := v_pledges + 1;
  end loop;

  -- remind authors to add the arXiv ID at 7 and 21 days after the endorsement was confirmed
  for r in select p.id, d.day from papers p
           cross join (values (7), (21)) as d(day)
           where p.status = 'endorsed' and p.endorsed_at < now() - make_interval(days => d.day)
             and not exists (select 1 from notifications n where n.type = 'add_arxiv_id'
                             and n.payload->>'paper_id' = p.id::text and (n.payload->>'day')::int = d.day) loop
    perform notify_paper_members(r.id, 'add_arxiv_id', jsonb_build_object('day', r.day));
    v_arxiv := v_arxiv + 1;
  end loop;

  return jsonb_build_object('pledge_reminders', v_pledges, 'arxiv_reminders', v_arxiv, 'mutual_flags', v_mutual);
end $$;

-- ---------------------------------------------------------------------------
-- Edge Function invoker (pg_net + Vault). Secrets `project_url` and `service_role_key`
-- must be created in Vault (see README "Deploy"). No-ops if they're missing.
-- ---------------------------------------------------------------------------
create or replace function invoke_edge_function(p_name text, p_body jsonb default '{}') returns bigint
language plpgsql security definer set search_path = public as $$
declare v_url text; v_key text; v_id bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net')
     or not exists (select 1 from pg_namespace where nspname = 'vault') then
    return null;
  end if;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'project_url'$q$ into v_url;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'$q$ into v_key;
  if v_url is null or v_key is null then return null; end if;
  execute $q$select net.http_post(url := $1, headers := $2, body := $3, timeout_milliseconds := 60000)$q$
    into v_id
    using v_url || '/functions/v1/' || p_name,
          jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
          p_body;
  return v_id;
end $$;

revoke execute on function run_hourly_maintenance(), run_daily_maintenance(), detect_mutual_endorsements(),
  invoke_edge_function(text, jsonb) from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net not available: %', sqlerrm;
end $$;

-- schedules (cron.schedule upserts by job name)
select cron.schedule('ec-hourly-maintenance', '5 * * * *', $$select public.run_hourly_maintenance()$$);
select cron.schedule('ec-hourly-embeddings', '20 * * * *', $$select public.invoke_edge_function('embed', '{}'::jsonb)$$);
select cron.schedule('ec-daily-maintenance', '15 3 * * *', $$select public.run_daily_maintenance()$$);
select cron.schedule('ec-daily-retention', '30 3 * * *', $$select public.invoke_edge_function('retention', '{}'::jsonb)$$);
