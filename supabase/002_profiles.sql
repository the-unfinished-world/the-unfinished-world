-- 002: sign-in only (Google / GitHub), editable profiles, opt-in People list, profile pictures.
alter table public.members
  add column if not exists work        text check (char_length(work) <= 160),
  add column if not exists interests   text check (char_length(interests) <= 300),
  add column if not exists avatar_kind text not null default 'figure' check (avatar_kind in ('figure', 'photo')),
  add column if not exists figure      text not null default 'male' check (figure in ('male', 'female')),
  add column if not exists avatar_url  text check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 500)),
  add column if not exists listed      boolean not null default false;

-- the open form is gone: joining now requires a signed-in account
drop function if exists public.join_collective(text, text, text);
drop function if exists public.my_membership();

-- Signed-in user's own profile. Also finds an older form sign-up with the same verified email, so it can be claimed.
create or replace function public.my_profile()
returns table (name text, work text, bio text, interests text, avatar_kind text, figure text, avatar_url text, listed boolean)
language sql security definer set search_path = public stable as $$
  select m.name, m.work, m.bio, m.interests, m.avatar_kind, m.figure, m.avatar_url, m.listed
  from public.members m
  where auth.uid() is not null
    and (m.user_id = auth.uid()
         or (m.user_id is null and m.email = lower(nullif(auth.jwt() ->> 'email', ''))))
  order by (m.user_id = auth.uid()) desc nulls last limit 1;
$$;

create or replace function public.save_profile(
  p_name text, p_work text, p_bio text, p_interests text,
  p_avatar_kind text, p_figure text, p_avatar_url text, p_listed boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  e text := lower(nullif(auth.jwt() ->> 'email', ''));
  prov text := coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', 'unknown');
  n text := nullif(trim(p_name), '');
  row_id uuid;
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if e is null then raise exception 'Your account has no email address we can use.' using errcode = '22023'; end if;
  if n is null or char_length(n) > 120 then raise exception 'Please add your name.' using errcode = '22023'; end if;
  select id into row_id from public.members where user_id = uid;
  if row_id is null then select id into row_id from public.members where user_id is null and email = e; end if;
  if row_id is null then
    insert into public.members (name, email, work, bio, interests, avatar_kind, figure, avatar_url, listed, provider, user_id)
    values (n, e, nullif(trim(p_work), ''), nullif(trim(p_bio), ''), nullif(trim(p_interests), ''),
            coalesce(p_avatar_kind, 'figure'), coalesce(p_figure, 'male'), nullif(trim(p_avatar_url), ''), coalesce(p_listed, false), prov, uid);
    return 'joined';
  end if;
  update public.members set
    name = n, work = nullif(trim(p_work), ''), bio = nullif(trim(p_bio), ''), interests = nullif(trim(p_interests), ''),
    avatar_kind = coalesce(p_avatar_kind, 'figure'), figure = coalesce(p_figure, 'male'), avatar_url = nullif(trim(p_avatar_url), ''),
    listed = coalesce(p_listed, false), user_id = uid, provider = prov, updated_at = now()
  where id = row_id;
  return 'saved';
end $$;

-- Public: only people who chose to be listed, and never their email.
create or replace function public.people()
returns table (name text, work text, bio text, interests text, avatar_kind text, figure text, avatar_url text)
language sql security definer set search_path = public stable as $$
  select name, work, bio, interests, avatar_kind, figure, avatar_url from public.members where listed order by created_at;
$$;

revoke all on function public.my_profile(), public.save_profile(text, text, text, text, text, text, text, boolean), public.people() from public;
grant execute on function public.my_profile(), public.save_profile(text, text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.people() to anon, authenticated;

-- Profile pictures: public to read, each person writes only inside a folder named after their user id. 2 MB, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];
drop policy if exists "avatars own insert" on storage.objects;
drop policy if exists "avatars own update" on storage.objects;
drop policy if exists "avatars own delete" on storage.objects;
drop policy if exists "avatars own select" on storage.objects;
create policy "avatars own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
-- replacing a photo (upsert) also needs read access to your own folder
create policy "avatars own select" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
