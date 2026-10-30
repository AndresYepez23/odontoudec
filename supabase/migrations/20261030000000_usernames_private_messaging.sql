alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_lower_unique on public.profiles(lower(username)) where username is not null and btrim(username)<>'';

-- Emails are kept in a private lookup table, never exposed through public profiles.
create table if not exists public.private_login_index(
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 username text,
 created_at timestamptz not null default now()
);
create unique index if not exists private_login_email_lower_unique on public.private_login_index(lower(email));
create unique index if not exists private_login_username_lower_unique on public.private_login_index(lower(username)) where username is not null and btrim(username)<>'';
alter table public.private_login_index enable row level security;
revoke all on public.private_login_index from public,anon,authenticated;
grant all on public.private_login_index to service_role;

create or replace function public.sync_odontoudec_user() returns trigger
language plpgsql security definer set search_path=public,auth as $$
declare display_value text; username_value text;
begin
 display_value:=coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''),nullif(split_part(coalesce(new.email,''),'@',1),''),'Estudiante');
 username_value:=nullif(lower(btrim(new.raw_user_meta_data->>'username')),'');
 insert into public.profiles(id,display_name,username) values(new.id,left(display_value,60),username_value)
 on conflict(id) do update set display_name=coalesce(nullif(public.profiles.display_name,''),excluded.display_name),username=coalesce(public.profiles.username,excluded.username);
 if new.email is not null then
  insert into public.private_login_index(user_id,email,username) values(new.id,lower(new.email),username_value)
  on conflict(user_id) do update set email=excluded.email,username=coalesce(excluded.username,public.private_login_index.username);
 end if;
 return new;
end $$;
drop trigger if exists odontoudec_sync_user on auth.users;
create trigger odontoudec_sync_user after insert or update of email,raw_user_meta_data on auth.users for each row execute function public.sync_odontoudec_user();

-- Existing accounts are retained and receive a private email lookup entry.
insert into public.private_login_index(user_id,email,username)
select u.id,lower(u.email),p.username from auth.users u left join public.profiles p on p.id=u.id where u.email is not null
on conflict(user_id) do update set email=excluded.email,username=coalesce(excluded.username,public.private_login_index.username);

create or replace function public.search_students(search_term text)
returns table(id uuid,display_name text,username text)
language sql security definer set search_path=public as $$
 select p.id,coalesce(p.display_name,'Estudiante'),p.username
 from public.profiles p
 where auth.uid() is not null and p.id<>auth.uid() and p.username is not null
 and (p.username ilike '%'||left(btrim(coalesce(search_term,'')),40)||'%' or p.display_name ilike '%'||left(btrim(coalesce(search_term,'')),40)||'%')
 order by p.display_name limit 20;
$$;
revoke all on function public.search_students(text) from public,anon;
grant execute on function public.search_students(text) to authenticated;

create table if not exists public.private_conversations(
 id uuid primary key default gen_random_uuid(),
 user_one uuid not null references auth.users(id) on delete cascade,
 user_two uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 last_message_at timestamptz not null default now(),
 constraint private_conversations_distinct check(user_one<>user_two),
 constraint private_conversations_sorted check(user_one<user_two),
 constraint private_conversations_pair unique(user_one,user_two)
);
create table if not exists public.private_messages(
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.private_conversations(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 content text not null check(char_length(btrim(content)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index if not exists private_messages_conversation_created_idx on public.private_messages(conversation_id,created_at);
alter table public.private_conversations enable row level security;
alter table public.private_messages enable row level security;

drop policy if exists "Participants can view private conversations" on public.private_conversations;
create policy "Participants can view private conversations" on public.private_conversations for select to authenticated using(auth.uid()=user_one or auth.uid()=user_two);
drop policy if exists "Participants can create private conversations" on public.private_conversations;
create policy "Participants can create private conversations" on public.private_conversations for insert to authenticated with check((auth.uid()=user_one or auth.uid()=user_two) and user_one<>user_two);

drop policy if exists "Participants can read private messages" on public.private_messages;
create policy "Participants can read private messages" on public.private_messages for select to authenticated using(exists(select 1 from public.private_conversations c where c.id=conversation_id and (auth.uid()=c.user_one or auth.uid()=c.user_two)));
drop policy if exists "Participants can send private messages" on public.private_messages;
create policy "Participants can send private messages" on public.private_messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.private_conversations c where c.id=conversation_id and (auth.uid()=c.user_one or auth.uid()=c.user_two)));

create or replace function public.touch_private_conversation() returns trigger language plpgsql security definer set search_path=public as $$
begin update public.private_conversations set last_message_at=new.created_at where id=new.conversation_id; return new; end $$;
drop trigger if exists private_message_touch_conversation on public.private_messages;
create trigger private_message_touch_conversation after insert on public.private_messages for each row execute function public.touch_private_conversation();
grant select,insert on public.private_conversations to authenticated;
grant select,insert on public.private_messages to authenticated;
