-- Published custom scenarios require a confirmed, non-anonymous account.
begin;
drop policy if exists "public read" on public.cases;
drop policy if exists "registered read" on public.cases;
create policy "registered read" on public.cases for select to authenticated
using ((auth.jwt()->>'is_anonymous')::boolean is false);
commit;
