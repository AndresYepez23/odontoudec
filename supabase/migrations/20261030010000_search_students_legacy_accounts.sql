-- OdontoUdeC: simplify private student search to use real names only.
-- Run once in Supabase SQL Editor. Existing email/password accounts remain unchanged.

-- Ensure every existing Auth account has a public profile name for directory search.
insert into public.profiles (id, display_name)
select
  u.id,
  left(coalesce(
    nullif(btrim(u.raw_user_meta_data->>'display_name'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Estudiante'
  ), 60)
from auth.users u
on conflict (id) do update
set display_name = coalesce(
  nullif(btrim(public.profiles.display_name), ''),
  excluded.display_name
);

-- Replace the old username-based search RPC with name-only search.
drop function if exists public.search_students(text);

create function public.search_students(search_term text)
returns table (id uuid, display_name text)
language sql
security definer
set search_path = public
as $$
  select p.id, coalesce(nullif(btrim(p.display_name), ''), 'Estudiante')
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and length(btrim(coalesce(search_term, ''))) >= 2
    and p.display_name ilike '%' || left(btrim(coalesce(search_term, '')), 60) || '%'
  order by p.display_name
  limit 30;
$$;

revoke all on function public.search_students(text) from public, anon;
grant execute on function public.search_students(text) to authenticated;
