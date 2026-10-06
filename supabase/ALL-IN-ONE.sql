-- ============================================================
-- ACTION & QUALITY — установка бэкенда ОДНИМ файлом
-- Вставьте ВЕСЬ этот текст в Supabase SQL Editor и нажмите Run.
-- Файл можно запускать повторно — он ничего не ломает.
-- ============================================================

-- ============================================================
-- 0001_init.sql
-- ============================================================
-- Action & Quality — Supabase schema, RLS and email-based roles.
-- Apply in Supabase SQL editor or via `supabase db push`.

-- ============ profiles ============
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null default '',
  role text not null default 'user' check (role in ('user', 'premium', 'admin')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  locale text not null default 'ru' check (locale in ('ru', 'en')),
  xp int not null default 0,
  level int not null default 1,
  goals jsonb not null default '[]',
  onboarded boolean not null default false,
  accent text,
  blob_hue int,
  blocked boolean not null default false,
  last_active date,
  created_at timestamptz not null default now()
);

-- Roles by email are assigned at signup (product requirement).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  assigned_role text := 'user';
begin
  if lower(new.email) = 'ivan@dev.ru' then
    assigned_role := 'admin';
  elsif lower(new.email) = 'miamor@for.you' then
    assigned_role := 'premium';
  end if;
  insert into public.profiles (id, email, name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', ''), assigned_role);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============ habits ============
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  icon text not null default 'Circle',
  color text not null default '#3AA7E8',
  schedule jsonb not null default '[0,1,2,3,4]',
  reminder_at text,
  created_at timestamptz not null default now()
);

-- ============ habit_logs ============
create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  done boolean not null default true,
  unique (habit_id, date)
);

-- ============ moods ============
create table if not exists public.moods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  mood int not null check (mood between 1 and 5),
  unique (user_id, date)
);

-- ============ quotes ============
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  text_ru text not null,
  text_en text not null,
  author text not null default '',
  category text not null check (category in ('motivation', 'discipline', 'love', 'confidence'))
);

-- ============ achievements ============
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null check (code in ('week_streak', 'month_streak', 'focus10', 'checkin7')),
  unlocked_at timestamptz not null default now(),
  unique (user_id, code)
);

-- ============ focus_sessions ============
create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_id uuid references public.habits (id) on delete set null,
  minutes int not null,
  completed_at timestamptz not null default now()
);

create index if not exists habit_logs_user_date_idx on public.habit_logs (user_id, date);
create index if not exists moods_user_date_idx on public.moods (user_id, date);
create index if not exists focus_user_idx on public.focus_sessions (user_id, completed_at);

-- ============ admin helper ============
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.moods enable row level security;
alter table public.quotes enable row level security;
alter table public.achievements enable row level security;
alter table public.focus_sessions enable row level security;

-- profiles: users see/update only their own row; admin sees all, manages block/role
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin());

-- habits
drop policy if exists "habits_all_own" on public.habits;
create policy "habits_all_own" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "habits_select_admin" on public.habits;
create policy "habits_select_admin" on public.habits
  for select using (public.is_admin());

-- habit_logs
drop policy if exists "habit_logs_all_own" on public.habit_logs;
create policy "habit_logs_all_own" on public.habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- moods
drop policy if exists "moods_all_own" on public.moods;
create policy "moods_all_own" on public.moods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- quotes: readable by all authenticated users, writable by admin only
drop policy if exists "quotes_select_auth" on public.quotes;
create policy "quotes_select_auth" on public.quotes
  for select using (auth.role() = 'authenticated');
drop policy if exists "quotes_write_admin" on public.quotes;
create policy "quotes_write_admin" on public.quotes
  for all using (public.is_admin()) with check (public.is_admin());

-- achievements
drop policy if exists "achievements_all_own" on public.achievements;
create policy "achievements_all_own" on public.achievements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- focus_sessions
drop policy if exists "focus_all_own" on public.focus_sessions;
create policy "focus_all_own" on public.focus_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 0002_games.sql
-- ============================================================
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

drop policy if exists "game_scores_all_own" on public.game_scores;
create policy "game_scores_all_own" on public.game_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "daily_challenges_all_own" on public.daily_challenges;
create policy "daily_challenges_all_own" on public.daily_challenges
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 0003_plans.sql
-- ============================================================
-- Action & Quality — personal plans (day / week / month tasks).
-- Apply after 0002_games.sql.

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  due date not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists plans_user_due_idx on public.plans (user_id, due);

alter table public.plans enable row level security;

drop policy if exists "plans_all_own" on public.plans;
create policy "plans_all_own" on public.plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 0004_broadcasts.sql
-- ============================================================
-- Action & Quality — admin broadcasts shown on every user's Home screen.
-- Apply after 0003_plans.sql.

create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists broadcasts_created_idx on public.broadcasts (created_at desc);

alter table public.broadcasts enable row level security;

-- Everyone authenticated sees the feed; only admins may write.
drop policy if exists "broadcasts_select_auth" on public.broadcasts;
create policy "broadcasts_select_auth" on public.broadcasts
  for select using (auth.role() = 'authenticated');
drop policy if exists "broadcasts_write_admin" on public.broadcasts;
create policy "broadcasts_write_admin" on public.broadcasts
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 0005_journal_friends.sql
-- ============================================================
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
drop policy if exists "friends_all_own" on public.friends;
create policy "friends_all_own" on public.friends
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- A user may read the profile of anyone who added them.
drop policy if exists "profiles_read_by_friends" on public.profiles;
create policy "profiles_read_by_friends" on public.profiles
  for select using (
    exists (select 1 from public.friends f where f.user_id = auth.uid() and f.friend_id = profiles.id)
  );

-- ============================================================
-- 0006_xp_rpc.sql
-- ============================================================
-- Action & Quality — atomic XP updates and backend quality pass.
-- Apply after 0005_journal_friends.sql.

-- Atomic XP: replaces the client-side read-modify-write (race-prone when the
-- same user acts from two devices). Returns the fresh profile row.
create or replace function public.increment_xp(p_amount int)
returns setof public.profiles
language plpgsql
security definer set search_path = public
as $$
begin
  if p_amount is null then
    raise exception 'amount is required';
  end if;
  return query
  update public.profiles
  set xp = greatest(0, xp + p_amount),
      level = greatest(1, floor(greatest(0, xp + p_amount) / 100.0)) + 1
  where id = auth.uid()
  returning *;
end;
$$;
