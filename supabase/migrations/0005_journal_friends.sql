-- Action & Quality — mood journal notes, recurring plans, memory game, friends.
-- Apply after 0004_broadcasts.sql.

alter table public.moods add column if not exists note text;

alter table public.plans add column if not exists repeat text not null default 'none'
  check (repeat in ('none', 'daily', 'weekly', 'monthly'));
alter table public.plans add column if not exists subtasks jsonb not null default '[]';

-- Arcade: memory game joins the score board.
alter table public.game_scores drop constraint if exists game_scores_game_check;
alter table public.game_scores add constraint game_scores_game_check
  check (game in ('catch', 'quiz', 'breathe', 'memory'));

-- Friends: add someone by their profile id, see their XP on a leaderboard.
create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, friend_id)
);

alter table public.friends enable row level security;
create policy "friends_all_own" on public.friends
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- A user may read the profile of anyone who added them.
create policy "profiles_read_by_friends" on public.profiles
  for select using (
    exists (select 1 from public.friends f where f.user_id = auth.uid() and f.friend_id = profiles.id)
  );
