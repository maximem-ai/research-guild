-- Shared helpers for the SQL test suite. Runs first (alphabetical) and is committed so later
-- files can use the `tests` schema. Each other file runs in its own transaction and rolls back.
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

begin;
select plan(1);

create or replace function tests.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
end $$;

create or replace function tests.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

create or replace function tests.act_as_service() returns void language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

create or replace function tests.reset_role() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- creates auth user + profile; optional endorser capabilities (claimed) in p_endorse categories
create or replace function tests.create_user(p_handle text, p_endorse text[] default '{}', p_github text default null)
returns uuid language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); c text;
begin
  perform tests.reset_role();
  insert into auth.users (id, email) values (v_uid, p_handle || '@example.test');
  if p_github is not null then
    insert into auth.identities (user_id, provider, identity_data)
    values (v_uid, 'github', jsonb_build_object('user_name', p_github));
  end if;
  perform tests.act_as(v_uid);
  perform public.upsert_profile(p_handle, initcap(replace(p_handle, '_', ' ')),
    'https://www.linkedin.com/in/' || replace(p_handle, '_', '-'), array['cs.AI'],
    array(select id from public.topics where category_code = 'cs.AI' order by id limit 2), true);
  foreach c in array p_endorse loop
    perform public.attest_capability(c, 'https://arxiv.org/auth/show-endorsers/2401.00001');
  end loop;
  perform tests.reset_role();
  return v_uid;
end $$;

-- a posted (open) paper in p_cat owned by p_owner
create or replace function tests.open_paper(p_owner uuid, p_cat text default 'cs.AI', p_title text default 'A careful study of something')
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  perform tests.act_as(p_owner);
  v_id := public.create_paper_draft(p_title, repeat('This abstract describes the contribution in detail. ', 6),
    p_cat, '{}', 'original_research', true,
    array(select id from public.topics where category_code = p_cat order by id limit 1));
  perform public.submit_readiness_check(v_id, jsonb_build_object('paper_type', 'original_research',
    'english_complete', true, 'draft_finished', true, 'primary_category', p_cat, 'own_work', true,
    'has_endorsement_code', true, 'no_mass_asking', true));
  perform public.post_abstract(v_id);
  perform tests.reset_role();
  return v_id;
end $$;

-- uploads a version + sets the endorsement code (paper needs >=1 acceptance first)
create or replace function tests.upload_and_code(p_owner uuid, p_paper uuid, p_code text default null)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  perform tests.act_as(p_owner);
  v_id := public.upload_version(p_paper, p_paper::text || '/' || replace(gen_random_uuid()::text, '-', '') || '.pdf',
                                repeat('a', 64), 12345, 'v');
  if not exists (select 1 from public.paper_secrets where paper_id = p_paper) then
    perform public.set_endorsement_code(p_paper, coalesce(p_code, upper(substr(md5(p_paper::text), 1, 6))));
  end if;
  perform tests.reset_role();
  return v_id;
end $$;

-- endorser accepts, author shares; returns engagement id
create or replace function tests.accept_and_share(p_owner uuid, p_endorser uuid, p_paper uuid)
returns uuid language plpgsql as $$
declare v_e uuid;
begin
  perform tests.act_as(p_endorser);
  v_e := public.accept_abstract(p_paper);
  if not exists (select 1 from public.paper_versions where paper_id = p_paper) then
    perform tests.upload_and_code(p_owner, p_paper);
  end if;
  perform tests.act_as(p_owner);
  perform public.share_paper(v_e);
  perform tests.reset_role();
  return v_e;
end $$;

-- reviewer opens paper + checks LinkedIn
create or replace function tests.open_and_check(p_endorser uuid, p_engagement uuid) returns void
language plpgsql as $$
begin
  perform tests.act_as(p_endorser);
  perform public.log_paper_open(p_engagement, (select v.id from public.paper_versions v join public.engagements e
    on e.paper_id = v.paper_id where e.id = p_engagement order by v.version_no desc limit 1));
  perform public.mark_linkedin_checked(p_engagement);
  perform tests.reset_role();
end $$;

create or replace function tests.state(p_engagement uuid) returns text language sql as $$
  select state::text from public.engagements where id = p_engagement
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

select pass('test helpers installed');
select * from finish();
commit;
