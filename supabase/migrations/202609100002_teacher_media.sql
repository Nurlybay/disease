-- Synthetic teaching media; all paid writes go through the authenticated Edge Function.
begin;
create table if not exists public.teacher_media_jobs (
 id uuid primary key,
 owner_id uuid not null references auth.users(id),
 kind text not null check (kind in ('image','video')),
 status text not null default 'queued' check (status in ('queued','running','ready','failed','uncertain')),
 description text not null,
 motion text not null default '',
 parent_id uuid references public.teacher_media_jobs(id),
 image_url text,
 video_url text,
 provider_task_id text,
 usage jsonb,
 error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists teacher_media_owner_created on public.teacher_media_jobs(owner_id, created_at desc);
alter table public.teacher_media_jobs enable row level security;
revoke all on public.teacher_media_jobs from anon, authenticated;
grant all on public.teacher_media_jobs to service_role;

-- Serialize reservations to enforce quotas across tabs, retries and users.
create or replace function public.reserve_teacher_media_job(
 p_id uuid, p_owner uuid, p_kind text, p_description text, p_motion text,
 p_parent uuid, p_user_limit integer, p_global_limit integer
) returns jsonb language plpgsql security definer set search_path = public as $$
declare existing public.teacher_media_jobs; source public.teacher_media_jobs; created public.teacher_media_jobs;
begin
 perform pg_advisory_xact_lock(78210951);
 select * into existing from teacher_media_jobs where id=p_id;
 if found then
   if existing.owner_id <> p_owner then raise exception 'job_conflict'; end if;
   return jsonb_build_object('created',false,'job',to_jsonb(existing));
 end if;
 if (select count(*) from teacher_media_jobs where owner_id=p_owner and created_at > now()-interval '24 hours') >= p_user_limit
 or (select count(*) from teacher_media_jobs where created_at > now()-interval '24 hours') >= p_global_limit then
   raise exception 'daily_limit';
 end if;
 if p_kind='video' then
   select * into source from teacher_media_jobs where id=p_parent and owner_id=p_owner and status='ready';
   if not found or source.image_url is null then raise exception 'image_required'; end if;
 end if;
 insert into teacher_media_jobs(id,owner_id,kind,description,motion,parent_id,image_url)
 values(p_id,p_owner,p_kind,p_description,p_motion,p_parent,source.image_url) returning * into created;
 return jsonb_build_object('created',true,'job',to_jsonb(created));
end $$;
revoke all on function public.reserve_teacher_media_job(uuid,uuid,text,text,text,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_teacher_media_job(uuid,uuid,text,text,text,uuid,integer,integer) to service_role;

-- Only synthetic assets are stored here. Stable public URLs allow case export and playback.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('teaching-media','teaching-media',true,52428800,array['image/png','video/mp4'])
on conflict(id) do nothing;
commit;
