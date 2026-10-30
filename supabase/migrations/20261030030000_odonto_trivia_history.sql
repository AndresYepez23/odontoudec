-- Historial privado de rondas del estudiante autenticado.
create or replace function public.get_my_trivia_history(limit_count integer default 20)
returns table (
  attempt_id bigint,
  score integer,
  correct_answers smallint,
  total_questions smallint,
  category text,
  created_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  select a.id, a.score, a.correct_answers, a.total_questions, a.category, a.created_at
  from public.trivia_attempts a
  where a.user_id = auth.uid()
  order by a.created_at desc
  limit greatest(1, least(coalesce(limit_count,20),50));
$$;

revoke all on function public.get_my_trivia_history(integer) from public, anon;
grant execute on function public.get_my_trivia_history(integer) to authenticated;
