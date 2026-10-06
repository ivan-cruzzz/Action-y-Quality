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
