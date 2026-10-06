-- Action & Quality — arcade: game scores and daily challenges.
-- Apply after 0001_init.sql.

create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game in ('catch', 'quiz', 'breathe')),
  score int not null default 0,
  played_at timestamptz not null default now()
);

create index if not exists game_scores_user_idx on public.game_scores (user_id, game);

create table if not exists public.daily_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  code text not null,
  done boolean not null default false,
  unique (user_id, date)
);

-- New arcade achievements.
alter table public.achievements drop constraint if exists achievements_code_check;
alter table public.achievements add constraint achievements_code_check
  check (code in (
    'week_streak', 'month_streak', 'focus10', 'checkin7',
    'arcade100', 'breathe5', 'quiz15', 'challenge7'
  ));

alter table public.game_scores enable row level security;
alter table public.daily_challenges enable row level security;

create policy "game_scores_all_own" on public.game_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_challenges_all_own" on public.daily_challenges
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
