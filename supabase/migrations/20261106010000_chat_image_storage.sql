-- OdontoUdeC: almacenamiento privado de fotografías para chat general, privados y grupos.
-- No crea ni modifica tablas de mensajería. Las referencias viajan en el campo content existente.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  false,
  1536000,
  array['image/jpeg', 'image/webp']::text[]
)
on conflict (id) do nothing;

drop policy if exists "Odonto chat images read" on storage.objects;
create policy "Odonto chat images read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-media'
  and (
    split_part(name, '/', 1) = 'community'
    or (
      split_part(name, '/', 1) = 'private'
      and exists (
        select 1
        from public.private_conversations c
        where c.id::text = split_part(name, '/', 2)
          and (c.user_one = (select auth.uid()) or c.user_two = (select auth.uid()))
      )
    )
    or (
      split_part(name, '/', 1) = 'groups'
      and exists (
        select 1
        from public.study_group_members m
        where m.group_id::text = split_part(name, '/', 2)
          and m.user_id = (select auth.uid())
      )
    )
  )
);

drop policy if exists "Odonto chat images upload" on storage.objects;
create policy "Odonto chat images upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-media'
  and (
    (
      split_part(name, '/', 1) = 'community'
      and split_part(name, '/', 2) = (select auth.uid())::text
      and array_length(string_to_array(name, '/'), 1) = 3
    )
    or (
      split_part(name, '/', 1) = 'private'
      and split_part(name, '/', 3) = (select auth.uid())::text
      and array_length(string_to_array(name, '/'), 1) = 4
      and exists (
        select 1
        from public.private_conversations c
        where c.id::text = split_part(name, '/', 2)
          and (c.user_one = (select auth.uid()) or c.user_two = (select auth.uid()))
      )
    )
    or (
      split_part(name, '/', 1) = 'groups'
      and split_part(name, '/', 3) = (select auth.uid())::text
      and array_length(string_to_array(name, '/'), 1) = 4
      and exists (
        select 1
        from public.study_group_members m
        where m.group_id::text = split_part(name, '/', 2)
          and m.user_id = (select auth.uid())
      )
    )
  )
);

drop policy if exists "Odonto chat images delete own" on storage.objects;
create policy "Odonto chat images delete own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'chat-media'
  and (
    (
      split_part(name, '/', 1) = 'community'
      and split_part(name, '/', 2) = (select auth.uid())::text
    )
    or (
      split_part(name, '/', 1) in ('private', 'groups')
      and split_part(name, '/', 3) = (select auth.uid())::text
    )
  )
);
