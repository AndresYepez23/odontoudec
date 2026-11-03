-- OdontoUdeC: remove streak tracking and optimize database performance.
-- The streak feature was intentionally discontinued; remove its stored activity log.
drop table if exists public.user_activity_days;

-- Add indexes for foreign-key columns reported by the Supabase performance advisor.
create index if not exists academic_events_created_by_idx on public.academic_events (created_by);
create index if not exists academic_resources_created_by_idx on public.academic_resources (created_by);
create index if not exists chat_reports_message_id_idx on public.chat_reports (message_id);
create index if not exists chat_reports_reporter_id_idx on public.chat_reports (reporter_id);
create index if not exists comments_author_id_idx on public.comments (author_id);
create index if not exists comments_post_id_idx on public.comments (post_id);
create index if not exists content_reports_post_id_idx on public.content_reports (post_id);
create index if not exists content_reports_reporter_id_idx on public.content_reports (reporter_id);
create index if not exists post_comments_author_id_idx on public.post_comments (author_id);
create index if not exists post_comments_post_id_idx on public.post_comments (post_id);
create index if not exists post_reactions_user_id_idx on public.post_reactions (user_id);
create index if not exists posts_author_id_idx on public.posts (author_id);
create index if not exists private_conversations_user_two_idx on public.private_conversations (user_two);
create index if not exists private_messages_sender_id_idx on public.private_messages (sender_id);
create index if not exists saved_resources_collection_id_idx on public.saved_resources (collection_id);
create index if not exists saved_resources_resource_id_idx on public.saved_resources (resource_id);
create index if not exists study_group_messages_sender_id_idx on public.study_group_messages (sender_id);
create index if not exists study_groups_created_by_idx on public.study_groups (created_by);

-- Evaluate auth.uid() once per statement instead of once per row.
-- Preserve each policy's roles, command, and authorization predicate.
do $$
declare
  p record;
  statement text;
begin
  for p in
    select *
    from pg_policies
    where schemaname = 'public'
      and tablename <> 'user_activity_days'
      and (
        coalesce(qual, '') ~ 'auth\.uid\(\)'
        or coalesce(with_check, '') ~ 'auth\.uid\(\)'
      )
      and coalesce(qual, '') !~* 'select[[:space:]]+auth\.uid'
      and coalesce(with_check, '') !~* 'select[[:space:]]+auth\.uid'
  loop
    statement := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if p.qual is not null then
      statement := statement || format(' using (%s)', replace(p.qual, 'auth.uid()', '(select auth.uid())'));
    end if;
    if p.with_check is not null then
      statement := statement || format(' with check (%s)', replace(p.with_check, 'auth.uid()', '(select auth.uid())'));
    end if;
    execute statement;
  end loop;
end
$$;
