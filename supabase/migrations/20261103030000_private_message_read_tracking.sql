-- Track the last time each student opened a private conversation.
create table if not exists public.private_message_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.private_conversations(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);
create index if not exists idx_private_message_reads_conversation on public.private_message_reads(conversation_id);
alter table public.private_message_reads enable row level security;
drop policy if exists "Users read own private message read markers" on public.private_message_reads;
create policy "Users read own private message read markers" on public.private_message_reads for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users create own private message read markers" on public.private_message_reads;
create policy "Users create own private message read markers" on public.private_message_reads for insert to authenticated with check (
  (select auth.uid()) = user_id and exists (
    select 1 from public.private_conversations c
    where c.id = conversation_id and ((select auth.uid()) = c.user_one or (select auth.uid()) = c.user_two)
  )
);
drop policy if exists "Users update own private message read markers" on public.private_message_reads;
create policy "Users update own private message read markers" on public.private_message_reads for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id and exists (
    select 1 from public.private_conversations c
    where c.id = conversation_id and ((select auth.uid()) = c.user_one or (select auth.uid()) = c.user_two)
  )
);
