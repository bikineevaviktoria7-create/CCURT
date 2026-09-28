-- Leaderboard: sum of each learner's best score per lesson. Exposes only the first name.

create or replace function public.get_leaderboard(p_limit int default 10)
returns table (rank bigint, name text, total_score bigint, lessons_completed bigint, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with best as (
    select user_id, lesson_id, max(score) as score
    from public.lesson_results
    group by user_id, lesson_id
  ), totals as (
    select user_id, sum(score)::bigint as total_score, count(*)::bigint as lessons_completed
    from best
    group by user_id
  )
  select
    rank() over (order by t.total_score desc) as rank,
    coalesce(nullif(split_part(p.name, ' ', 1), ''), 'Ученик') as name,
    t.total_score,
    t.lessons_completed,
    t.user_id = auth.uid() as is_me
  from totals t
  join public.profiles p on p.id = t.user_id
  order by t.total_score desc
  limit least(greatest(p_limit, 1), 50);
$$;

grant execute on function public.get_leaderboard(int) to anon, authenticated;
