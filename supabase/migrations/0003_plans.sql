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

create policy "plans_all_own" on public.plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
