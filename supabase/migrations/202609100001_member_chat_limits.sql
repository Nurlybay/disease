-- Confirmed accounts have a separate quota; preserve counters and guest limits.
begin;
create or replace function public.reserve_patient_chat_request()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  member boolean;
  daily_cap integer;
  minute_cap integer;
  today date := (now() at time zone 'UTC')::date;
  minute_now timestamptz := date_trunc('minute', now());
  b patient_chat_private.budget%rowtype;
  g patient_chat_private.guests%rowtype;
begin
  if uid is null then return jsonb_build_object('allowed', false, 'error', 'guest_required'); end if;
  select not coalesce(is_anonymous,false) and email_confirmed_at is not null into member from auth.users where id=uid;
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
  daily_cap := case when member then 200 else b.guest_daily_limit end;
  minute_cap := case when member then 20 else b.guest_minute_limit end;
  if g.day_count >= daily_cap then return jsonb_build_object('allowed',false,'error',case when member then 'member_daily_limit' else 'guest_daily_limit' end); end if;
  if g.minute_count >= minute_cap then return jsonb_build_object('allowed',false,'error','guest_rate_limit'); end if;
  update patient_chat_private.budget set day=today, day_count=b.day_count+1, total_count=b.total_count+1 where id=1;
  update patient_chat_private.guests set day=today, day_count=g.day_count+1, minute=minute_now, minute_count=g.minute_count+1 where user_id=uid;
  return jsonb_build_object('allowed',true);
end;
$$;
update patient_chat_private.budget set daily_limit=greatest(daily_limit,1000), total_limit=greatest(total_limit,20000) where id=1;
commit;
