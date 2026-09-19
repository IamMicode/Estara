-- =============================================================================
-- ESTARA — 0003 STORAGE
-- Public read bucket for property imagery; writes restricted to the owning
-- agent by path convention: property-images/<property_id>/<filename>
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-images',
  'property-images',
  true,
  5242880, -- 5 MB, also enforced client-side before upload
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may read property imagery (listings are public once published).
drop policy if exists "property images are publicly readable" on storage.objects;
create policy "property images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'property-images');

-- Only the agent who owns the property folder may write into it.
drop policy if exists "agents upload to their own property folder" on storage.objects;
create policy "agents upload to their own property folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-images'
    and exists (
      select 1 from properties p
       where p.id::text = (storage.foldername(name))[1]
         and p.agent_id = current_agent_id()
    )
  );

drop policy if exists "agents update their own property images" on storage.objects;
create policy "agents update their own property images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'property-images'
    and exists (
      select 1 from properties p
       where p.id::text = (storage.foldername(name))[1]
         and p.agent_id = current_agent_id()
    )
  );

drop policy if exists "agents delete their own property images" on storage.objects;
create policy "agents delete their own property images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-images'
    and exists (
      select 1 from properties p
       where p.id::text = (storage.foldername(name))[1]
         and p.agent_id = current_agent_id()
    )
  );

drop policy if exists "admins manage all property images" on storage.objects;
create policy "admins manage all property images"
  on storage.objects for all to authenticated
  using (bucket_id = 'property-images' and is_admin())
  with check (bucket_id = 'property-images' and is_admin());

-- Avatars ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars','avatars', true, 2097152,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "avatars are publicly readable" on storage.objects;
create policy "avatars are publicly readable"
  on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "users manage their own avatar" on storage.objects;
create policy "users manage their own avatar"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = current_profile_id()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = current_profile_id()::text
  );
