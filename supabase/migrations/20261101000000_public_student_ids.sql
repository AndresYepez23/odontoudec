-- Public student IDs for OdontoUdeC. Safe for existing Auth users.
-- Does not alter UUIDs, credentials, conversations or academic records.

alter table public.profiles
  add column if not exists public_id text;

create unique index if not exists profiles_public_id_unique
  on public.profiles (public_id)
  where public_id is not null;

create or replace function public.generate_student_public_id()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := 'OD-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));
    exit when not exists (
      select 1 from public.profiles p where p.public_id = candidate
    );
  end loop;
  return candidate;
end;
$$;

update public.profiles
set public_id = public.generate_student_public_id()
where public_id is null;

alter table public.profiles
  alter column public_id set default public.generate_student_public_id();

alter table public.profiles
  alter column public_id set not null;

create or replace function public.assign_student_public_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.public_id is null or btrim(new.public_id) = '' then
    new.public_id := public.generate_student_public_id();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_assign_public_id on public.profiles;
create trigger profiles_assign_public_id
before insert on public.profiles
for each row execute function public.assign_student_public_id();

-- Search by full name or public ID; never expose email or private login data.
drop function if exists public.search_students(text);
create function public.search_students(search_term text)
returns table (id uuid, display_name text, public_id text, semester smallint)
language sql
security definer
set search_path = public
as $$
  select p.id,
         coalesce(nullif(btrim(p.display_name), ''), 'Estudiante'),
         p.public_id,
         p.semester
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and length(btrim(coalesce(search_term, ''))) >= 2
    and (
      p.display_name ilike '%' || left(btrim(search_term), 60) || '%'
      or upper(p.public_id) = upper(left(btrim(search_term), 20))
    )
  order by
    case when upper(p.public_id) = upper(left(btrim(search_term), 20)) then 0 else 1 end,
    p.display_name
  limit 30;
$$;

revoke all on function public.search_students(text) from public, anon;
grant execute on function public.search_students(text) to authenticated;

comment on column public.profiles.public_id is
  'Public, stable student identifier. UUID remains the internal relational key.';
