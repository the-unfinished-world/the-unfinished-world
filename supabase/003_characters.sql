-- 003: the profile "figure" is now a walker character id from bodies.js (e.g. 'philosopher', 'hoplite', 'walker').
-- Older rows keep 'male' / 'female'; the site maps those to the plain walkers.
-- Run once in the Supabase SQL editor (project tuw-collective).
alter table public.members drop constraint if exists members_figure_check;
alter table public.members add constraint members_figure_check check (figure ~ '^[a-z0-9-]{1,32}$');
