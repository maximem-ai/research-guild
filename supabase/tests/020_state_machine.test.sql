begin;
select plan(33);

select tests.create_user('ann_author') as ann \gset
select tests.create_user('rex_reviewer', array['cs.AI']) as rex \gset
select tests.create_user('ria_reviewer', array['cs.AI']) as ria \gset
select tests.create_user('nob_nocap') as nob \gset
select tests.open_paper(:'ann') as p \gset

-- accept_abstract: needs capability; creates `accepted`
select tests.act_as(:'nob');
select throws_ok(format('select accept_abstract(%L)', :'p'), 'P0001', null, 'accept needs an endorser capability');
select tests.act_as(:'rex');
select accept_abstract(:'p') as e \gset
select is(tests.state(:'e'), 'accepted', 'accept_abstract -> accepted');
select tests.act_as(:'rex');
select throws_ok(format('select accept_abstract(%L)', :'p'), 'P0001', null, 'cannot accept twice');

-- upload before acceptance is blocked on a fresh paper
select tests.open_paper(:'ann', 'cs.AI', 'Second paper needing acceptance') as p2 \gset
select tests.act_as(:'ann');
select throws_ok(format($$select upload_version(%L, %L, repeat('a',64), 100)$$, :'p2', :'p2' || '/x.pdf'),
  'P0001', null, 'full paper upload requires >=1 acceptance');

-- share requires a version and an endorsement code
select throws_ok(format('select share_paper(%L)', :'e'), 'P0001', null, 'share needs an uploaded PDF');
select upload_version(:'p', :'p' || '/v1.pdf', repeat('b',64), 100) as v1 \gset
select throws_ok(format('select share_paper(%L)', :'e'), 'P0001', null, 'share needs an endorsement code');
select lives_ok(format($$select set_endorsement_code(%L, 'ab12cd')$$, :'p'), 'set_endorsement_code normalises case');
select tests.act_as(:'rex');
select throws_ok(format('select share_paper(%L)', :'e'), 'P0001', null, 'reviewer cannot share');
select tests.act_as(:'ann');
select is(share_paper(:'e')::text, 'reviewing', 'share_paper with free slot -> reviewing');
select is((select status::text from papers where id = :'p'), 'in_review', 'paper -> in_review');

-- endorse is locked until paper opened + LinkedIn checked
select tests.act_as(:'rex');
select throws_ok(format('select record_endorsed(%L)', :'e'), 'P0001', null, 'endorse locked before opening paper');
select is(log_paper_open(:'e', :'v1'), :'p' || '/v1.pdf', 'log_paper_open returns path');
select throws_ok(format('select record_endorsed(%L)', :'e'), 'P0001', null, 'endorse locked before LinkedIn check');
select lives_ok(format('select mark_linkedin_checked(%L)', :'e'), 'mark_linkedin_checked');

-- feedback rounds
select send_feedback(:'e', 'Round one comments') is not null as ok1 \gset
select is((select feedback_rounds from engagements where id = :'e'), 1, 'reviewer message opens round 1');
select send_feedback(:'e', 'more round one comments') is not null as ok2 \gset
select is((select feedback_rounds from engagements where id = :'e'), 1, 'consecutive reviewer messages stay in round');
select tests.act_as(:'ann');
select lives_ok(format($$select send_feedback(%L, 'thanks, updated')$$, :'e'), 'author can reply');
select tests.act_as(:'rex');
select lives_ok(format($$select send_feedback(%L, 'round two')$$, :'e'), 'reviewer round two');
select is((select feedback_rounds from engagements where id = :'e'), 2, 'round++ after author reply');
select tests.act_as(:'nob');
select throws_ok(format($$select send_feedback(%L, 'hi')$$, :'e'), 'P0001', null, 'stranger cannot post feedback');

-- endorse -> endorsed_pending_author -> endorsed
select tests.act_as(:'rex');
select lives_ok(format('select record_endorsed(%L)', :'e'), 'record_endorsed');
select is(tests.state(:'e'), 'endorsed_pending_author', 'record_endorsed -> endorsed_pending_author');
select throws_ok(format('select withdraw_engagement(%L)', :'e'), 'P0001', null, 'cannot withdraw after deciding');
select tests.act_as(:'rex');
select throws_ok(format('select confirm_endorsement(%L)', :'e'), 'P0001', null, 'reviewer cannot confirm');
select tests.act_as(:'ann');
select lives_ok(format('select confirm_endorsement(%L)', :'e'), 'author confirms');
select is(tests.state(:'e'), 'endorsed', 'confirm_endorsement -> endorsed');
select is((select status::text from papers where id = :'p'), 'endorsed', 'paper -> endorsed');

-- decline path, withdraw path, release path on a second paper
select tests.act_as(:'rex');
select accept_abstract(:'p2') as e2 \gset
select tests.act_as(:'ria');
select accept_abstract(:'p2') as e3 \gset
select tests.upload_and_code(:'ann', :'p2');
select tests.act_as(:'ann');
select share_paper(:'e2');
select tests.act_as(:'rex');
select throws_ok(format($$select record_declined(%L, '')$$, :'e2'), 'P0001', null, 'decline needs a reason');
select lives_ok(format($$select record_declined(%L, 'Outside my area')$$, :'e2'), 'record_declined');
select is(tests.state(:'e2'), 'declined', 'reviewing -> declined');
select tests.act_as(:'ria');
select lives_ok(format('select withdraw_engagement(%L)', :'e3'), 'withdraw from accepted');
select is(tests.state(:'e3'), 'withdrawn_by_endorser', 'accepted -> withdrawn_by_endorser');
select tests.act_as(:'ann');
select throws_ok(format('select release_reviewer(%L)', :'e3'), 'P0001', null, 'cannot release a closed engagement');

select * from finish();
rollback;
