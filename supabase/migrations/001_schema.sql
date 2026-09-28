-- SignStep: tables. Run in Supabase → SQL Editor (files 001…005, then seed.sql).

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- Gesture dictionary. Ids match the frontend (src/data/alphabet.ts, src/data/lessons.ts).
create table if not exists public.gestures (
  id text primary key,
  label text not null,
  category text not null check (category in ('letter', 'word')),
  kind text not null check (kind in ('static', 'dynamic')),
  description text,
  hints jsonb not null default '{}'::jsonb,
  reference_image_url text,
  updated_at timestamptz not null default now()
);

-- Reference samples recorded by the team in the admin panel.
create table if not exists public.gesture_samples (
  id uuid primary key default gen_random_uuid(),
  gesture_id text not null references public.gestures on delete cascade,
  author_id uuid references public.profiles on delete set null,
  features real[],
  sequence jsonb,
  duration_ms int,
  landmarks jsonb not null default '[]'::jsonb,
  handedness text check (handedness in ('left', 'right')),
  feature_version smallint not null default 1,
  created_at timestamptz not null default now(),
  check (features is not null or sequence is not null)
);
create index if not exists gesture_samples_gesture_idx on public.gesture_samples (gesture_id);

-- Finished lessons. id = sessionId from the frontend, so a retry never duplicates.
create table if not exists public.lesson_results (
  id uuid primary key,
  user_id uuid not null references public.profiles on delete cascade,
  lesson_id text not null,
  score int not null check (score >= 0),
  accuracy int not null check (accuracy between 0 and 100),
  stars smallint not null check (stars between 0 and 3),
  duration_ms int not null check (duration_ms >= 0),
  attempts jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null default now()
);
create index if not exists lesson_results_user_idx on public.lesson_results (user_id);
create index if not exists lesson_results_lesson_score_idx on public.lesson_results (lesson_id, score desc);
