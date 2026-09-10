-- Reference images are selected from the authenticated teacher's own library.
alter table public.teacher_media_jobs add column if not exists context jsonb not null default '{}'::jsonb;
