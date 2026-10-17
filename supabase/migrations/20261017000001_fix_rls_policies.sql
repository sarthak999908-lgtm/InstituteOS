-- ==============================================================================
-- InstituteOS — Corrected RLS Policies (fixes Issue 1-3 from audit)
-- Run AFTER the base migration: 20261017000000_instituteos_complete_schema.sql
-- ==============================================================================
-- This file replaces the flawed "or true" policies with proper role-scoped ones.
-- No tables are dropped. No data is modified.
-- ==============================================================================

begin;

-- ── Drop all flawed policies from the base migration ──────────────────────────

-- Students (was: "or true" allows anon writes)
-- These legacy policy names are created by the base migration.
drop policy if exists "Allow read on catalog" on public.courses;
drop policy if exists "Allow read on rooms" on public.rooms;
drop policy if exists "Allow read on trainers" on public.trainers;
drop policy if exists "Allow read on users" on public.users;

-- Students (was: "or true" allows anon writes)
drop policy if exists students_owner on public.students;

-- Batches
drop policy if exists batches_read on public.batches;

-- Sessions
drop policy if exists sessions_read on public.sessions;

-- Attendance
drop policy if exists attendance_read on public.attendance;

-- Financial tables
drop policy if exists fee_plans_read on public.fee_plans;
drop policy if exists instalments_read on public.instalments;
drop policy if exists payments_read on public.payments;
-- The base migration's FOR ALL policies would OR with the scoped policies below,
-- retaining delete access that this migration intentionally does not grant.
drop policy if exists "fee_plans: finance only" on public.fee_plans;
drop policy if exists "instalments: finance only" on public.instalments;

-- The base policy also granted update/delete beyond this migration's insert grant.
drop policy if exists "availability: owner write" on public.trainer_availability;

-- Approvals & audit
drop policy if exists approvals_read on public.approvals;
drop policy if exists audit_log_read on public.audit_log;

-- Make this migration safe after the schema file has already created the same
-- named policies. Only policies owned by this migration are replaced.
drop policy if exists "institutes: authenticated read" on public.institutes;
drop policy if exists "students: authenticated read" on public.students;
drop policy if exists "students: owner/counselor insert" on public.students;
drop policy if exists "students: owner/counselor update" on public.students;
drop policy if exists "students: owner delete" on public.students;
drop policy if exists "batches: authenticated read" on public.batches;
drop policy if exists "batches: owner/counselor write" on public.batches;
drop policy if exists "batches: owner/counselor update" on public.batches;
drop policy if exists "batches: owner delete" on public.batches;
drop policy if exists "sessions: authenticated read" on public.sessions;
drop policy if exists "sessions: trainer/owner write" on public.sessions;
drop policy if exists "sessions: trainer/owner update" on public.sessions;
drop policy if exists "attendance: authenticated read" on public.attendance;
drop policy if exists "attendance: trainer/owner insert" on public.attendance;
drop policy if exists "attendance: trainer/owner update" on public.attendance;
drop policy if exists "fee_plans: finance read" on public.fee_plans;
drop policy if exists "fee_plans: owner/accounts write" on public.fee_plans;
drop policy if exists "fee_plans: owner/accounts update" on public.fee_plans;
drop policy if exists "instalments: finance read" on public.instalments;
drop policy if exists "instalments: owner/accounts write" on public.instalments;
drop policy if exists "instalments: owner/accounts update" on public.instalments;
drop policy if exists "payments: finance read" on public.payments;
drop policy if exists "payments: owner/accounts insert" on public.payments;
drop policy if exists "assignments: authenticated read" on public.assignments;
drop policy if exists "assignments: trainer/owner write" on public.assignments;
drop policy if exists "submissions: authenticated read" on public.submissions;
drop policy if exists "recordings: authenticated read" on public.recordings;
drop policy if exists "recordings: trainer/owner insert" on public.recordings;
drop policy if exists "trainer_availability: authenticated read" on public.trainer_availability;
drop policy if exists "trainer_availability: owner write" on public.trainer_availability;
drop policy if exists "approvals: authenticated read" on public.approvals;
drop policy if exists "approvals: any authenticated can request" on public.approvals;
drop policy if exists "approvals: owner decide" on public.approvals;
drop policy if exists "audit_log: owner read" on public.audit_log;
drop policy if exists "audit: server append" on public.audit_log;
drop policy if exists "audit_log: authenticated append" on public.audit_log;

-- ── Enable RLS on institutes (missed in base migration) ───────────────────────
alter table public.institutes enable row level security;

-- ── Institutes: only authenticated users can read ─────────────────────────────
create policy "institutes: authenticated read"
  on public.institutes for select
  to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'trainer', 'accounts'));

-- ── Students ──────────────────────────────────────────────────────────────────
-- READ: authenticated users only (role filtering done in app layer)
create policy "students: authenticated read"
  on public.students for select
  to authenticated
  using (
    public.institute_role() in ('owner', 'counselor', 'accounts')
    or (public.institute_role() = 'trainer' and public.trainer_owns_batch(batch_id))
  );

-- INSERT: only owner & counselor
create policy "students: owner/counselor insert"
  on public.students for insert
  to authenticated
  with check (public.institute_role() in ('owner', 'counselor'));

-- UPDATE: only owner & counselor
create policy "students: owner/counselor update"
  on public.students for update
  to authenticated
  using (public.institute_role() in ('owner', 'counselor'))
  with check (public.institute_role() in ('owner', 'counselor'));

-- DELETE: only owner
create policy "students: owner delete"
  on public.students for delete
  to authenticated
  using (public.institute_role() = 'owner');

-- ── Batches ───────────────────────────────────────────────────────────────────
create policy "batches: authenticated read"
  on public.batches for select
  to authenticated
  using (
    public.institute_role() in ('owner', 'counselor', 'accounts')
    or (public.institute_role() = 'trainer' and public.trainer_owns_batch(id))
  );

create policy "batches: owner/counselor write"
  on public.batches for insert
  to authenticated
  with check (public.institute_role() in ('owner', 'counselor'));

create policy "batches: owner/counselor update"
  on public.batches for update
  to authenticated
  using (public.institute_role() in ('owner', 'counselor'))
  with check (public.institute_role() in ('owner', 'counselor'));

create policy "batches: owner delete"
  on public.batches for delete
  to authenticated
  using (public.institute_role() = 'owner');

-- ── Sessions (timetable) ──────────────────────────────────────────────────────
create policy "sessions: authenticated read"
  on public.sessions for select
  to authenticated
  using (
    public.institute_role() in ('owner', 'counselor', 'accounts')
    or (public.institute_role() = 'trainer' and public.trainer_owns_batch(batch_id))
  );

-- Trainers can only see sessions for their own batches; owners see all
create policy "sessions: trainer/owner write"
  on public.sessions for insert
  to authenticated
  with check (
    public.institute_role() in ('owner', 'counselor')
    or public.trainer_owns_batch(batch_id)
  );

create policy "sessions: trainer/owner update"
  on public.sessions for update
  to authenticated
  using (
    public.institute_role() in ('owner', 'counselor')
    or public.trainer_owns_batch(batch_id)
  )
  with check (
    public.institute_role() in ('owner', 'counselor')
    or public.trainer_owns_batch(batch_id)
  );

-- ── Attendance ────────────────────────────────────────────────────────────────
create policy "attendance: authenticated read"
  on public.attendance for select
  to authenticated
  using (
    public.institute_role() in ('owner', 'counselor', 'accounts')
    or exists (
      select 1 from public.sessions s
      where s.id = session_id and public.institute_role() = 'trainer'
        and public.trainer_owns_batch(s.batch_id)
    )
  );

-- Trainers can mark attendance for their batches; owners can mark for all
create policy "attendance: trainer/owner insert"
  on public.attendance for insert
  to authenticated
  with check (
    public.institute_role() in ('owner', 'counselor')
    or exists (
      select 1 from public.sessions s
      where s.id = session_id
        and public.trainer_owns_batch(s.batch_id)
    )
  );

create policy "attendance: trainer/owner update"
  on public.attendance for update
  to authenticated
  using (
    public.institute_role() in ('owner', 'counselor')
    or exists (
      select 1 from public.sessions s
      where s.id = session_id
        and public.trainer_owns_batch(s.batch_id)
    )
  )
  with check (
    public.institute_role() in ('owner', 'counselor')
    or exists (
      select 1 from public.sessions s
      where s.id = session_id
        and public.trainer_owns_batch(s.batch_id)
    )
  );

-- ── Fee Plans — owner & accounts only ────────────────────────────────────────
create policy "fee_plans: finance read"
  on public.fee_plans for select
  to authenticated
  using (public.institute_role() in ('owner', 'accounts'));

create policy "fee_plans: owner/accounts write"
  on public.fee_plans for insert
  to authenticated
  with check (public.institute_role() in ('owner', 'accounts'));

create policy "fee_plans: owner/accounts update"
  on public.fee_plans for update
  to authenticated
  using (public.institute_role() in ('owner', 'accounts'))
  with check (public.institute_role() in ('owner', 'accounts'));

-- ── Instalments ───────────────────────────────────────────────────────────────
create policy "instalments: finance read"
  on public.instalments for select
  to authenticated
  using (public.institute_role() in ('owner', 'accounts'));

create policy "instalments: owner/accounts write"
  on public.instalments for insert
  to authenticated
  with check (public.institute_role() in ('owner', 'accounts'));

create policy "instalments: owner/accounts update"
  on public.instalments for update
  to authenticated
  using (public.institute_role() in ('owner', 'accounts'))
  with check (public.institute_role() in ('owner', 'accounts'));

-- ── Payments ─────────────────────────────────────────────────────────────────
create policy "payments: finance read"
  on public.payments for select
  to authenticated
  using (public.institute_role() in ('owner', 'accounts'));

create policy "payments: owner/accounts insert"
  on public.payments for insert
  to authenticated
  with check (public.institute_role() in ('owner', 'accounts'));

-- Payments are never updated or deleted (append-only ledger)

-- ── Assignments & Submissions (were completely blocked) ───────────────────────
create policy "assignments: authenticated read"
  on public.assignments for select
  to authenticated
  using (
    public.institute_role() in ('owner', 'counselor', 'accounts')
    or (public.institute_role() = 'trainer' and public.trainer_owns_batch(batch_id))
  );

create policy "assignments: trainer/owner write"
  on public.assignments for insert
  to authenticated
  with check (
    public.institute_role() in ('owner', 'counselor')
    or public.trainer_owns_batch(batch_id)
  );

create policy "submissions: authenticated read"
  on public.submissions for select
  to authenticated
  using (
    public.institute_role() in ('owner', 'counselor', 'accounts')
    or exists (
      select 1 from public.assignments a
      where a.id = assignment_id and public.institute_role() = 'trainer'
        and public.trainer_owns_batch(a.batch_id)
    )
  );

-- ── Recordings (were completely blocked) ─────────────────────────────────────
create policy "recordings: authenticated read"
  on public.recordings for select
  to authenticated
  using (
    public.institute_role() in ('owner', 'counselor', 'accounts')
    or exists (
      select 1 from public.sessions s
      where s.id = session_id and public.institute_role() = 'trainer'
        and public.trainer_owns_batch(s.batch_id)
    )
  );

create policy "recordings: trainer/owner insert"
  on public.recordings for insert
  to authenticated
  with check (
    public.institute_role() in ('owner', 'counselor')
    or exists (
      select 1 from public.sessions s
      where s.id = session_id
        and public.trainer_owns_batch(s.batch_id)
    )
  );

-- ── Trainer Availability (were completely blocked) ────────────────────────────
create policy "trainer_availability: authenticated read"
  on public.trainer_availability for select
  to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'trainer', 'accounts'));

create policy "trainer_availability: owner write"
  on public.trainer_availability for insert
  to authenticated
  with check (public.institute_role() = 'owner');

-- ── Approvals ─────────────────────────────────────────────────────────────────
create policy "approvals: authenticated read"
  on public.approvals for select
  to authenticated
  using (
    public.institute_role() = 'owner'
    or (public.institute_role() = 'accounts' and kind in ('fee_reconciliation', 'fee_action'))
    or requested_by::text = auth.uid()::text
  );

create policy "approvals: any authenticated can request"
  on public.approvals for insert
  to authenticated
  with check (
    requested_by::text = auth.uid()::text
    and (
      public.institute_role() in ('owner', 'counselor')
      or (public.institute_role() = 'trainer' and kind like 'attendance_%')
      or (public.institute_role() = 'accounts' and kind in ('fee_reconciliation', 'fee_action'))
    )
  );

-- Only owner can approve/reject
create policy "approvals: owner decide"
  on public.approvals for update
  to authenticated
  using (public.institute_role() = 'owner')
  with check (public.institute_role() = 'owner');

-- ── Audit Log ─────────────────────────────────────────────────────────────────
-- Reads are owner-only. Audit writes are intentionally unavailable to direct
-- browser clients; only a separately authorized server-side operation may append.
create policy "audit_log: owner read"
  on public.audit_log for select
  to authenticated
  using (public.institute_role() = 'owner');

-- No browser role may append audit records. A trusted backend writer is not
-- implemented yet; keep INSERT unavailable until one is added.
revoke insert on public.audit_log from anon, authenticated;

-- Audit log rows are never updated or deleted

commit;
