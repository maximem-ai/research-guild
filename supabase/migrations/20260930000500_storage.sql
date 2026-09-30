-- Endorse Commons: Storage buckets and policies (SPEC §3, §12)
-- papers: private, PDF only, <= 10 MB. Path layout: <paper_id>/<uuid>.pdf
-- avatars: public images. Path layout: <user_id>/<file>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('papers', 'papers', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 1048576,
  allowed_mime_types = array['image/png','image/jpeg','image/webp'];

-- a reviewer can read a specific file only while its version is live and they are reviewing/pending/endorsed;
-- members can read anything in their paper's folder
create or replace function public.can_read_paper_object(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when safe_uuid(split_part(p_name, '/', 1)) is null then false else
    is_paper_member(safe_uuid(split_part(p_name, '/', 1))) or exists (
      select 1 from paper_versions v
      join engagements e on e.paper_id = v.paper_id
      where v.storage_path = p_name and v.deleted_at is null
        and e.endorser_id = auth.uid() and e.state in ('reviewing','endorsed_pending_author','endorsed'))
  end
$$;

create or replace function public.can_upload_paper_object(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when safe_uuid(split_part(p_name, '/', 1)) is null then false else
    exists (select 1 from papers p where p.id = safe_uuid(split_part(p_name, '/', 1))
            and p.status in ('open','in_review') and is_paper_member(p.id))
    and p_name ~ '^[0-9a-f-]{36}/[0-9a-zA-Z_-]+\.pdf$'
  end
$$;

grant execute on function public.can_read_paper_object(text), public.can_upload_paper_object(text) to authenticated;

create policy "papers: read by members and active reviewers" on storage.objects for select to authenticated
  using (bucket_id = 'papers' and public.can_read_paper_object(name));
create policy "papers: upload by members of open papers" on storage.objects for insert to authenticated
  with check (bucket_id = 'papers' and public.can_upload_paper_object(name));

create policy "avatars: public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');
create policy "avatars: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
create policy "avatars: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
create policy "avatars: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
