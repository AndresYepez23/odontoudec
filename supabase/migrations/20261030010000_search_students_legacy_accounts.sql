-- Allow students with older accounts and no username to appear in private-message search.
-- Run once in the Supabase SQL Editor for the OdontoUdeC project.

create or replace function public.search_students(search_term text)
returns table (id uuid, display_name text, username text)
language sql
security definer
set search_path = public
as $$
  select p.id, coalesce(nullif(btrim(p.display_name), ''), 'Estudiante'), p.username
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and length(btrim(coalesce(search_term, ''))) >= 2
    and (
      coalesce(p.username, '') ilike '%' || left(btrim(coalesce(search_term, '')), 40) || '%'
      or coalesce(p.display_name, '') ilike '%' || left(btrim(coalesce(search_term, '')), 40) || '%'
    )
  order by p.display_name nulls last
  limit 20;
$$;

revoke all on function public.search_students(text) from public, anon;
grant execute on function public.search_students(text) to authenticated;
