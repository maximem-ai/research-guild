begin;
select plan(14);

select tests.create_user('ta_author') as a \gset
select tests.create_user('tr_endorser', array['cs.AI']) as r \gset
select tests.open_paper(:'a') as p \gset
select tests.accept_and_share(:'a', :'r', :'p') as e \gset
select tests.open_and_check(:'r', :'e');
select tests.act_as(:'r');
select record_endorsed(:'e');
select tests.act_as(:'a');
select confirm_endorsement(:'e');
select create_pledge('cs.AI', '{}', :'p') as pledge \gset
select is((select remind_on from pledges where id = :'pledge'), null, 'pledge has no reminder before arXiv verification');

-- verification: service role only; category + name must match
select tests.act_as_service();
select throws_ok(format($$select verify_arxiv_posting(%L, %L, '2409.12345', array['cs.LG'], true)$$, :'a', :'p'),
  'P0001', null, 'category mismatch rejected');
select throws_ok(format($$select verify_arxiv_posting(%L, %L, '2409.12345', array['cs.AI'], false)$$, :'a', :'p'),
  'P0001', null, 'author name mismatch rejected');
select lives_ok(format($$select verify_arxiv_posting(%L, %L, '2409.12345', array['cs.AI','cs.LG'], true)$$, :'a', :'p'),
  'verification succeeds');
select tests.reset_role();
select is((select status::text from papers where id = :'p'), 'posted', 'paper -> posted');
select is((select confirmed::int from endorser_track_record where endorser_id = :'r' and category_code = 'cs.AI'), 1, 'track record: confirmed');
select is((select verified_posted::int from endorser_track_record where endorser_id = :'r' and category_code = 'cs.AI'), 1, 'track record: verified posted');
select is((select posted_rate from endorser_track_record where endorser_id = :'r' and category_code = 'cs.AI'), null, 'posted rate hidden below 3 endorsements');
select is((select status::text from endorser_capabilities where user_id = :'r' and category_code = 'cs.AI'), 'confirmed', 'capability claimed -> confirmed');
select is((select points from karma_events where user_id = :'r' and kind = 'endorsed_posted'), 5, '+5 for verified posting');
select is((select remind_on from pledges where id = :'pledge'), (now() + interval '3 months')::date, 'pledge reminder = verified date + 3 months');

-- reminder fires, then first decision fulfils the pledge
update pledges set remind_on = current_date where id = :'pledge';
select run_daily_maintenance();
select is((select status::text from pledges where id = :'pledge'), 'reminded', 'pledge reminded by daily cron');
select tests.act_as(:'a');
select attest_capability('cs.AI', 'https://arxiv.org/auth/show-endorsers/2409.12345');
select tests.create_user('tb_newauthor') as b \gset
select tests.open_paper(:'b', 'cs.AI', 'New author paper to review') as p2 \gset
select tests.accept_and_share(:'b', :'a', :'p2') as e2 \gset
select tests.act_as(:'a');
select log_paper_open(:'e2', (select id from paper_versions where paper_id = :'p2' limit 1));
select record_declined(:'e2', 'Outside my area');
select tests.reset_role();
select is((select status::text from pledges where id = :'pledge'), 'fulfilled', 'pledge fulfilled by first decision');
select ok(exists (select 1 from badges where user_id = :'a' and badge = 'pay_it_forward'), 'pay-it-forward badge');

select * from finish();
rollback;
