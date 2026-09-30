begin;
select plan(12);

select tests.create_user('wa_author') as a \gset
select tests.create_user('wr_one', array['cs.AI']) as r1 \gset
select tests.create_user('wr_two', array['cs.AI']) as r2 \gset
select tests.create_user('wr_three', array['cs.AI']) as r3 \gset
select tests.create_user('wr_four', array['cs.AI']) as r4 \gset
select tests.open_paper(:'a') as p \gset

select tests.accept_and_share(:'a', :'r1', :'p') as e1 \gset
select tests.accept_and_share(:'a', :'r2', :'p') as e2 \gset
select tests.accept_and_share(:'a', :'r3', :'p') as e3 \gset
select tests.accept_and_share(:'a', :'r4', :'p') as e4 \gset
select is(tests.state(:'e3'), 'reviewing', '3rd share -> reviewing (max 3)');
select is(tests.state(:'e4'), 'waitlisted', '4th share -> waitlisted');
select is((select waitlist_reason::text from engagements where id = :'e4'), 'paper_full', 'reason paper_full');
select tests.act_as(:'r4');
select is(waitlist_position(:'e4'), 1, 'waitlist position #1');

-- decline frees a slot -> promotion
select tests.open_and_check(:'r1', :'e1');
select tests.act_as(:'r1');
select record_declined(:'e1', 'Draft incomplete');
select tests.reset_role();
select is(tests.state(:'e4'), 'reviewing', 'decline promotes the waitlisted reviewer');
select ok(exists (select 1 from notifications where user_id = :'r4' and type = 'waitlist_promoted'), 'promoted reviewer notified');
select ok(exists (select 1 from notifications where user_id = :'a' and type = 'waitlist_promoted'), 'author notified of promotion');

-- endorser at capacity -> endorser_full, promoted when their slot frees
select tests.reset_role();
update endorser_capabilities set max_active_reviews = 1 where user_id = :'r2';
select tests.open_paper(:'a', 'cs.AI', 'Another paper for capacity test') as p2 \gset
select tests.accept_and_share(:'a', :'r2', :'p2') as e5 \gset
select is(tests.state(:'e5'), 'waitlisted', 'endorser at capacity -> waitlisted');
select is((select waitlist_reason::text from engagements where id = :'e5'), 'endorser_full', 'reason endorser_full');
select tests.act_as(:'r2');
select lives_ok(format('select withdraw_engagement(%L)', :'e2'), 'endorser frees a slot by withdrawing');
select tests.reset_role();
select is(tests.state(:'e5'), 'reviewing', 'endorser_full waitlist promoted when their slot frees');

-- raising capacity also promotes
select tests.reset_role();
select tests.create_user('wr_five', array['cs.AI']) as r5 \gset
update endorser_capabilities set max_active_reviews = 1 where user_id = :'r5';
select tests.open_paper(:'r1', 'cs.AI', 'Third paper, owned by r1 here') as p3 \gset
select tests.accept_and_share(:'r1', :'r5', :'p3') as e6 \gset
select tests.accept_and_share(:'a', :'r5', :'p2') as e7 \gset
select tests.act_as(:'r5');
select update_capability_settings('cs.AI', 2, true, null);
select tests.reset_role();
select is(tests.state(:'e7'), 'reviewing', 'raising capacity promotes endorser waitlist');

select * from finish();
rollback;
