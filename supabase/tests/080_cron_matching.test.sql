begin;
select plan(10);

select tests.create_user('ca_author') as a \gset
select tests.create_user('cr_one', array['cs.AI']) as r1 \gset
select tests.create_user('cr_two', array['cs.AI']) as r2 \gset
select tests.open_paper(:'a') as p \gset
select tests.act_as(:'r1');
select accept_abstract(:'p') as e1 \gset

-- matching feed
select tests.act_as(:'r2');
select ok(exists (select 1 from match_papers_for_endorser(:'r2', 10) where paper_id = :'p'), 'paper appears in matched feed');
select throws_ok(format('select * from match_papers_for_endorser(%L, 10)', :'r1'), 'P0001', null, 'cannot query another user''s feed');
select pass_abstract(:'p');
select ok(not exists (select 1 from match_papers_for_endorser(:'r2', 10) where paper_id = :'p'), 'passed abstract hidden');
select tests.act_as(:'a');
select ok(exists (select 1 from match_endorsers_for_paper(:'p', 10) where user_id = :'r2'), 'author sees matching endorsers');

-- nudges: max 3 per paper per week
select send_nudge(:'p', :'r2');
select throws_ok(format('select send_nudge(%L, %L)', :'p', :'r2'), 'P0001', null, 'cannot nudge same endorser twice');

-- accept TTL expiry + expiry warning
select tests.reset_role();
update engagements set accepted_at = now() - interval '5 days' where id = :'e1';
select run_hourly_maintenance();
select ok(exists (select 1 from notifications where user_id = :'a' and type = 'expiring_soon'), 'expiring_soon notification');
update engagements set accepted_at = now() - interval '8 days' where id = :'e1';
select run_hourly_maintenance();
select is(tests.state(:'e1'), 'expired', 'accepted -> expired after accept_ttl_days');

-- retention
select tests.create_user('cr_three', array['cs.AI']) as r3 \gset
select tests.open_paper(:'a', 'cs.AI', 'Retention paper for deletion') as p2 \gset
select tests.accept_and_share(:'a', :'r3', :'p2') as e2 \gset
update papers set status = 'withdrawn', closed_at = now() - interval '31 days' where id = :'p2';
select is((select count(*)::int from versions_due_for_deletion() where storage_path like :'p2' || '/%'), 1, 'closed >30 days -> due for deletion');
select mark_version_deleted((select version_id from versions_due_for_deletion() limit 1));
select is((select count(*)::int from paper_versions where paper_id = :'p2' and storage_path is null and deleted_at is not null), 1, 'version marked deleted');

-- leaderboard refresh works
select lives_ok('select run_daily_maintenance()', 'daily maintenance (leaderboard refresh) runs');

select * from finish();
rollback;
