begin;
select plan(8);

select tests.create_user('sp_me') as me \gset
select tests.create_user('sp_other') as other \gset

-- add_publication is only for the service role (the `scholar` Edge Function)
select tests.act_as(:'me');
select throws_ok($$select add_publication(auth.uid(), 'arxiv', '2409.00001', 'Mine', 'arXiv', 2024, 'https://arxiv.org/abs/2409.00001', '2409.00001', '{}')$$,
  '42501', null, 'clients cannot call add_publication');
select tests.reset_role();

select ok(add_publication(:'me', 'arxiv', '2409.00001', 'A real paper', 'arXiv', 2024, 'https://arxiv.org/abs/2409.00001',
  '2409.00001', array['Co Author']) > 0, 'service role adds a looked-up paper');
select throws_ok($$select add_publication('$$ || :'me' || $$', 'doi', '10.48550/arxiv.2409.00001', 'Same', null, 2024, 'u', '2409.00001', '{}')$$,
  'P0001', 'That paper is already on your profile.', 'the same paper cannot be added twice (matched on arXiv id)');
select throws_ok($$select add_publication('$$ || :'me' || $$', 'openalex', 'W1', 'x', null, null, null, null, '{}')$$,
  'P0001', 'Unknown paper source.', 'only arxiv/doi sources are accepted');

-- co-author names from added papers feed the co-author karma guard
update profiles set display_name = 'Co Author' where id = :'other';
select ok(are_coauthors(:'me', :'other'), 'added papers count for the co-author check');

-- members remove only their own added papers
select id as pub from profile_publications where user_id = :'me' and external_id = '2409.00001' \gset
select tests.act_as(:'other');
select throws_ok($$select remove_publication($$ || :'pub' || $$)$$, 'P0001', 'Paper not found.', 'others cannot remove my paper');
select tests.act_as(:'me');
select lives_ok($$select remove_publication($$ || :'pub' || $$)$$, 'I can remove my own added paper');
select tests.reset_role();
select is((select count(*)::int from profile_publications where user_id = :'me'), 0, 'paper is gone');

select * from finish();
rollback;
