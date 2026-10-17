-- DESTRUCTIVE: only for an explicitly disposable LOCAL InstituteOS database.
-- Do not run against production or any shared/remote project.
-- Prerequisites: local target confirmed independently, backups unnecessary by design,
-- and no objects in avatars/documents buckets. This leaves bucket definitions and files alone.
-- To opt in, set both transaction-local values below after verifying the target is local.
-- If it fails, stop and send the exact error. No CASCADE is used; dependency errors stop cleanup.
begin;
-- Uncomment only after independently verifying a disposable local database:
-- set local app.instituteos_cleanup_confirm = 'drop-instituteos-local-only';
-- set local app.instituteos_cleanup_target = '127.0.0.1';

do $guard$
begin
  if current_setting('app.instituteos_cleanup_confirm', true) is distinct from 'drop-instituteos-local-only'
     or current_setting('app.instituteos_cleanup_target', true) is distinct from '127.0.0.1' then
    raise exception 'Cleanup opt-in missing: confirm a disposable local target and uncomment both SET LOCAL lines';
  end if;
  if exists (select 1 from storage.objects where bucket_id in ('avatars','documents')) then
    raise exception 'Cleanup stopped: avatars/documents contain objects; protect those files and review manually';
  end if;
end;
$guard$;

drop policy if exists "avatars: public read" on storage.objects;
drop policy if exists "avatars: authenticated upload" on storage.objects;
drop policy if exists "avatars: own upload" on storage.objects;
drop policy if exists "documents: auth read" on storage.objects;
drop policy if exists "documents: auth upload" on storage.objects;
drop policy if exists "documents: scoped read" on storage.objects;
drop policy if exists "documents: scoped upload" on storage.objects;
drop policy if exists "documents: tenant read" on storage.objects;
drop policy if exists "documents: tenant upload" on storage.objects;

drop view if exists public.student_profiles;
drop view if exists public.trainer_students;
drop view if exists public.account_students;
drop view if exists public.counselor_fee_summary;
drop view if exists public.course_catalog;
drop view if exists public.course_finance;

drop table if exists public.audit_log;
drop table if exists public.approvals;
drop table if exists public.recordings;
drop table if exists public.payments;
drop table if exists public.instalments;
drop table if exists public.fee_plans;
drop table if exists public.submissions;
drop table if exists public.assignments;
drop table if exists public.attendance;
drop table if exists public.sessions;
drop table if exists public.students;
drop table if exists public.batches;
drop table if exists public.rooms;
drop table if exists public.trainer_availability;
drop table if exists public.trainers;
drop table if exists public.courses;
drop table if exists public.institute_members;
drop table if exists public.users;
drop table if exists public.institutes;

drop function if exists public.record_payment_for_user(text,text,text,numeric,text,text,text,uuid,text);
drop function if exists public.record_payment(text,text,text,numeric,text,text,text);
drop function if exists public.get_dashboard_telemetry();
drop function if exists public.prevent_trainer_relationship_changes();
drop function if exists public.enforce_attendance_batch_match();
drop function if exists public.attendance_matches_session_batch(text,text,text);
drop function if exists public.is_active_trainer_auth_user(uuid,text);
drop function if exists public.trainer_owns_batch(text);
drop function if exists public.institute_role();
drop function if exists public.current_institute_id();
drop function if exists public.current_user_context();

-- Deliberately does not drop public.copilet, storage buckets/objects, auth.users,
-- extensions, schemas, or any object outside the InstituteOS relations listed above.
commit;