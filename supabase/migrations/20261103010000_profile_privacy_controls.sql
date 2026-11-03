-- Privacy controls for student profiles.
alter table public.profiles
  add column if not exists profile_visibility text not null default 'public';
alter table public.profiles drop constraint if exists profiles_profile_visibility_check;
alter table public.profiles add constraint profiles_profile_visibility_check
  check (profile_visibility in ('public','private'));

drop policy if exists "Profiles are viewable" on public.profiles;
drop policy if exists "Profiles visible by privacy setting" on public.profiles;
create policy "Profiles visible by privacy setting"
  on public.profiles for select to anon, authenticated
  using (profile_visibility = 'public' or auth.uid() = id);

create or replace function public.search_students(search_term text)
returns table (id uuid, display_name text, public_id text, semester smallint)
language sql security definer set search_path = public
as $$
  select p.id, coalesce(nullif(btrim(p.display_name), ''), 'Estudiante'), p.public_id, p.semester
  from public.profiles p
  where auth.uid() is not null and p.id <> auth.uid()
    and p.profile_visibility = 'public'
    and length(btrim(coalesce(search_term, ''))) >= 2
    and (p.display_name ilike '%' || left(btrim(search_term), 60) || '%'
      or upper(p.public_id) = upper(left(btrim(search_term), 20)))
  order by case when upper(p.public_id) = upper(left(btrim(search_term), 20)) then 0 else 1 end, p.display_name
  limit 30;
$$;
revoke all on function public.search_students(text) from public, anon;
grant execute on function public.search_students(text) to authenticated;
