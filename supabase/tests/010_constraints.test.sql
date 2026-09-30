begin;
select plan(16);

select tests.create_user('alice_author') as alice \gset
select tests.create_user('eve_endorser', array['cs.AI']) as eve \gset

-- CS survey/position without peer-review proof is rejected (RPC and table constraint)
select tests.act_as(:'alice');
select throws_ok(
  format($$select create_paper_draft('A survey of everything in AI', %L, 'cs.AI', '{}', 'survey_review', true,
    array(select id from topics where category_code='cs.AI' limit 1))$$, repeat('x', 250)),
  'P0001', null, 'cs survey without peer-review proof rejected by RPC');
select tests.reset_role();
select throws_ok(
  format($$insert into papers (owner_id, title, abstract, primary_category, paper_type, own_work_attested_at)
    values (%L, 'A position on all things', %L, 'cs.LG', 'position', now())$$, :'alice', repeat('x', 250)),
  '23514', null, 'cs position without proof violates table constraint');
select lives_ok(
  format($$insert into papers (owner_id, title, abstract, primary_category, paper_type, own_work_attested_at)
    values (%L, 'A survey in statistics land', %L, 'stat.ML', 'survey_review', now())$$, :'alice', repeat('x', 250)),
  'non-cs survey without proof is allowed');
select tests.act_as(:'alice');
select lives_ok(
  format($$select create_paper_draft('A survey of everything in AI', %L, 'cs.AI', '{}', 'survey_review', true,
    array(select id from topics where category_code='cs.AI' limit 1), 'https://doi.org/10.1000/xyz')$$, repeat('x', 250)),
  'cs survey with proof accepted');

-- own-work attestation required
select throws_ok(
  format($$select create_paper_draft('My own careful paper', %L, 'cs.AI', '{}', 'original_research', false,
    array(select id from topics where category_code='cs.AI' limit 1))$$, repeat('x', 250)),
  'P0001', null, 'own-work attestation is required');

-- readiness gate
select create_paper_draft('Readiness gated paper title', repeat('y', 250), 'cs.AI', '{}', 'original_research', true,
  array(select id from topics where category_code='cs.AI' limit 1)) as p \gset
select throws_ok(format('select post_abstract(%L)', :'p'), 'P0001', null, 'post_abstract fails without readiness check');
select is((submit_readiness_check(:'p', '{"paper_type":"original_research","english_complete":false,"draft_finished":true,"primary_category":"cs.AI","own_work":true,"no_mass_asking":true}'::jsonb))->>'passed',
  'false', 'failing answers fail the check');
select throws_ok(format('select post_abstract(%L)', :'p'), 'P0001', null, 'post_abstract fails with failing readiness check');
select is((submit_readiness_check(:'p', '{"paper_type":"original_research","english_complete":true,"draft_finished":true,"primary_category":"cs.AI","own_work":true,"has_endorsement_code":false,"no_mass_asking":true}'::jsonb))->>'passed',
  'true', 'no endorsement code yet is informational only');
select lives_ok(format('select post_abstract(%L)', :'p'), 'post_abstract succeeds after passing check');
select is((select status::text from papers where id = :'p'), 'open', 'paper is open');

-- no self-review
select tests.act_as(:'alice');
select throws_ok(format('select accept_abstract(%L)', :'p'), 'P0001', null, 'author cannot accept own abstract');
select tests.reset_role();
select throws_ok(format($$insert into engagements (paper_id, endorser_id) values (%L, %L)$$, :'p', :'alice'),
  'P0001', null, 'table trigger blocks self-review even without the RPC');
select tests.act_as(:'eve');
select accept_abstract(:'p') as e \gset
select tests.reset_role();
select throws_ok(format($$insert into paper_members (paper_id, user_id, role) values (%L, %L, 'coauthor')$$, :'p', :'eve'),
  'P0001', null, 'a reviewer cannot be added as co-author');

-- ORCID checksum + handle format
select ok(orcid_valid('0000-0002-1825-0097') and not orcid_valid('0000-0002-1825-0098'), 'ORCID checksum');
select throws_ok($$update profiles set handle = 'Bad Handle!' where handle = 'alice_author'$$, '23514', null, 'handle format enforced');

select * from finish();
rollback;
