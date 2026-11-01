-- OdontoUdeC academic workspace: private notes, saved resources and study groups.
-- Additive migration: preserves existing tables and user records.

create table if not exists public.student_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 140),
  subject text,
  content text not null default '' check (char_length(content) <= 30000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists student_notes_user_updated_idx
  on public.student_notes(user_id, updated_at desc);
alter table public.student_notes enable row level security;
drop policy if exists "Users manage own notes" on public.student_notes;
create policy "Users manage own notes" on public.student_notes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.resource_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  created_at timestamptz not null default now(),
  unique(user_id, name)
);
alter table public.resource_collections enable row level security;
drop policy if exists "Users manage own collections" on public.resource_collections;
create policy "Users manage own collections" on public.resource_collections
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.saved_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id bigint not null references public.academic_resources(id) on delete cascade,
  collection_id uuid references public.resource_collections(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(user_id, resource_id)
);
create index if not exists saved_resources_user_idx on public.saved_resources(user_id, created_at desc);
alter table public.saved_resources enable row level security;
drop policy if exists "Users manage own saved resources" on public.saved_resources;
create policy "Users manage own saved resources" on public.saved_resources
  for all to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid() and (
      collection_id is null or exists (
        select 1 from public.resource_collections c
        where c.id = collection_id and c.user_id = auth.uid()
      )
    )
  );

create table if not exists public.study_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 3 and 90),
  description text not null default '' check (char_length(description) <= 500),
  subject text,
  semester smallint check (semester between 1 and 10),
  created_by uuid not null references auth.users(id) on delete cascade,
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.study_group_members (
  group_id uuid not null references public.study_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key(group_id,user_id)
);
create index if not exists study_group_members_user_idx on public.study_group_members(user_id);
create table if not exists public.study_group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists study_group_messages_group_idx on public.study_group_messages(group_id,created_at desc);

create or replace function public.is_study_group_member(target_group uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and exists (
    select 1 from public.study_group_members m
    where m.group_id=target_group and m.user_id=auth.uid()
  );
$$;
revoke all on function public.is_study_group_member(uuid) from public, anon;
grant execute on function public.is_study_group_member(uuid) to authenticated;

alter table public.study_groups enable row level security;
alter table public.study_group_members enable row level security;
alter table public.study_group_messages enable row level security;

drop policy if exists "Authenticated users view open groups" on public.study_groups;
create policy "Authenticated users view open groups" on public.study_groups
  for select to authenticated using (is_open or created_by = auth.uid() or public.is_study_group_member(id));
drop policy if exists "Users create study groups" on public.study_groups;
create policy "Users create study groups" on public.study_groups
  for insert to authenticated with check (created_by=auth.uid());
drop policy if exists "Owners update groups" on public.study_groups;
create policy "Owners update groups" on public.study_groups
  for update to authenticated using (created_by=auth.uid()) with check (created_by=auth.uid());
drop policy if exists "Members view group membership" on public.study_group_members;
create policy "Members view group membership" on public.study_group_members
  for select to authenticated using (
    user_id=auth.uid() or public.is_study_group_member(group_id)
  );
drop policy if exists "Join open groups" on public.study_group_members;
create policy "Join open groups" on public.study_group_members
  for insert to authenticated with check (
    user_id=auth.uid() and exists (
      select 1 from public.study_groups g where g.id=group_id and g.is_open
    )
  );
drop policy if exists "Leave own group membership" on public.study_group_members;
create policy "Leave own group membership" on public.study_group_members
  for delete to authenticated using (user_id=auth.uid() and role<>'owner');
drop policy if exists "Members read group messages" on public.study_group_messages;
create policy "Members read group messages" on public.study_group_messages
  for select to authenticated using (public.is_study_group_member(study_group_messages.group_id));
drop policy if exists "Members send group messages" on public.study_group_messages;
create policy "Members send group messages" on public.study_group_messages
  for insert to authenticated with check (sender_id=auth.uid() and exists (
    select 1 from public.study_group_members m where m.group_id=study_group_messages.group_id and m.user_id=auth.uid()
  ));

-- Automatically enroll the creator as group owner.
create or replace function public.add_study_group_owner()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.study_group_members(group_id,user_id,role)
  values(new.id,new.created_by,'owner') on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists study_group_owner_membership on public.study_groups;
create trigger study_group_owner_membership after insert on public.study_groups
for each row execute function public.add_study_group_owner();

create table if not exists public.study_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null check (activity_type in ('study_session','quiz_completed','resource_shared','group_contribution')),
  reference_id text,
  activity_date date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now()
);
create index if not exists study_activity_user_date_idx on public.study_activity(user_id,activity_date desc);
alter table public.study_activity enable row level security;
drop policy if exists "Users view own study activity" on public.study_activity;
create policy "Users view own study activity" on public.study_activity
  for select to authenticated using (user_id=auth.uid());
-- Client may log only bounded, basic study-session events; trusted scoring is deliberately not granted.
drop policy if exists "Users log own study sessions" on public.study_activity;
create policy "Users log own study sessions" on public.study_activity
  for insert to authenticated with check (user_id=auth.uid() and activity_type='study_session');

-- Explicit Data API privileges; RLS remains the row-level security boundary.
grant select, insert, update, delete on public.student_notes to authenticated;
grant select, insert, update, delete on public.resource_collections to authenticated;
grant select, insert, delete on public.saved_resources to authenticated;
grant select, insert, update on public.study_groups to authenticated;
grant select, insert, delete on public.study_group_members to authenticated;
grant select, insert on public.study_group_messages to authenticated;
grant select, insert on public.study_activity to authenticated;

create or replace function public.touch_student_note_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at=now();
  return new;
end;
$$;
drop trigger if exists student_notes_touch_updated_at on public.student_notes;
create trigger student_notes_touch_updated_at before update on public.student_notes
for each row execute function public.touch_student_note_updated_at();
