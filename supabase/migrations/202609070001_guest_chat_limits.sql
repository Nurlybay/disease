-- Run once in Supabase SQL Editor before deploying the guest function.
-- No existing clinical tables or policies are changed.
begin;
create schema if not exists patient_chat_private;
revoke all on schema patient_chat_private from public, anon, authenticated;
create table if not exists patient_chat_private.budget (
  id integer primary key check (id = 1),
  enabled boolean not null default true,
  day date not null default (now() at time zone 'UTC')::date,
  day_count integer not null default 0,
  total_count integer not null default 0,
  daily_limit integer not null default 200 check (daily_limit >= 0),
  total_limit integer not null default 2000 check (total_limit >= 0),
  guest_daily_limit integer not null default 30 check (guest_daily_limit >= 0),
  guest_minute_limit integer not null default 6 check (guest_minute_limit >= 0)
);
insert into patient_chat_private.budget(id) values (1) on conflict do nothing;
create table if not exists patient_chat_private.guests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  day date not null,
  day_count integer not null default 0,
  minute timestamptz not null,
  minute_count integer not null default 0
);
alter table patient_chat_private.budget enable row level security;
alter table patient_chat_private.guests enable row level security;
revoke all on all tables in schema patient_chat_private from public, anon, authenticated;

create or replace function public.reserve_patient_chat_request()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'UTC')::date;
  minute_now timestamptz := date_trunc('minute', now());
  b patient_chat_private.budget%rowtype;
  g patient_chat_private.guests%rowtype;
begin
  if uid is null then return jsonb_build_object('allowed', false, 'error', 'guest_required'); end if;
  -- One row lock serializes quota reservations across all function instances.
  select * into b from patient_chat_private.budget where id=1 for update;
  if not found or not b.enabled then return jsonb_build_object('allowed',false,'error','chat_disabled'); end if;
  if b.day <> today then b.day_count := 0; end if;
  if b.total_count >= b.total_limit then return jsonb_build_object('allowed',false,'error','total_limit'); end if;
  if b.day_count >= b.daily_limit then return jsonb_build_object('allowed',false,'error','global_daily_limit'); end if;
  insert into patient_chat_private.guests(user_id, day, minute) values(uid, today, minute_now) on conflict do nothing;
  select * into g from patient_chat_private.guests where user_id=uid for update;
  if g.day <> today then g.day_count := 0; end if;
  if g.minute <> minute_now then g.minute_count := 0; end if;
  if g.day_count >= b.guest_daily_limit then return jsonb_build_object('allowed',false,'error','guest_daily_limit'); end if;
  if g.minute_count >= b.guest_minute_limit then return jsonb_build_object('allowed',false,'error','guest_rate_limit'); end if;
  update patient_chat_private.budget set day=today, day_count=b.day_count+1, total_count=b.total_count+1 where id=1;
  update patient_chat_private.guests set day=today, day_count=g.day_count+1, minute=minute_now, minute_count=g.minute_count+1 where user_id=uid;
  return jsonb_build_object('allowed',true);
end;
$$;
revoke all on function public.reserve_patient_chat_request() from public, anon;
grant execute on function public.reserve_patient_chat_request() to authenticated;
commit;
