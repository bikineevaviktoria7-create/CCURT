-- Row Level Security: everyone reads the dictionary, only admins edit it,
-- users see only their own results.

alter table public.profiles enable row level security;
alter table public.gestures enable row level security;
alter table public.gesture_samples enable row level security;
alter table public.lesson_results enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "gestures: read all" on public.gestures;
create policy "gestures: read all" on public.gestures for select using (true);
drop policy if exists "gestures: admin insert" on public.gestures;
create policy "gestures: admin insert" on public.gestures for insert with check (public.is_admin());
drop policy if exists "gestures: admin update" on public.gestures;
create policy "gestures: admin update" on public.gestures for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "gestures: admin delete" on public.gestures;
create policy "gestures: admin delete" on public.gestures for delete using (public.is_admin());

drop policy if exists "samples: read all" on public.gesture_samples;
create policy "samples: read all" on public.gesture_samples for select using (true);
drop policy if exists "samples: admin insert" on public.gesture_samples;
create policy "samples: admin insert" on public.gesture_samples for insert with check (public.is_admin());
drop policy if exists "samples: admin update" on public.gesture_samples;
create policy "samples: admin update" on public.gesture_samples for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "samples: admin delete" on public.gesture_samples;
create policy "samples: admin delete" on public.gesture_samples for delete using (public.is_admin());

drop policy if exists "results: read own" on public.lesson_results;
create policy "results: read own" on public.lesson_results for select using (user_id = auth.uid());
drop policy if exists "results: insert own" on public.lesson_results;
create policy "results: insert own" on public.lesson_results for insert with check (user_id = auth.uid());
