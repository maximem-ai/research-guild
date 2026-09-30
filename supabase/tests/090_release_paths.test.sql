begin;
select plan(8);

select tests.create_user('la_author') as a \gset
select tests.create_user('lr_one', array['cs.AI']) as r1 \gset
select tests.create_user('lr_two', array['cs.AI']) as r2 \gset
select tests.create_user('lr_three', array['cs.AI']) as r3 \gset
select tests.create_user('lr_four', array['cs.AI']) as r4 \gset
select tests.open_paper(:'a') as p \gset
select tests.accept_and_share(:'a', :'r1', :'p') as e1 \gset
select tests.accept_and_share(:'a', :'r2', :'p') as e2 \gset
select tests.accept_and_share(:'a', :'r3', :'p') as e3 \gset
select tests.accept_and_share(:'a', :'r4', :'p') as e4 \gset

-- release a reviewing reviewer -> released_by_author, waitlist promoted
select tests.act_as(:'a');
select release_reviewer(:'e1');
select tests.reset_role();
select is(tests.state(:'e1'), 'released_by_author', 'reviewing -> released_by_author');
select is(tests.state(:'e4'), 'reviewing', 'release promotes waitlist');

-- release a pending endorsement: endorsement row removed, others can endorse again
select tests.open_and_check(:'r2', :'e2');
select tests.act_as(:'r2');
select record_endorsed(:'e2');
select tests.act_as(:'a');
select release_reviewer(:'e2');
select tests.reset_role();
select is(tests.state(:'e2'), 'released_by_author', 'endorsed_pending_author -> released_by_author');
select is((select count(*)::int from endorsements where paper_id = :'p'), 0, 'unconfirmed endorsement removed');
select tests.open_and_check(:'r3', :'e3');
select tests.act_as(:'r3');
select lives_ok(format('select record_endorsed(%L)', :'e3'), 'another reviewer can now endorse');

-- withdraw paper closes everything
select tests.act_as(:'a');
select withdraw_paper(:'p');
select tests.reset_role();
select is((select status::text from papers where id = :'p'), 'withdrawn', 'paper withdrawn');
select is((select count(*)::int from engagements where paper_id = :'p' and is_open_state(state)), 0, 'no open engagements after withdrawal');
select ok(exists (select 1 from notifications where user_id = :'r4' and type = 'paper_withdrawn'), 'reviewers notified of withdrawal');

select * from finish();
rollback;
