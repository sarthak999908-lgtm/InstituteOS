-- pgTAP runtime check for null auth.uid()/no membership. No Auth rows are created.
-- Run via `supabase test db` on a disposable local Supabase database after migrations.
begin;
set local search_path = public, extensions, storage, pg_catalog;
select no_plan();
set local request.jwt.claims = '{}';
set local role authenticated;

select is((select count(*) from public.current_user_context()),0::bigint,
  'no verified profile or membership exists without an Auth subject');
select ok(public.current_institute_id() is null and public.institute_role() is null
  and not public.trainer_owns_batch('IOS-NULL-AUTH-BATCH'),
  'null auth.uid() cannot select a tenant, role, or trainer batch');
select ok(
  not exists(select 1 from public.institutes)
  and not exists(select 1 from public.users)
  and not exists(select 1 from public.courses)
  and not exists(select 1 from public.trainers)
  and not exists(select 1 from public.trainer_availability)
  and not exists(select 1 from public.rooms)
  and not exists(select 1 from public.batches)
  and not exists(select 1 from public.students)
  and not exists(select 1 from public.sessions)
  and not exists(select 1 from public.attendance)
  and not exists(select 1 from public.assignments)
  and not exists(select 1 from public.submissions)
  and not exists(select 1 from public.fee_plans)
  and not exists(select 1 from public.instalments)
  and not exists(select 1 from public.payments)
  and not exists(select 1 from public.recordings)
  and not exists(select 1 from public.approvals)
  and not exists(select 1 from public.audit_log),
  'no membership exposes no InstituteOS tenant rows');
select ok(
  not exists(select 1 from public.student_profiles)
  and not exists(select 1 from public.trainer_students)
  and not exists(select 1 from public.account_students)
  and not exists(select 1 from public.counselor_fee_summary)
  and not exists(select 1 from public.course_catalog)
  and not exists(select 1 from public.course_finance),
  'no membership exposes no role-view rows');
select ok(not has_function_privilege('anon','public.current_user_context()','EXECUTE')
  and not has_function_privilege('anon','public.trainer_owns_batch(text)','EXECUTE')
  and not has_function_privilege('authenticated','public.get_dashboard_telemetry()','EXECUTE'),
  'browser helper execution remains restricted');

reset role;
set local role anon;
select throws_ok('select * from public.audit_log','42501',null,
  'anonymous cannot read the private audit log');
select throws_ok($q$insert into public.audit_log(id,event) values ('IOS-NULL-AUTH-AUDIT','anonymous')$q$,'42501',null,
  'anonymous cannot append audit rows');
select finish();
rollback;