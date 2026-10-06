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
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin());

-- habits
create policy "habits_all_own" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habits_select_admin" on public.habits
  for select using (public.is_admin());

-- habit_logs
create policy "habit_logs_all_own" on public.habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- moods
create policy "moods_all_own" on public.moods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- quotes: readable by all authenticated users, writable by admin only
create policy "quotes_select_auth" on public.quotes
  for select using (auth.role() = 'authenticated');
create policy "quotes_write_admin" on public.quotes
  for all using (public.is_admin()) with check (public.is_admin());

-- achievements
create policy "achievements_all_own" on public.achievements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- focus_sessions
create policy "focus_all_own" on public.focus_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
