-- 004: the gorge's bridges, built by visitors and kept for everyone.
-- Progress per bridge (ledge index k): the build step it is on, how far through that step, and whether it is done
-- (the steps are the build scripts in build.js). Anyone may build, signed in or not. Progress only ever moves
-- forward, so a save can never undo someone else's work. The table is closed; the site reads and writes through the
-- two functions below. Run once: bash ~/.config/tuw/run-sql.sh supabase/004_bridges.sql
create table if not exists public.bridges (
  k          int primary key check (k >= 0 and k < 1000),
  step       int not null default 0 check (step >= 0 and step <= 32),
  frac       real not null default 0 check (frac >= 0 and frac <= 1),
  done       boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.bridges enable row level security;
revoke all on public.bridges from anon, authenticated;

-- every bridge with any progress
create or replace function public.bridges_state()
returns table (k int, step int, frac real, done boolean)
language sql security definer set search_path = public stable as $$
  select b.k, b.step, b.frac, b.done from public.bridges b order by b.k;
$$;

-- move bridge k forward to (step, frac) or to done; never back. Returns the bridge as it now stands.
create or replace function public.build_bridge(p_k int, p_step int, p_frac real, p_done boolean)
returns table (k int, step int, frac real, done boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if p_k is null or p_k < 0 or p_k >= 1000 or p_step is null or p_step < 0 or p_step > 32
     or p_frac is null or p_frac < 0 or p_frac > 1 then
    raise exception 'bridge progress out of range';
  end if;
  insert into public.bridges as b (k, step, frac, done) values (p_k, p_step, p_frac, coalesce(p_done, false))
  on conflict on constraint bridges_pkey do update
    set step = excluded.step, frac = excluded.frac, done = excluded.done, updated_at = now()
    where not b.done and (excluded.done or (excluded.step, excluded.frac) > (b.step, b.frac));
  return query select b.k, b.step, b.frac, b.done from public.bridges b where b.k = p_k;
end;
$$;

revoke all on function public.bridges_state() from public;
revoke all on function public.build_bridge(int, int, real, boolean) from public;
grant execute on function public.bridges_state() to anon, authenticated;
grant execute on function public.build_bridge(int, int, real, boolean) to anon, authenticated;
