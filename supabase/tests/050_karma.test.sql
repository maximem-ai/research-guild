begin;
select plan(11);

select tests.create_user('ka_author') as a \gset
select tests.create_user('kr_endorse', array['cs.AI']) as r1 \gset
select tests.create_user('kr_decline', array['cs.AI']) as r2 \gset
select tests.create_user('kr_ghost', array['cs.AI']) as r3 \gset
select tests.open_paper(:'a') as p \gset
select tests.open_paper(:'a', 'cs.AI', 'A second paper for karma test') as p2 \gset
select tests.accept_and_share(:'a', :'r1', :'p') as e1 \gset
select tests.accept_and_share(:'a', :'r2', :'p2') as e2 \gset

select tests.open_and_check(:'r1', :'e1');
select tests.open_and_check(:'r2', :'e2');
select tests.act_as(:'r1');
select record_endorsed(:'e1');
select tests.act_as(:'r2');
select record_declined(:'e2', 'Wrong category, try cs.LG');
select tests.reset_role();
select is((select points from karma_events where user_id = :'r1' and kind = 'decision'),
          (select points from karma_events where user_id = :'r2' and kind = 'decision'),
          'endorse and decline earn equal points');
select is((select karma from profiles where id = :'r1'), 3, 'profile karma cache updated');

-- idempotent on retries
select is(award_karma(:'r1', 'decision', 3, :'e1'), false, 'duplicate award is a no-op');
select is((select karma from profiles where id = :'r1'), 3, 'karma unchanged after retry');

-- feedback rounds: max 3 counted
select tests.accept_and_share(:'a', :'r3', :'p') as e3 \gset
select tests.open_and_check(:'r3', :'e3');
do $$ declare i int; e uuid := (select id from engagements where endorser_id = (select id from profiles where handle='kr_ghost'));
  a uuid := (select id from profiles where handle='ka_author'); r uuid := (select id from profiles where handle='kr_ghost');
begin
  for i in 1..5 loop
    perform tests.act_as(r); perform send_feedback(e, 'reviewer round ' || i);
    perform tests.act_as(a); perform send_feedback(e, 'author reply ' || i);
  end loop;
  perform tests.reset_role();
end $$;
select is((select feedback_rounds from engagements where id = :'e3'), 5, '5 rounds recorded');
select is((select count(*)::int from karma_events where user_id = :'r3' and kind like 'feedback_round_%'), 3, 'only 3 rounds earn karma');
select ok(exists (select 1 from badges where user_id = :'r3' and badge = 'first_review'), 'first_review badge');

-- helpful rating: +2 endorser, +1 author
select tests.act_as(:'a');
select rate_feedback(:'e3', true, 'Very helpful');
select tests.reset_role();
select is((select points from karma_events where user_id = :'r3' and kind = 'feedback_helpful'), 2, 'helpful rating +2');
select is((select points from karma_events where user_id = :'a' and kind = 'rated_feedback'), 1, 'author +1 for rating');

-- ghosting penalty on expiry while reviewing
select tests.create_user('kr_ghost2', array['cs.AI']) as r4 \gset
select tests.open_paper(:'r1', 'cs.AI', 'Paper owned by r1 for ghosting') as p3 \gset
select tests.accept_and_share(:'r1', :'r4', :'p3') as e4 \gset
update engagements set last_activity_at = now() - interval '11 days' where id = :'e4';
select run_hourly_maintenance();
select is(tests.state(:'e4'), 'expired', 'stale reviewing expires');
select is((select points from karma_events where user_id = :'r4' and kind = 'ghosting'), -3, 'ghosting penalty -3');

select * from finish();
rollback;
