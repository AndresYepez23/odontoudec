-- Historial privado de rondas del estudiante autenticado.
drop function if exists public.get_my_trivia_history(integer);
create function public.get_my_trivia_history(limit_count integer default 20)
returns table (
  attempt_id bigint,
  score integer,
  correct_answers smallint,
  total_questions smallint,
  category text,
  created_at timestamptz,
  total_points bigint,
  total_rounds bigint,
  best_score integer
)
language sql
security definer
set search_path = public, auth
as $$
  with mine as (
    select a.id, a.score, a.correct_answers, a.total_questions, a.category, a.created_at,
      sum(a.score) over () as total_points,
      count(*) over () as total_rounds,
      max(a.score) over () as best_score
    from public.trivia_attempts a
    where a.user_id = auth.uid()
  )
  select id, score, correct_answers, total_questions, category, created_at,
    total_points, total_rounds, best_score
  from mine
  order by created_at desc
  limit greatest(1, least(coalesce(limit_count,20),50));
$$;

revoke all on function public.get_my_trivia_history(integer) from public, anon;
grant execute on function public.get_my_trivia_history(integer) to authenticated;
