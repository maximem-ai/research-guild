begin;
select plan(20);

select tests.create_user('ra_author') as a \gset
select tests.create_user('rr_reviewer', array['cs.AI']) as r \gset
select tests.create_user('rs_stranger', array['cs.AI']) as s \gset
select tests.open_paper(:'a') as p \gset
select tests.accept_and_share(:'a', :'r', :'p') as e \gset
select tests.act_as(:'r');
select send_feedback(:'e', 'confidential thread');

-- stranger (signed in)
select tests.act_as(:'s');
select is((select count(*)::int from paper_versions where paper_id = :'p'), 0, 'stranger cannot read paper versions');
select is((select count(*)::int from paper_secrets where paper_id = :'p'), 0, 'stranger cannot read the endorsement code');
select is((select count(*)::int from feedback_messages), 0, 'stranger cannot read threads');
select is((select count(*)::int from engagements where paper_id = :'p'), 0, 'stranger cannot read engagements');
select is((select count(*)::int from papers where id = :'p'), 0, 'stranger cannot read the full paper row');
select is((select count(*)::int from open_abstracts where id = :'p'), 1, 'stranger can browse the abstract via open_abstracts');
select is((select count(*)::int from storage.objects), 0, 'stranger sees no storage objects');
select throws_ok(format($$insert into engagements (paper_id, endorser_id) values (%L, %L)$$, :'p', :'s'),
  '42501', null, 'direct writes are denied (RPC only)');
select throws_ok($$select award_karma(auth.uid(), 'x', 100, null)$$, '42501', null, 'award_karma not callable by clients');
select throws_ok(format($$select verify_arxiv_posting(%L, %L, '2401.00001', array['cs.AI'], true)$$, :'s', :'p'),
  '42501', null, 'verify_arxiv_posting is service-role only');

-- reviewer: code hidden until the paper is opened
select tests.act_as(:'r');
select is((select count(*)::int from paper_versions where paper_id = :'p'), 1, 'reviewer can read version metadata');
select is((select count(*)::int from paper_secrets where paper_id = :'p'), 0, 'reviewer cannot see code before opening paper');
select log_paper_open(:'e', (select id from paper_versions where paper_id = :'p' limit 1));
select is((select count(*)::int from paper_secrets where paper_id = :'p'), 1, 'reviewer sees code after opening paper');
select is((select count(*)::int from feedback_messages), 1, 'reviewer reads own thread');

-- author
select tests.act_as(:'a');
select is((select count(*)::int from engagements where paper_id = :'p'), 1, 'author reads engagements on own paper');
select throws_ok($$update profiles set karma = 9999 where id = auth.uid()$$, '42501', null, 'cannot edit own karma');
select throws_ok($$update profiles set role = 'moderator' where id = auth.uid()$$, '42501', null, 'cannot make self moderator');

-- anon
select tests.act_as_anon();
select is((select count(*)::int from profiles), 0, 'anon cannot read profiles table');
select is((select count(*)::int from open_abstracts), 0, 'abstracts are not visible signed out');
select is((select count(*)::int from topics) > 0, true, 'anon can read topics');

select * from finish();
rollback;
