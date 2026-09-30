begin;
select plan(9);

select tests.create_user('fa_author') as a \gset
select tests.create_user('fr_one', array['cs.AI']) as r1 \gset
select tests.create_user('fr_two', array['cs.AI']) as r2 \gset
select tests.create_user('fr_three', array['cs.AI']) as r3 \gset
select tests.create_user('fr_four', array['cs.AI']) as r4 \gset
select tests.open_paper(:'a') as p \gset
select tests.accept_and_share(:'a', :'r1', :'p') as e1 \gset
select tests.accept_and_share(:'a', :'r2', :'p') as e2 \gset
select tests.accept_and_share(:'a', :'r3', :'p') as e3 \gset
select tests.accept_and_share(:'a', :'r4', :'p') as e4 \gset

-- a second reviewer can't also record an endorsement while one is pending
select tests.open_and_check(:'r1', :'e1');
select tests.open_and_check(:'r2', :'e2');
select tests.act_as(:'r2');
select send_feedback(:'e2', 'Some useful notes');
select tests.act_as(:'r1');
select record_endorsed(:'e1');
select tests.act_as(:'r2');
select throws_ok(format('select record_endorsed(%L)', :'e2'), 'P0001', null, 'only one pending endorsement per paper');
select tests.act_as(:'a');
select confirm_endorsement(:'e1');
select tests.reset_role();

select is(tests.state(:'e2'), 'closed_endorsed_elsewhere', 'reviewing -> closed_endorsed_elsewhere');
select is(tests.state(:'e3'), 'closed_endorsed_elsewhere', 'other reviewing -> closed_endorsed_elsewhere');
select is(tests.state(:'e4'), 'closed_endorsed_elsewhere', 'waitlisted -> closed_endorsed_elsewhere (not promoted)');
select is((select count(*)::int from notifications where type = 'endorsed_elsewhere' and payload->>'paper_id' = :'p'), 3,
  'every other open reviewer notified in-app');
select ok(exists (select 1 from notifications where user_id = :'r1' and type = 'endorsement_confirmed'), 'endorser notified');
select is((select count(*)::int from engagements where paper_id = :'p' and is_open_state(state)), 0, 'no open engagements remain');
select ok((select closed_at is not null from papers where id = :'p'), 'paper closed_at set (starts retention clock)');
-- feedback karma earned before closing is kept
select ok(exists (select 1 from karma_events where user_id = :'r2' and kind = 'feedback_round_1'), 'feedback karma already earned is kept');

select * from finish();
rollback;
