begin;
select plan(6);

-- cron token: rejects missing/short/wrong tokens; accepts the generated Vault secret (when Vault exists)
select is(check_cron_token(null), false, 'null token rejected');
select is(check_cron_token('short'), false, 'short token rejected');
select is(check_cron_token(repeat('0', 64)), false, 'wrong token rejected');
create function pg_temp.vault_token() returns text language plpgsql as $$
declare v text;
begin
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'cron_token'$q$ into v;
  return v;
exception when others then return null;
end $$;
select case when exists (select 1 from pg_namespace where nspname = 'vault')
  then ok(check_cron_token(pg_temp.vault_token()), 'generated cron_token accepted')
  else skip('no Vault in this database (plain Postgres shim)', 1) end;

-- clients can't call the cron helpers
select tests.create_user('kl_user') as u \gset
select tests.act_as(:'u');
select throws_ok($$select check_cron_token('x')$$, '42501', null, 'check_cron_token is service-role only');
select tests.reset_role();

-- orphaned uploads older than a day are listed for the retention job; referenced files are not
select tests.create_user('kl_author') as a \gset
select tests.create_user('kl_rev', array['cs.AI']) as r \gset
select tests.open_paper(:'a') as p \gset
select tests.accept_and_share(:'a', :'r', :'p') as e \gset
insert into storage.objects (bucket_id, name, created_at) values
  ('papers', :'p' || '/orphan.pdf', now() - interval '2 days'),
  ('papers', (select storage_path from paper_versions where paper_id = :'p' limit 1), now() - interval '2 days');
select is((select array_agg(name) from orphaned_paper_objects() where name like :'p' || '/%'), array[:'p' || '/orphan.pdf'],
  'only the unreferenced upload is an orphan');

select * from finish();
rollback;
