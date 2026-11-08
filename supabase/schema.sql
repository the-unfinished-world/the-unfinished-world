-- The Unfinished World: collective sign-ups.
-- The table is closed to the public API (RLS on, no policies). The page calls join_collective() only.
create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 1 and 120),
  email       text not null unique check (char_length(email) <= 254),
  bio         text check (char_length(bio) <= 2000),
  provider    text not null default 'form',          -- form | google | twitter | github ...
  user_id     uuid unique references auth.users (id) on delete set null
);
alter table public.members enable row level security;
revoke all on public.members from anon, authenticated;

-- Join (or, for a signed-in member, update their own entry).
-- Anyone may add a new email. Only a signed-in user whose provider verified that same email may change an existing entry,
-- so a form submission can never overwrite someone else's details.
create or replace function public.join_collective(p_name text, p_email text, p_bio text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  jwt_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  e text := lower(trim(coalesce(jwt_email, p_email)));
  n text := trim(p_name);
  b text := nullif(trim(p_bio), '');
  prov text := coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', 'form');
  verified boolean := uid is not null and jwt_email is not null;
  existing public.members;
begin
  if n is null or char_length(n) < 1 or char_length(n) > 120 then raise exception 'Please add your name.' using errcode = '22023'; end if;
  if e is null or e !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(e) > 254 then raise exception 'Please add a valid email.' using errcode = '22023'; end if;
  if b is not null and char_length(b) > 2000 then raise exception 'Please keep the note under 2000 characters.' using errcode = '22023'; end if;
  if prov = 'email' then prov := 'form'; end if;
  select * into existing from public.members where email = e;
  if not found then
    insert into public.members (name, email, bio, provider, user_id) values (n, e, b, prov, case when verified then uid end);
    return 'joined';
  end if;
  if verified and (existing.user_id is null or existing.user_id = uid) then
    update public.members set name = n, bio = coalesce(b, existing.bio), user_id = uid, provider = prov, updated_at = now() where id = existing.id;
    return 'updated';
  end if;
  return 'already';
end $$;
revoke all on function public.join_collective(text, text, text) from public;
grant execute on function public.join_collective(text, text, text) to anon, authenticated;

-- A signed-in member can read back their own entry (to prefill the form).
create or replace function public.my_membership()
returns table (name text, email text, bio text) language sql security definer set search_path = public stable as $$
  select m.name, m.email, m.bio from public.members m where auth.uid() is not null and m.user_id = auth.uid();
$$;
revoke all on function public.my_membership() from public;
grant execute on function public.my_membership() to authenticated;
