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
create policy "broadcasts_select_auth" on public.broadcasts
  for select using (auth.role() = 'authenticated');
create policy "broadcasts_write_admin" on public.broadcasts
  for all using (public.is_admin()) with check (public.is_admin());
