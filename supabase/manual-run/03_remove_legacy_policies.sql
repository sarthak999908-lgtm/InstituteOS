-- InstituteOS manual SQL Editor step: legacy policy removal and role views
-- Source file: supabase/migrations/20261017000002_remove_legacy_permissive_policies.sql
-- Prerequisites: 02_fix_rls.sql committed successfully
-- Check: 03_verify_readonly.sql confirms all expected views and preserved columns
-- If this step fails, stop and send the exact error before continuing.
-- BEGIN EXACT SOURCE CONTENT
-- InstituteOS security hardening.
-- This migration is intentionally prepared only. Review and explicitly approve
-- before applying it to any Supabase project.

-- Earlier schema policies granted broad access (including anon) with FOR ALL.
-- PostgreSQL combines permissive policies with OR, so narrower policies added
-- later do not restrict those older grants until they are removed.
begin;

drop policy if exists "Allow read on users" on public.users;
drop policy if exists "Allow read on catalog" on public.courses;
drop policy if exists "Allow read on rooms" on public.rooms;
drop policy if exists "Allow read on trainers" on public.trainers;
drop policy if exists batches_read on public.batches;
drop policy if exists sessions_read on public.sessions;
drop policy if exists attendance_read on public.attendance;
drop policy if exists fee_plans_read on public.fee_plans;
drop policy if exists instalments_read on public.instalments;
drop policy if exists payments_read on public.payments;
drop policy if exists approvals_read on public.approvals;
drop policy if exists audit_log_read on public.audit_log;

alter table public.users enable row level security;
alter table public.students enable row level security;
alter table public.institute_members enable row level security;
revoke all on table public.institute_members from anon, authenticated;

drop policy if exists "users: owner or self read" on public.users;
create policy "users: owner or self read"
  on public.users for select to authenticated
  using (
    public.institute_role() = 'owner'
    or lower(email) = lower(auth.jwt() ->> 'email')
  );

-- The account role receives only the identifiers and names needed for finance.
-- Owners and counselors use a read-only role-filtered view for full profiles.
revoke select on table public.students from anon, authenticated;
grant select (id, name) on table public.students to authenticated;
create or replace view public.student_profiles
with (security_barrier = true)
as select s.id, s.name, s.phone, s.email, s.batch_id, s.status, s.joined_on,
          s.course_id, c.name as course_name, s.batch_name
from public.students s
left join public.courses c on c.id = s.course_id
where public.institute_role() in ('owner', 'counselor');
grant select on public.student_profiles to authenticated;

create or replace view public.trainer_students
with (security_barrier = true)
as select s.id, s.name, s.batch_id, s.status, s.batch_name
from public.students s
where public.institute_role() = 'trainer'
  and public.trainer_owns_batch(s.batch_id);
grant select on public.trainer_students to authenticated;

create or replace view public.account_students
with (security_barrier = true)
as select s.id, s.name
from public.students s
where public.institute_role() = 'accounts';
grant select on public.account_students to authenticated;

create or replace view public.counselor_fee_summary
with (security_barrier = true)
as select c.name as course_name, i.status, i.due_date,
       count(i.id)::integer as instalment_count,
       sum(greatest(i.amount - i.paid_amount, 0)) as amount_due
from public.instalments i
join public.students s on s.id = i.student_id
join public.courses c on c.id = s.course_id
where public.institute_role() = 'counselor'
group by c.name, i.status, i.due_date;
grant select on public.counselor_fee_summary to authenticated;

-- Course fee totals are financial data. Do not grant them through the public
-- catalog table, where column access cannot vary by a JWT role claim.
revoke select on table public.courses from anon, authenticated;
grant select (id, name, duration_weeks, created_at) on table public.courses to authenticated;

drop policy if exists "courses: authenticated catalog read" on public.courses;
create policy "courses: authenticated catalog read"
  on public.courses for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'trainer', 'accounts'));

create or replace view public.course_catalog
with (security_invoker = true)
as select id, name, duration_weeks, created_at from public.courses;
grant select on public.course_catalog to authenticated;

create or replace view public.course_finance
with (security_barrier = true)
as select id, name, fee_total from public.courses
where public.institute_role() in ('owner', 'accounts');
grant select on public.course_finance to authenticated;

-- Only protected backend actions may create audit entries.
drop policy if exists "audit: server append" on public.audit_log;
drop policy if exists "audit_log: authenticated append" on public.audit_log;
drop policy if exists audit_insert_authenticated on public.audit_log;
revoke insert on public.audit_log from anon, authenticated;

-- Private student documents: restrict access to Owners/Counselors and Trainers
-- assigned to the student's batch; trainers cannot access ID-proof documents.
drop policy if exists "documents: auth read" on storage.objects;
drop policy if exists "documents: auth upload" on storage.objects;
drop policy if exists "documents: scoped read" on storage.objects;
drop policy if exists "documents: scoped upload" on storage.objects;
create policy "documents: scoped read" on storage.objects
  for select to authenticated using (
    bucket_id = 'documents'
    and (
      public.institute_role() in ('owner', 'counselor')
      or (
        public.institute_role() = 'trainer'
        and coalesce((storage.foldername(name))[2], '') <> 'id_proof'
        and exists (
          select 1 from public.students s
          where s.id = (storage.foldername(name))[1]
            and public.trainer_owns_batch(s.batch_id)
        )
      )
    )
  );
create policy "documents: scoped upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'documents'
    and (
      public.institute_role() in ('owner', 'counselor')
      or (
        public.institute_role() = 'trainer'
        and coalesce((storage.foldername(name))[2], '') <> 'id_proof'
        and exists (
          select 1 from public.students s
          where s.id = (storage.foldername(name))[1]
            and public.trainer_owns_batch(s.batch_id)
        )
      )
    )
  );

-- Approval payloads can include private or financial details. Staff can see
-- only their own proposals, while owner/accounts can see their authorized set.
drop policy if exists "approvals: authenticated read" on public.approvals;
drop policy if exists "approvals: any authenticated can request" on public.approvals;
drop policy if exists "approvals: owner decide" on public.approvals;
drop policy if exists "approvals: scoped read" on public.approvals;
drop policy if exists "approvals: permitted requests" on public.approvals;
drop policy if exists "approvals: authorized decisions" on public.approvals;
drop policy if exists approvals_owner_accounts on public.approvals;
create policy "approvals: scoped read"
  on public.approvals for select to authenticated
  using (
    public.institute_role() = 'owner'
    or (public.institute_role() = 'accounts' and kind in ('fee_reconciliation', 'fee_action'))
    or requested_by::text = auth.uid()::text
  );
create policy "approvals: permitted requests"
  on public.approvals for insert to authenticated
  with check (
    requested_by::text = auth.uid()::text
    and (
      public.institute_role() in ('owner', 'counselor')
      or (public.institute_role() = 'trainer' and kind like 'attendance_%')
      or (public.institute_role() = 'accounts' and kind in ('fee_reconciliation', 'fee_action'))
    )
  );
create policy "approvals: authorized decisions"
  on public.approvals for update to authenticated
  using (
    public.institute_role() = 'owner'
    or (public.institute_role() = 'accounts' and kind in ('fee_reconciliation', 'fee_action'))
  )
  with check (
    public.institute_role() = 'owner'
    or (public.institute_role() = 'accounts' and kind in ('fee_reconciliation', 'fee_action'))
  );

-- This legacy SECURITY DEFINER RPC returns student and financial aggregates.
-- The protected backend no longer needs it, so disable browser/API execution.
revoke all on function public.get_dashboard_telemetry() from public, anon, authenticated;

commit;
