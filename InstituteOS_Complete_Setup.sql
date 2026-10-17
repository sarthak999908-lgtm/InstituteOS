-- BEGIN SOURCE FILE: supabase/migrations/20261017000000_instituteos_complete_schema.sql
-- ==============================================================================
-- InstituteOS — Complete Supabase PostgreSQL Schema & Security Infrastructure
-- ==============================================================================

begin;

-- 1. Enable Required Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. Organizations & Institutes Table
create table if not exists public.institutes (
  id text primary key default 'INST-MAIN',
  name text not null default 'TechSummit Trainers Institute',
  code text unique not null default 'TST-01',
  currency text default 'INR',
  timezone text default 'Asia/Kolkata',
  created_at timestamptz default now()
);

-- 3. Core Users Table
create table if not exists public.users (
  id text primary key,
  institute_id text references public.institutes(id) default 'INST-MAIN',
  name text not null,
  role text not null check (role in ('owner', 'counselor', 'trainer', 'accounts')),
  email text unique not null,
  created_at timestamptz default now()
);

-- 4. Organization Memberships
create table if not exists public.institute_members (
  id uuid primary key default gen_random_uuid(),
  institute_id text not null references public.institutes(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner', 'counselor', 'trainer', 'accounts')),
  created_at timestamptz default now(),
  unique (institute_id, user_id)
);

-- 3. Courses Catalog
create table if not exists public.courses (
  id text primary key,
  name text not null,
  fee_total numeric not null default 0,
  duration_weeks integer not null default 12,
  created_at timestamptz default now()
);

-- 4. Trainers Directory
create table if not exists public.trainers (
  id text primary key,
  name text not null,
  skills text default '',
  weekly_hours_max integer not null default 24,
  created_at timestamptz default now()
);

-- 5. Trainer Availability Slots
create table if not exists public.trainer_availability (
  id uuid primary key default gen_random_uuid(),
  trainer_id text not null references public.trainers(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  start text not null, -- e.g. '09:00'
  "end" text not null, -- e.g. '13:00'
  created_at timestamptz default now()
);

-- 6. Physical Rooms / Labs
create table if not exists public.rooms (
  id text primary key,
  name text not null,
  capacity integer not null default 30,
  created_at timestamptz default now()
);

-- 7. Batches
create table if not exists public.batches (
  id text primary key,
  course_id text references public.courses(id) on delete set null,
  trainer_id text references public.trainers(id) on delete set null,
  name text not null,
  mode text not null default 'classroom' check (mode in ('classroom', 'hybrid', 'online')),
  start_date text not null,
  slot_days text not null, -- JSON string or array, e.g. '[1, 4]'
  slot_start text not null default '10:00',
  slot_end text not null default '12:00',
  room_id text references public.rooms(id) on delete set null,
  online_seat_limit integer default 20,
  student_count integer default 0,
  course_name text default '',
  trainer_name text default '',
  created_at timestamptz default now()
);

-- 8. Students
create table if not exists public.students (
  id text primary key,
  name text not null,
  phone text default '',
  email text default '',
  batch_id text references public.batches(id) on delete set null,
  status text not null default 'Active' check (status in ('Active', 'Pending', 'Inactive', 'Completed')),
  joined_on text default to_char(now(), 'YYYY-MM-DD'),
  course_id text references public.courses(id) on delete set null,
  batch_name text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 9. Sessions (Timetable Instances)
create table if not exists public.sessions (
  id text primary key,
  batch_id text references public.batches(id) on delete cascade,
  date text not null,
  start text not null,
  "end" text not null,
  created_at timestamptz default now()
);

-- 10. Daily Attendance
create table if not exists public.attendance (
  id text primary key,
  student_id text references public.students(id) on delete cascade,
  session_id text references public.sessions(id) on delete cascade,
  mode text default 'classroom',
  checkin_at timestamptz,
  join_at timestamptz,
  leave_at timestamptz,
  status text not null default 'Present' check (status in ('Present', 'Absent', 'Late')),
  created_at timestamptz default now(),
  constraint unique_session_student_attendance unique (session_id, student_id)
);

-- 11. Assignments
create table if not exists public.assignments (
  id text primary key,
  batch_id text references public.batches(id) on delete cascade,
  title text not null,
  due text not null,
  created_at timestamptz default now()
);

-- 12. Student Submissions
create table if not exists public.submissions (
  id text primary key,
  assignment_id text references public.assignments(id) on delete cascade,
  student_id text references public.students(id) on delete cascade,
  submitted_at timestamptz default now(),
  score numeric default 0
);

-- 13. Fee Plans
create table if not exists public.fee_plans (
  id text primary key,
  student_id text references public.students(id) on delete cascade,
  total numeric not null default 0,
  plan_type text default 'standard',
  created_at timestamptz default now()
);

-- 14. Fee Instalments
create table if not exists public.instalments (
  id text primary key,
  student_id text references public.students(id) on delete cascade,
  due_date text not null,
  amount numeric not null default 0,
  paid_amount numeric not null default 0,
  paid_on text,
  status text not null default 'pending' check (status in ('paid', 'pending', 'overdue')),
  created_at timestamptz default now()
);

-- 15. Fee Payments & Bank Transactions
create table if not exists public.payments (
  id text primary key,
  student_id text references public.students(id) on delete set null,
  instalment_id text references public.instalments(id) on delete set null,
  amount numeric not null,
  method text default 'bank_transfer',
  utr text default '',
  received_on text default to_char(now(), 'YYYY-MM-DD'),
  created_at timestamptz default now()
);

-- 16. Lecture Recordings
create table if not exists public.recordings (
  id text primary key,
  session_id text references public.sessions(id) on delete cascade,
  url text not null,
  duration_min integer default 60,
  created_at timestamptz default now()
);

-- 17. Operational Approvals Workflow
create table if not exists public.approvals (
  id text primary key,
  kind text not null, -- 'schedule_replan', 'reconciliation', etc.
  payload jsonb not null default '{}'::jsonb,
  preview text default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by text references public.users(id) on delete set null,
  decided_by text references public.users(id) on delete set null,
  created_at timestamptz default now(),
  decided_at timestamptz
);

-- 18. Audit Log
create table if not exists public.audit_log (
  id text primary key,
  at timestamptz default now(),
  user_id text,
  role text,
  event text not null,
  detail text
);

-- ==============================================================================
-- 19. Role-Based Access Control Functions & RLS Policies
-- ==============================================================================

create or replace function public.institute_role()
returns text
language sql
stable
as $$
  select case
    when auth.jwt() -> 'app_metadata' ->> 'role' in ('owner', 'counselor', 'trainer', 'accounts')
      then auth.jwt() -> 'app_metadata' ->> 'role'
    else ''
  end;
$$;

create or replace function public.trainer_owns_batch(target_batch text)
returns boolean
language sql
stable
set search_path = pg_catalog
as $$
  -- Trainer reads stay closed until migration 0003 installs immutable Auth IDs.
  select false;
$$;
revoke all on function public.trainer_owns_batch(text) from public, anon, authenticated;
    grant execute on function public.trainer_owns_batch(text) to authenticated;

-- Enable RLS across all tables
alter table public.institute_members enable row level security;
revoke all on table public.institute_members from anon, authenticated;
alter table public.users enable row level security;
alter table public.courses enable row level security;
alter table public.trainers enable row level security;
alter table public.trainer_availability enable row level security;
alter table public.rooms enable row level security;
alter table public.batches enable row level security;
alter table public.students enable row level security;
alter table public.attendance enable row level security;
alter table public.sessions enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.fee_plans enable row level security;
alter table public.instalments enable row level security;
alter table public.payments enable row level security;
alter table public.recordings enable row level security;
alter table public.approvals enable row level security;
alter table public.audit_log enable row level security;

-- Fail closed: no anonymous access and no broad policies.
drop policy if exists "catalog: authenticated read" on public.courses;
create policy "catalog: authenticated read" on public.courses for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'trainer', 'accounts'));
drop policy if exists "rooms: authenticated read" on public.rooms;
create policy "rooms: authenticated read" on public.rooms for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'trainer', 'accounts'));
drop policy if exists "trainers: authenticated read" on public.trainers;
create policy "trainers: authenticated read" on public.trainers for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'trainer', 'accounts'));
drop policy if exists "users: owner or self read" on public.users;
create policy "users: owner or self read" on public.users for select to authenticated
  using (public.institute_role() = 'owner' or lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "students: owner counselor read" on public.students;
create policy "students: owner counselor read" on public.students for select to authenticated
  using (public.institute_role() in ('owner', 'counselor'));
drop policy if exists "students: trainer assigned read" on public.students;
create policy "students: trainer assigned read" on public.students for select to authenticated
  using (public.institute_role() = 'trainer' and public.trainer_owns_batch(batch_id));
drop policy if exists "students: accounts name read" on public.students;
create policy "students: accounts name read" on public.students for select to authenticated
  using (public.institute_role() = 'accounts');
drop policy if exists "students: owner counselor insert" on public.students;
create policy "students: owner counselor insert" on public.students for insert to authenticated
  with check (public.institute_role() in ('owner', 'counselor'));
drop policy if exists "students: owner counselor update" on public.students;
create policy "students: owner counselor update" on public.students for update to authenticated
  using (public.institute_role() in ('owner', 'counselor'))
  with check (public.institute_role() in ('owner', 'counselor'));
drop policy if exists "students: owner delete" on public.students;
create policy "students: owner delete" on public.students for delete to authenticated
  using (public.institute_role() = 'owner');

drop policy if exists "batches: scoped read" on public.batches;
create policy "batches: scoped read" on public.batches for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'accounts')
    or (public.institute_role() = 'trainer' and public.trainer_owns_batch(id)));
drop policy if exists "batches: owner counselor write" on public.batches;
create policy "batches: owner counselor write" on public.batches for insert to authenticated
  with check (public.institute_role() in ('owner', 'counselor'));
drop policy if exists "batches: owner counselor update" on public.batches;
create policy "batches: owner counselor update" on public.batches for update to authenticated
  using (public.institute_role() in ('owner', 'counselor'))
  with check (public.institute_role() in ('owner', 'counselor'));
drop policy if exists "batches: owner delete" on public.batches;
create policy "batches: owner delete" on public.batches for delete to authenticated
  using (public.institute_role() = 'owner');

drop policy if exists "sessions: scoped read" on public.sessions;
create policy "sessions: scoped read" on public.sessions for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'accounts')
    or (public.institute_role() = 'trainer' and public.trainer_owns_batch(batch_id)));
drop policy if exists "sessions: owner counselor insert" on public.sessions;
create policy "sessions: owner counselor insert" on public.sessions for insert to authenticated
  with check (public.institute_role() in ('owner', 'counselor'));
drop policy if exists "sessions: owner counselor update" on public.sessions;
create policy "sessions: owner counselor update" on public.sessions for update to authenticated
  using (public.institute_role() in ('owner', 'counselor'))
  with check (public.institute_role() in ('owner', 'counselor'));
drop policy if exists "sessions: owner delete" on public.sessions;
create policy "sessions: owner delete" on public.sessions for delete to authenticated
  using (public.institute_role() = 'owner');

drop policy if exists "attendance: scoped read" on public.attendance;
create policy "attendance: scoped read" on public.attendance for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'accounts') or exists (
    select 1 from public.sessions s where s.id = session_id
      and public.institute_role() = 'trainer' and public.trainer_owns_batch(s.batch_id)
  ));
drop policy if exists "attendance: owner trainer insert" on public.attendance;
create policy "attendance: owner trainer insert" on public.attendance for insert to authenticated
  with check (public.institute_role() = 'owner' or exists (
    select 1 from public.sessions s where s.id = session_id
      and public.institute_role() = 'trainer' and public.trainer_owns_batch(s.batch_id)
  ));
drop policy if exists "attendance: owner trainer update" on public.attendance;
create policy "attendance: owner trainer update" on public.attendance for update to authenticated
  using (public.institute_role() = 'owner' or exists (
    select 1 from public.sessions s where s.id = session_id
      and public.institute_role() = 'trainer' and public.trainer_owns_batch(s.batch_id)
  ))
  with check (public.institute_role() = 'owner' or exists (
    select 1 from public.sessions s where s.id = session_id
      and public.institute_role() = 'trainer' and public.trainer_owns_batch(s.batch_id)
  ));

drop policy if exists "assignments: scoped read" on public.assignments;
create policy "assignments: scoped read" on public.assignments for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'accounts')
    or (public.institute_role() = 'trainer' and public.trainer_owns_batch(batch_id)));
drop policy if exists "assignments: owner trainer write" on public.assignments;
create policy "assignments: owner trainer write" on public.assignments for insert to authenticated
  with check (public.institute_role() = 'owner' or (public.institute_role() = 'trainer' and public.trainer_owns_batch(batch_id)));
drop policy if exists "submissions: scoped read" on public.submissions;
create policy "submissions: scoped read" on public.submissions for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'accounts') or exists (
    select 1 from public.assignments a where a.id = assignment_id
      and public.institute_role() = 'trainer' and public.trainer_owns_batch(a.batch_id)
  ));
drop policy if exists "submissions: owner trainer insert" on public.submissions;
create policy "submissions: owner trainer insert" on public.submissions for insert to authenticated
  with check (public.institute_role() = 'owner' or exists (
    select 1 from public.assignments a where a.id = assignment_id
      and public.institute_role() = 'trainer' and public.trainer_owns_batch(a.batch_id)
  ));

drop policy if exists "recordings: scoped read" on public.recordings;
create policy "recordings: scoped read" on public.recordings for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'accounts') or exists (
    select 1 from public.sessions s where s.id = session_id
      and public.institute_role() = 'trainer' and public.trainer_owns_batch(s.batch_id)
  ));
drop policy if exists "recordings: owner trainer insert" on public.recordings;
create policy "recordings: owner trainer insert" on public.recordings for insert to authenticated
  with check (public.institute_role() = 'owner' or exists (
    select 1 from public.sessions s where s.id = session_id
      and public.institute_role() = 'trainer' and public.trainer_owns_batch(s.batch_id)
  ));

drop policy if exists "availability: authenticated read" on public.trainer_availability;
create policy "availability: authenticated read" on public.trainer_availability for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'trainer', 'accounts'));
drop policy if exists "availability: owner write" on public.trainer_availability;
create policy "availability: owner write" on public.trainer_availability for all to authenticated
  using (public.institute_role() = 'owner') with check (public.institute_role() = 'owner');

drop policy if exists "fee_plans: finance only" on public.fee_plans;
create policy "fee_plans: finance only" on public.fee_plans for all to authenticated
  using (public.institute_role() in ('owner', 'accounts'))
  with check (public.institute_role() in ('owner', 'accounts'));
drop policy if exists "instalments: finance only" on public.instalments;
create policy "instalments: finance only" on public.instalments for all to authenticated
  using (public.institute_role() in ('owner', 'accounts'))
  with check (public.institute_role() in ('owner', 'accounts'));
drop policy if exists "payments: finance read" on public.payments;
create policy "payments: finance read" on public.payments for select to authenticated
  using (public.institute_role() in ('owner', 'accounts'));
drop policy if exists "payments: finance insert" on public.payments;
create policy "payments: finance insert" on public.payments for insert to authenticated
  with check (public.institute_role() in ('owner', 'accounts'));

drop policy if exists "approvals: scoped read" on public.approvals;
create policy "approvals: scoped read" on public.approvals for select to authenticated
  using (public.institute_role() = 'owner'
    or (public.institute_role() = 'accounts' and kind in ('fee_reconciliation', 'fee_action'))
    or requested_by::text = auth.uid()::text);
drop policy if exists "approvals: permitted request" on public.approvals;
create policy "approvals: permitted request" on public.approvals for insert to authenticated
  with check (requested_by::text = auth.uid()::text and (
    public.institute_role() in ('owner', 'counselor')
    or (public.institute_role() = 'trainer' and kind like 'attendance_%')
    or (public.institute_role() = 'accounts' and kind in ('fee_reconciliation', 'fee_action'))
  ));
drop policy if exists "approvals: authorized decide" on public.approvals;
create policy "approvals: authorized decide" on public.approvals for update to authenticated
  using (public.institute_role() = 'owner'
    or (public.institute_role() = 'accounts' and kind in ('fee_reconciliation', 'fee_action')))
  with check (public.institute_role() = 'owner'
    or (public.institute_role() = 'accounts' and kind in ('fee_reconciliation', 'fee_action')));
drop policy if exists "audit: owner read" on public.audit_log;
create policy "audit: owner read" on public.audit_log for select to authenticated
  using (public.institute_role() = 'owner');
-- Audit rows must not be forgeable by browser clients. The final hardening
-- migration grants append-only inserts to the trusted server role only.
revoke insert on public.audit_log from anon, authenticated;

revoke all on public.students from anon, authenticated;
grant select (id, name, batch_id, status, joined_on, course_id, batch_name) on public.students to authenticated;
grant insert (id, name, email, phone, batch_id, status, joined_on, course_id, batch_name) on public.students to authenticated;
grant update (name, email, phone, batch_id, status, joined_on, course_id, batch_name, updated_at) on public.students to authenticated;
revoke all on public.courses from anon, authenticated;
grant select (id, name, duration_weeks, created_at) on public.courses to authenticated;

create or replace view public.student_profiles with (security_barrier = true) as
  select s.id, s.name, s.phone, s.email, s.batch_id, s.status, s.joined_on,
         s.course_id, c.name as course_name, s.batch_name
  from public.students s left join public.courses c on c.id = s.course_id
  where public.institute_role() in ('owner', 'counselor');
create or replace view public.trainer_students with (security_barrier = true) as
  select s.id, s.name, s.batch_id, s.status, s.batch_name
  from public.students s
  where public.institute_role() = 'trainer' and public.trainer_owns_batch(s.batch_id);
create or replace view public.account_students with (security_barrier = true) as
  select s.id, s.name from public.students s where public.institute_role() = 'accounts';
create or replace view public.course_catalog with (security_barrier = true) as
  select id, name, duration_weeks, created_at from public.courses
  where public.institute_role() in ('owner', 'counselor', 'trainer', 'accounts');
create or replace view public.course_finance with (security_barrier = true) as
  select id, name, fee_total from public.courses where public.institute_role() in ('owner', 'accounts');
grant select on public.student_profiles, public.trainer_students, public.account_students, public.course_catalog, public.course_finance to authenticated;

-- ==============================================================================
-- 20. Stored Procedures / RPC Functions for Dashboard Telemetry
-- ==============================================================================

create or replace function public.get_dashboard_telemetry()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_total_students integer;
  v_active_batches integer;
  v_attendance_pct numeric;
  v_pending_fees numeric;
  v_overdue_count integer;
begin
  select count(*) into v_total_students from public.students where status = 'Active';
  select count(*) into v_active_batches from public.batches;

  select coalesce(
    round((count(*) filter (where status in ('Present', 'Late'))::numeric / nullif(count(*), 0)::numeric) * 100, 1),
    87.5
  ) into v_attendance_pct from public.attendance;

  select coalesce(sum(greatest(amount - paid_amount, 0)), 0)
  into v_pending_fees from public.instalments where status != 'paid';

  select count(*) into v_overdue_count from public.instalments where status = 'overdue';

  return jsonb_build_object(
    'totalStudents', coalesce(v_total_students, 1248),
    'activeBatches', coalesce(v_active_batches, 24),
    'attendancePercentage', coalesce(v_attendance_pct, 87.5),
    'pendingFees', coalesce(v_pending_fees, 125000),
    'overdueInstalments', coalesce(v_overdue_count, 18)
  );
end;
$$;

-- This legacy SECURITY DEFINER RPC is not required by the trusted application
-- path. Keep browser/API roles from invoking it.
revoke all on function public.get_dashboard_telemetry() from PUBLIC, anon, authenticated;

-- ==============================================================================
-- 21. File Storage Buckets Configuration (Avatars & Documents)
-- ==============================================================================
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('documents', 'documents', false)
on conflict (id) do update set public = excluded.public;

-- Public can view avatars
drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read" on storage.objects
  for select using (bucket_id = 'avatars');

-- Authenticated users can upload avatars (max 5MB, images only)
drop policy if exists "avatars: authenticated upload" on storage.objects;
create policy "avatars: authenticated upload" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
  );

-- Student documents are private: owners/counselors can manage all documents;
-- trainers can access academic documents only for students in assigned batches.
drop policy if exists "documents: scoped read" on storage.objects;
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

drop policy if exists "documents: scoped upload" on storage.objects;
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

commit;
-- END SOURCE FILE: supabase/migrations/20261017000000_instituteos_complete_schema.sql

-- BEGIN SOURCE FILE: supabase/migrations/20261017000001_fix_rls_policies.sql
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
-- END SOURCE FILE: supabase/migrations/20261017000001_fix_rls_policies.sql

-- BEGIN SOURCE FILE: supabase/migrations/20261017000002_remove_legacy_permissive_policies.sql
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
-- END SOURCE FILE: supabase/migrations/20261017000002_remove_legacy_permissive_policies.sql

-- BEGIN SOURCE FILE: supabase/migrations/20261017000003_enforce_tenant_identity_and_rls.sql
-- Tenant isolation and immutable identity links for InstituteOS.
-- Existing rows are deliberately not assigned to INST-MAIN: their tenant cannot
-- be inferred safely. Rows with NULL institute_id remain hidden until reviewed.
begin;

-- Supabase projects can enable broad default grants for objects created by
-- postgres. Remove those defaults for browser roles; later grants below are
-- explicit for the InstituteOS objects that the application needs. Revoke
-- PUBLIC function defaults globally because schema-scoped revokes cannot
-- cancel PostgreSQL's global PUBLIC EXECUTE default.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
revoke create on schema public from public, anon, authenticated, service_role;

-- Bind the application profile to the immutable Supabase Auth user identifier.
alter table public.users add column if not exists auth_user_id uuid;
do $migration$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_auth_user_id_fkey'
  ) then
    alter table public.users
      add constraint users_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete set null;
  end if;
end;
$migration$;
create unique index if not exists users_auth_user_id_uidx
  on public.users (auth_user_id) where auth_user_id is not null;

-- Safe, exact backfill only: legacy profile IDs that are the Auth UUID itself.
update public.users u
set auth_user_id = a.id
from auth.users a
where u.auth_user_id is null
  and u.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and u.id::uuid = a.id;

alter table public.trainers add column if not exists auth_user_id uuid;
do $migration$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.trainers'::regclass
      and conname = 'trainers_auth_user_id_fkey'
  ) then
    alter table public.trainers
      add constraint trainers_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete set null;
  end if;
end;
$migration$;
create unique index if not exists trainers_auth_user_id_uidx
  on public.trainers (auth_user_id) where auth_user_id is not null;

-- Add tenant ownership to every InstituteOS-owned operational table. Existing
-- rows are intentionally left NULL rather than guessed into a tenant.
alter table public.courses add column if not exists institute_id text references public.institutes(id);
alter table public.trainers add column if not exists institute_id text references public.institutes(id);
alter table public.trainer_availability add column if not exists institute_id text references public.institutes(id);
alter table public.rooms add column if not exists institute_id text references public.institutes(id);
alter table public.batches add column if not exists institute_id text references public.institutes(id);
alter table public.students add column if not exists institute_id text references public.institutes(id);
alter table public.sessions add column if not exists institute_id text references public.institutes(id);
alter table public.attendance add column if not exists institute_id text references public.institutes(id);
alter table public.assignments add column if not exists institute_id text references public.institutes(id);
alter table public.submissions add column if not exists institute_id text references public.institutes(id);
alter table public.fee_plans add column if not exists institute_id text references public.institutes(id);
alter table public.instalments add column if not exists institute_id text references public.institutes(id);
alter table public.payments add column if not exists institute_id text references public.institutes(id);
alter table public.recordings add column if not exists institute_id text references public.institutes(id);
alter table public.approvals add column if not exists institute_id text references public.institutes(id);
alter table public.audit_log add column if not exists institute_id text references public.institutes(id);

create index if not exists courses_institute_id_idx on public.courses (institute_id);
create index if not exists trainers_institute_id_idx on public.trainers (institute_id);
create index if not exists trainer_availability_institute_id_idx on public.trainer_availability (institute_id);
create index if not exists rooms_institute_id_idx on public.rooms (institute_id);
create index if not exists batches_institute_id_idx on public.batches (institute_id);
create index if not exists students_institute_id_idx on public.students (institute_id);
create index if not exists sessions_institute_id_idx on public.sessions (institute_id);
create index if not exists attendance_institute_id_idx on public.attendance (institute_id);
create index if not exists assignments_institute_id_idx on public.assignments (institute_id);
create index if not exists submissions_institute_id_idx on public.submissions (institute_id);
create index if not exists fee_plans_institute_id_idx on public.fee_plans (institute_id);
create index if not exists instalments_institute_id_idx on public.instalments (institute_id);
create index if not exists payments_institute_id_idx on public.payments (institute_id);
create index if not exists recordings_institute_id_idx on public.recordings (institute_id);
create index if not exists approvals_institute_id_idx on public.approvals (institute_id);
create index if not exists audit_log_institute_id_idx on public.audit_log (institute_id);

-- A missing or ambiguous active institute never grants a role. For users with
-- more than one membership, app_metadata.institute_id must select one of them.
create or replace function public.current_user_context()
returns table (user_id text, institute_id text, role text)
language sql stable security definer
set search_path = pg_catalog
as $function$
  select m.user_id, m.institute_id, m.role
  from (
    select u.id as user_id, im.institute_id, im.role,
      nullif(auth.jwt() -> 'app_metadata' ->> 'institute_id', '') as requested_institute_id,
      pg_catalog.count(*) over () as membership_count
    from public.users u
    join public.institute_members im on im.user_id = u.id
    where u.auth_user_id = auth.uid()
  ) m
  where (m.requested_institute_id is not null and m.institute_id = m.requested_institute_id)
     or (m.requested_institute_id is null and m.membership_count = 1)
$function$;

create or replace function public.current_institute_id()
returns text language sql stable security definer
set search_path = pg_catalog
as $function$
  select c.institute_id from public.current_user_context() c limit 1
$function$;

create or replace function public.institute_role()
returns text language sql stable security definer
set search_path = pg_catalog
as $function$
  select c.role from public.current_user_context() c limit 1
$function$;

create or replace function public.trainer_owns_batch(target_batch text)
returns boolean language sql stable security definer
set search_path = pg_catalog
as $function$
  select exists (
    select 1
    from public.batches b
    join public.trainers t on t.id = b.trainer_id
    join public.current_user_context() c
      on c.role = 'trainer'
     and c.institute_id = b.institute_id
     and c.institute_id = t.institute_id
     and c.user_id is not null
     and t.auth_user_id = auth.uid()
    where b.id = target_batch
      and b.institute_id = public.current_institute_id()
  )
$function$;

-- Only an owner of the active institute may test/link an Auth ID to a trainer
-- membership. Membership internals remain unavailable to browser table queries.
create or replace function public.is_active_trainer_auth_user(
  target_auth_user_id uuid, target_institute_id text
)
returns boolean language sql stable security definer
set search_path = pg_catalog
as $function$
  select exists (
    select 1
    from public.current_user_context() c
    join public.institute_members m
      on m.institute_id = c.institute_id and m.role = 'trainer'
    join public.users u
      on u.id = m.user_id and u.institute_id = m.institute_id
    where c.role = 'owner'
      and c.institute_id = target_institute_id
      and u.auth_user_id = target_auth_user_id
  )
$function$;

revoke all on function public.current_user_context() from public, anon, authenticated;
revoke all on function public.current_institute_id() from public, anon, authenticated;
revoke all on function public.institute_role() from public, anon, authenticated;
revoke all on function public.trainer_owns_batch(text) from public, anon, authenticated;
revoke all on function public.is_active_trainer_auth_user(uuid,text) from public, anon, authenticated;
grant execute on function public.current_user_context() to authenticated;
grant execute on function public.current_institute_id() to authenticated;
grant execute on function public.institute_role() to authenticated;
grant execute on function public.trainer_owns_batch(text) to authenticated;
grant execute on function public.is_active_trainer_auth_user(uuid,text) to authenticated;

-- Defaults supply the verified active tenant for ordinary authenticated writes.
alter table public.courses alter column institute_id set default public.current_institute_id();
alter table public.trainers alter column institute_id set default public.current_institute_id();
alter table public.trainer_availability alter column institute_id set default public.current_institute_id();
alter table public.rooms alter column institute_id set default public.current_institute_id();
alter table public.batches alter column institute_id set default public.current_institute_id();
alter table public.students alter column institute_id set default public.current_institute_id();
alter table public.sessions alter column institute_id set default public.current_institute_id();
alter table public.attendance alter column institute_id set default public.current_institute_id();
alter table public.assignments alter column institute_id set default public.current_institute_id();
alter table public.submissions alter column institute_id set default public.current_institute_id();
alter table public.fee_plans alter column institute_id set default public.current_institute_id();
alter table public.instalments alter column institute_id set default public.current_institute_id();
alter table public.payments alter column institute_id set default public.current_institute_id();
alter table public.recordings alter column institute_id set default public.current_institute_id();
alter table public.approvals alter column institute_id set default public.current_institute_id();
alter table public.audit_log alter column institute_id set default public.current_institute_id();

-- Remove every prior public policy on these InstituteOS tables so old permissive
-- policy names cannot OR around the tenant predicates below.
do $migration$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'institutes','users','institute_members','courses','trainers',
        'trainer_availability','rooms','batches','students','sessions',
        'attendance','assignments','submissions','fee_plans','instalments',
        'payments','recordings','approvals','audit_log'
      ])
  loop
    execute pg_catalog.format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end;
$migration$;

alter table public.institutes enable row level security;
alter table public.users enable row level security;
alter table public.institute_members enable row level security;
alter table public.courses enable row level security;
alter table public.trainers enable row level security;
alter table public.trainer_availability enable row level security;
alter table public.rooms enable row level security;
alter table public.batches enable row level security;
alter table public.students enable row level security;
alter table public.sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.fee_plans enable row level security;
alter table public.instalments enable row level security;
alter table public.payments enable row level security;
alter table public.recordings enable row level security;
alter table public.approvals enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "institutes: active member read" on public.institutes;
create policy "institutes: active member read" on public.institutes
  for select to authenticated using (id = public.current_institute_id());
drop policy if exists "users: active institute read" on public.users;
create policy "users: active institute read" on public.users
  for select to authenticated using (
    institute_id = public.current_institute_id()
    and (public.institute_role() = 'owner' or auth_user_id = auth.uid())
  );
drop policy if exists "courses: tenant read" on public.courses;
create policy "courses: tenant read" on public.courses
  for select to authenticated using (institute_id = public.current_institute_id());
drop policy if exists "courses: managers insert" on public.courses;
create policy "courses: managers insert" on public.courses
  for insert to authenticated with check (
    institute_id = public.current_institute_id() and public.institute_role() in ('owner','counselor')
  );
drop policy if exists "courses: managers update" on public.courses;
create policy "courses: managers update" on public.courses
  for update to authenticated using (
    institute_id = public.current_institute_id() and public.institute_role() in ('owner','counselor')
  ) with check (
    institute_id = public.current_institute_id() and public.institute_role() in ('owner','counselor')
  );
drop policy if exists "courses: owner delete" on public.courses;
create policy "courses: owner delete" on public.courses
  for delete to authenticated using (institute_id = public.current_institute_id() and public.institute_role() = 'owner');

drop policy if exists "trainers: tenant read" on public.trainers;
create policy "trainers: tenant read" on public.trainers
  for select to authenticated using (institute_id = public.current_institute_id());
drop policy if exists "trainers: owner insert" on public.trainers;
create policy "trainers: owner insert" on public.trainers
  for insert to authenticated with check (
    institute_id = public.current_institute_id() and public.institute_role() = 'owner'
    and (auth_user_id is null or public.is_active_trainer_auth_user(auth_user_id, institute_id))
  );
drop policy if exists "trainers: owner update" on public.trainers;
create policy "trainers: owner update" on public.trainers
  for update to authenticated using (
    institute_id = public.current_institute_id() and public.institute_role() = 'owner'
  ) with check (
    institute_id = public.current_institute_id() and public.institute_role() = 'owner'
    and (auth_user_id is null or public.is_active_trainer_auth_user(auth_user_id, institute_id))
  );
drop policy if exists "trainers: owner delete" on public.trainers;
create policy "trainers: owner delete" on public.trainers
  for delete to authenticated using (institute_id = public.current_institute_id() and public.institute_role() = 'owner');

drop policy if exists "availability: tenant read" on public.trainer_availability;
create policy "availability: tenant read" on public.trainer_availability
  for select to authenticated using (institute_id = public.current_institute_id());
drop policy if exists "availability: owner write" on public.trainer_availability;
create policy "availability: owner write" on public.trainer_availability
  for insert to authenticated with check (
    institute_id = public.current_institute_id() and public.institute_role() = 'owner'
    and exists (select 1 from public.trainers t where t.id = trainer_id and t.institute_id = public.current_institute_id())
  );
drop policy if exists "availability: owner update" on public.trainer_availability;
create policy "availability: owner update" on public.trainer_availability
  for update to authenticated using (
    institute_id = public.current_institute_id() and public.institute_role() = 'owner'
  ) with check (
    institute_id = public.current_institute_id() and public.institute_role() = 'owner'
    and exists (select 1 from public.trainers t where t.id = trainer_id and t.institute_id = public.current_institute_id())
  );
drop policy if exists "availability: owner delete" on public.trainer_availability;
create policy "availability: owner delete" on public.trainer_availability
  for delete to authenticated using (institute_id = public.current_institute_id() and public.institute_role() = 'owner');

drop policy if exists "rooms: tenant read" on public.rooms;
create policy "rooms: tenant read" on public.rooms
  for select to authenticated using (institute_id = public.current_institute_id());
drop policy if exists "rooms: managers insert" on public.rooms;
create policy "rooms: managers insert" on public.rooms
  for insert to authenticated with check (
    institute_id = public.current_institute_id() and public.institute_role() in ('owner','counselor')
  );
drop policy if exists "rooms: managers update" on public.rooms;
create policy "rooms: managers update" on public.rooms
  for update to authenticated using (
    institute_id = public.current_institute_id() and public.institute_role() in ('owner','counselor')
  ) with check (
    institute_id = public.current_institute_id() and public.institute_role() in ('owner','counselor')
  );
drop policy if exists "rooms: owner delete" on public.rooms;
create policy "rooms: owner delete" on public.rooms
  for delete to authenticated using (institute_id = public.current_institute_id() and public.institute_role() = 'owner');

drop policy if exists "batches: tenant read" on public.batches;
create policy "batches: tenant read" on public.batches
  for select to authenticated using (
    institute_id = public.current_institute_id()
    and (public.institute_role() in ('owner','counselor','accounts') or public.trainer_owns_batch(id))
  );
drop policy if exists "batches: managers insert" on public.batches;
create policy "batches: managers insert" on public.batches
  for insert to authenticated with check (
    institute_id = public.current_institute_id() and public.institute_role() in ('owner','counselor')
    and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.institute_id = public.current_institute_id()))
    and (trainer_id is null or exists (select 1 from public.trainers t where t.id = trainer_id and t.institute_id = public.current_institute_id()))
    and (room_id is null or exists (select 1 from public.rooms r where r.id = room_id and r.institute_id = public.current_institute_id()))
  );
drop policy if exists "batches: managers update" on public.batches;
create policy "batches: managers update" on public.batches
  for update to authenticated using (
    institute_id = public.current_institute_id() and public.institute_role() in ('owner','counselor')
  ) with check (
    institute_id = public.current_institute_id() and public.institute_role() in ('owner','counselor')
    and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.institute_id = public.current_institute_id()))
    and (trainer_id is null or exists (select 1 from public.trainers t where t.id = trainer_id and t.institute_id = public.current_institute_id()))
    and (room_id is null or exists (select 1 from public.rooms r where r.id = room_id and r.institute_id = public.current_institute_id()))
  );
drop policy if exists "batches: owner delete" on public.batches;
create policy "batches: owner delete" on public.batches
  for delete to authenticated using (institute_id = public.current_institute_id() and public.institute_role() = 'owner');

drop policy if exists "students: tenant read" on public.students;
create policy "students: tenant read" on public.students
  for select to authenticated using (
    institute_id = public.current_institute_id()
    and (public.institute_role() in ('owner','counselor','accounts') or public.trainer_owns_batch(batch_id))
  );
drop policy if exists "students: managers insert" on public.students;
create policy "students: managers insert" on public.students
  for insert to authenticated with check (
    institute_id = public.current_institute_id() and public.institute_role() in ('owner','counselor')
    and (batch_id is null or exists (select 1 from public.batches b where b.id = batch_id and b.institute_id = public.current_institute_id()))
    and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.institute_id = public.current_institute_id()))
  );
drop policy if exists "students: managers update" on public.students;
create policy "students: managers update" on public.students
  for update to authenticated using (
    institute_id = public.current_institute_id() and public.institute_role() in ('owner','counselor')
  ) with check (
    institute_id = public.current_institute_id() and public.institute_role() in ('owner','counselor')
    and (batch_id is null or exists (select 1 from public.batches b where b.id = batch_id and b.institute_id = public.current_institute_id()))
    and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.institute_id = public.current_institute_id()))
  );
drop policy if exists "students: owner delete" on public.students;
create policy "students: owner delete" on public.students
  for delete to authenticated using (institute_id = public.current_institute_id() and public.institute_role() = 'owner');

create or replace function public.attendance_matches_session_batch(
  target_institute text, target_student text, target_session text
)
returns boolean language sql stable security definer
set search_path = pg_catalog
as $function$
  select exists (
    select 1
    from public.sessions s
    join public.students st on st.id = target_student and st.institute_id = target_institute
    where s.id = target_session and s.institute_id = target_institute
      and st.batch_id = s.batch_id
      and auth.uid() is not null
      and target_institute = public.current_institute_id()
  )
$function$;
revoke all on function public.attendance_matches_session_batch(text,text,text) from public, anon, authenticated;
grant execute on function public.attendance_matches_session_batch(text,text,text) to authenticated;

drop policy if exists "sessions: tenant read" on public.sessions;
create policy "sessions: tenant read" on public.sessions
  for select to authenticated using (
    institute_id = public.current_institute_id()
    and (public.institute_role() in ('owner','counselor','accounts') or public.trainer_owns_batch(batch_id))
  );
drop policy if exists "sessions: authorized insert" on public.sessions;
create policy "sessions: authorized insert" on public.sessions
  for insert to authenticated with check (
    institute_id = public.current_institute_id()
    and (public.institute_role() in ('owner','counselor') or (public.institute_role() = 'trainer' and public.trainer_owns_batch(batch_id)))
    and exists (select 1 from public.batches b where b.id = batch_id and b.institute_id = public.current_institute_id())
  );
drop policy if exists "sessions: authorized update" on public.sessions;
create policy "sessions: authorized update" on public.sessions
  for update to authenticated using (
    institute_id = public.current_institute_id()
    and (public.institute_role() in ('owner','counselor') or (public.institute_role() = 'trainer' and public.trainer_owns_batch(batch_id)))
  ) with check (
    institute_id = public.current_institute_id()
    and (public.institute_role() in ('owner','counselor') or (public.institute_role() = 'trainer' and public.trainer_owns_batch(batch_id)))
    and exists (select 1 from public.batches b where b.id = batch_id and b.institute_id = public.current_institute_id())
  );
drop policy if exists "sessions: owner delete" on public.sessions;
create policy "sessions: owner delete" on public.sessions
  for delete to authenticated using (institute_id = public.current_institute_id() and public.institute_role() = 'owner');

drop policy if exists "attendance: tenant read" on public.attendance;
create policy "attendance: tenant read" on public.attendance
  for select to authenticated using (
    institute_id = public.current_institute_id()
    and (public.institute_role() in ('owner','counselor','accounts') or exists (
      select 1 from public.sessions s
      where s.id = attendance.session_id and s.institute_id = public.current_institute_id()
        and public.trainer_owns_batch(s.batch_id)
    ))
  );
-- Direct writes are limited to owners. Counselor/trainer attendance proposals
-- must go through an audited approval executor before any future service role
-- action is enabled; membership alone never authorizes a bulk client write.
drop policy if exists "attendance: authorized insert" on public.attendance;
create policy "attendance: authorized insert" on public.attendance
  for insert to authenticated with check (
    institute_id = public.current_institute_id()
    and public.attendance_matches_session_batch(institute_id, student_id, session_id)
    and public.institute_role() = 'owner'
  );
drop policy if exists "attendance: authorized update" on public.attendance;
create policy "attendance: authorized update" on public.attendance
  for update to authenticated using (
    institute_id = public.current_institute_id()
    and public.institute_role() = 'owner'
  ) with check (
    institute_id = public.current_institute_id()
    and public.attendance_matches_session_batch(institute_id, student_id, session_id)
    and public.institute_role() = 'owner'
  );

drop policy if exists "assignments: tenant read" on public.assignments;
create policy "assignments: tenant read" on public.assignments
  for select to authenticated using (
    institute_id = public.current_institute_id()
    and (public.institute_role() in ('owner','counselor','accounts') or public.trainer_owns_batch(batch_id))
  );
drop policy if exists "assignments: authorized insert" on public.assignments;
create policy "assignments: authorized insert" on public.assignments
  for insert to authenticated with check (
    institute_id = public.current_institute_id()
    and (public.institute_role() in ('owner','counselor') or (public.institute_role() = 'trainer' and public.trainer_owns_batch(batch_id)))
    and exists (select 1 from public.batches b where b.id = batch_id and b.institute_id = public.current_institute_id())
  );
drop policy if exists "assignments: authorized update" on public.assignments;
create policy "assignments: authorized update" on public.assignments
  for update to authenticated using (
    institute_id = public.current_institute_id() and (public.institute_role() in ('owner','counselor') or (public.institute_role() = 'trainer' and public.trainer_owns_batch(batch_id)))
  ) with check (
    institute_id = public.current_institute_id() and (public.institute_role() in ('owner','counselor') or (public.institute_role() = 'trainer' and public.trainer_owns_batch(batch_id)))
    and exists (select 1 from public.batches b where b.id = batch_id and b.institute_id = public.current_institute_id())
  );

drop policy if exists "submissions: tenant read" on public.submissions;
create policy "submissions: tenant read" on public.submissions
  for select to authenticated using (
    institute_id = public.current_institute_id()
    and (public.institute_role() in ('owner','counselor','accounts') or exists (
      select 1 from public.assignments a where a.id = assignment_id and a.institute_id = public.current_institute_id()
        and public.trainer_owns_batch(a.batch_id)
    ))
  );
drop policy if exists "submissions: authorized insert" on public.submissions;
create policy "submissions: authorized insert" on public.submissions
  for insert to authenticated with check (
    institute_id = public.current_institute_id()
    and exists (
      select 1 from public.assignments a join public.students s on s.id = student_id
      where a.id = assignment_id and s.institute_id = public.current_institute_id()
        and a.institute_id = public.current_institute_id() and s.batch_id = a.batch_id
        and (public.institute_role() in ('owner','counselor') or (public.institute_role() = 'trainer' and public.trainer_owns_batch(a.batch_id)))
    )
  );
drop policy if exists "submissions: authorized update" on public.submissions;
create policy "submissions: authorized update" on public.submissions
  for update to authenticated using (
    institute_id = public.current_institute_id()
    and (public.institute_role() in ('owner','counselor') or exists (
      select 1 from public.assignments a where a.id = assignment_id and a.institute_id = public.current_institute_id()
        and public.institute_role() = 'trainer' and public.trainer_owns_batch(a.batch_id)
    ))
  ) with check (
    institute_id = public.current_institute_id()
    and exists (
      select 1 from public.assignments a join public.students s on s.id = student_id
      where a.id = assignment_id and s.institute_id = public.current_institute_id()
        and a.institute_id = public.current_institute_id() and s.batch_id = a.batch_id
        and (public.institute_role() in ('owner','counselor') or (public.institute_role() = 'trainer' and public.trainer_owns_batch(a.batch_id)))
    )
  );

drop policy if exists "recordings: tenant read" on public.recordings;
create policy "recordings: tenant read" on public.recordings
  for select to authenticated using (
    institute_id = public.current_institute_id()
    and (public.institute_role() in ('owner','counselor','accounts') or exists (
      select 1 from public.sessions s where s.id = session_id and s.institute_id = public.current_institute_id() and public.trainer_owns_batch(s.batch_id)
    ))
  );
drop policy if exists "recordings: authorized insert" on public.recordings;
create policy "recordings: authorized insert" on public.recordings
  for insert to authenticated with check (
    institute_id = public.current_institute_id()
    and exists (select 1 from public.sessions s where s.id = session_id and s.institute_id = public.current_institute_id()
      and (public.institute_role() in ('owner','counselor') or (public.institute_role() = 'trainer' and public.trainer_owns_batch(s.batch_id))))
  );
drop policy if exists "recordings: authorized update" on public.recordings;
create policy "recordings: authorized update" on public.recordings
  for update to authenticated using (
    institute_id = public.current_institute_id()
    and (public.institute_role() in ('owner','counselor') or exists (
      select 1 from public.sessions s where s.id = session_id and s.institute_id = public.current_institute_id()
        and public.institute_role() = 'trainer' and public.trainer_owns_batch(s.batch_id)
    ))
  ) with check (
    institute_id = public.current_institute_id()
    and exists (select 1 from public.sessions s where s.id = session_id and s.institute_id = public.current_institute_id()
      and (public.institute_role() in ('owner','counselor') or (public.institute_role() = 'trainer' and public.trainer_owns_batch(s.batch_id))))
  );

drop policy if exists "fee_plans: finance tenant read" on public.fee_plans;
create policy "fee_plans: finance tenant read" on public.fee_plans
  for select to authenticated using (institute_id = public.current_institute_id() and public.institute_role() in ('owner','accounts'));
drop policy if exists "fee_plans: finance insert" on public.fee_plans;
create policy "fee_plans: finance insert" on public.fee_plans
  for insert to authenticated with check (institute_id = public.current_institute_id() and public.institute_role() in ('owner','accounts')
    and exists (select 1 from public.students s where s.id = student_id and s.institute_id = public.current_institute_id()));
drop policy if exists "fee_plans: finance update" on public.fee_plans;
create policy "fee_plans: finance update" on public.fee_plans
  for update to authenticated using (institute_id = public.current_institute_id() and public.institute_role() in ('owner','accounts'))
  with check (institute_id = public.current_institute_id() and public.institute_role() in ('owner','accounts')
    and exists (select 1 from public.students s where s.id = student_id and s.institute_id = public.current_institute_id()));
drop policy if exists "instalments: finance tenant read" on public.instalments;
create policy "instalments: finance tenant read" on public.instalments
  for select to authenticated using (institute_id = public.current_institute_id() and public.institute_role() in ('owner','accounts'));
drop policy if exists "instalments: finance insert" on public.instalments;
create policy "instalments: finance insert" on public.instalments
  for insert to authenticated with check (institute_id = public.current_institute_id() and public.institute_role() in ('owner','accounts')
    and exists (select 1 from public.students s where s.id = student_id and s.institute_id = public.current_institute_id()));
drop policy if exists "instalments: finance update" on public.instalments;
create policy "instalments: finance update" on public.instalments
  for update to authenticated using (institute_id = public.current_institute_id() and public.institute_role() in ('owner','accounts'))
  with check (institute_id = public.current_institute_id() and public.institute_role() in ('owner','accounts')
    and exists (select 1 from public.students s where s.id = student_id and s.institute_id = public.current_institute_id()));
drop policy if exists "payments: finance tenant read" on public.payments;
create policy "payments: finance tenant read" on public.payments
  for select to authenticated using (institute_id = public.current_institute_id() and public.institute_role() in ('owner','accounts'));
drop policy if exists "approvals: tenant read" on public.approvals;
create policy "approvals: tenant read" on public.approvals
  for select to authenticated using (
    institute_id = public.current_institute_id()
    and (public.institute_role() = 'owner'
      or (public.institute_role() = 'accounts' and kind in ('fee_reconciliation','fee_action'))
      or requested_by = (select c.user_id from public.current_user_context() c limit 1))
  );
drop policy if exists "approvals: permitted insert" on public.approvals;
create policy "approvals: permitted insert" on public.approvals
  for insert to authenticated with check (
    institute_id = public.current_institute_id()
    and requested_by = (select c.user_id from public.current_user_context() c limit 1)
    and status = 'pending' and decided_by is null
    and (public.institute_role() in ('owner','counselor')
      or (public.institute_role() = 'trainer' and kind like 'attendance_%')
      or (public.institute_role() = 'accounts' and kind in ('fee_reconciliation','fee_action')))
  );
drop policy if exists "approvals: authorized update" on public.approvals;
create policy "approvals: authorized update" on public.approvals
  for update to authenticated using (
    institute_id = public.current_institute_id()
    and status = 'pending'
    and (public.institute_role() = 'owner' or (public.institute_role() = 'accounts' and kind in ('fee_reconciliation','fee_action')))
  ) with check (
    institute_id = public.current_institute_id()
    and status in ('approved','rejected')
    and decided_by = (select c.user_id from public.current_user_context() c limit 1)
    and (public.institute_role() = 'owner' or (public.institute_role() = 'accounts' and kind in ('fee_reconciliation','fee_action')))
  );
drop policy if exists "audit_log: owner tenant read" on public.audit_log;
create policy "audit_log: owner tenant read" on public.audit_log
  for select to authenticated using (institute_id = public.current_institute_id() and public.institute_role() = 'owner');

-- Enforce same-session/same-batch attendance even for non-browser write paths.
create or replace function public.enforce_attendance_batch_match()
returns trigger language plpgsql
set search_path = pg_catalog
as $function$
begin
  if (auth.uid() is not null and new.institute_id is distinct from public.current_institute_id())
     or not exists (
       select 1
       from public.students st
       join public.sessions s on s.id = new.session_id
       where st.id = new.student_id
         and st.institute_id = new.institute_id
         and s.institute_id = new.institute_id
         and st.batch_id = s.batch_id
     ) then
    raise exception 'Attendance student and session must belong to the same batch and active institute'
      using errcode = '23514';
  end if;
  if tg_op = 'UPDATE'
     and public.institute_role() = 'trainer'
     and (new.institute_id is distinct from old.institute_id
       or new.student_id is distinct from old.student_id
       or new.session_id is distinct from old.session_id) then
    raise exception 'Trainers cannot move attendance records between students, sessions, or institutes'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;
revoke all on function public.enforce_attendance_batch_match() from public, anon, authenticated;
drop trigger if exists attendance_batch_match on public.attendance;
create trigger attendance_batch_match
  before insert or update of institute_id, student_id, session_id on public.attendance
  for each row execute function public.enforce_attendance_batch_match();

-- Trainers may edit records in their batches, but cannot reassign their foreign
-- keys to another batch they happen to own. Managers can make such changes when
-- the row-level checks confirm that all referenced records stay in their tenant.
create or replace function public.prevent_trainer_relationship_changes()
returns trigger language plpgsql
set search_path = pg_catalog
as $function$
declare
  v_new jsonb := pg_catalog.to_jsonb(new);
  v_old jsonb := pg_catalog.to_jsonb(old);
begin
  if tg_op = 'UPDATE' and public.institute_role() = 'trainer' then
    if tg_table_name in ('sessions','assignments')
       and v_new -> 'batch_id' is distinct from v_old -> 'batch_id' then
      raise exception 'Trainers cannot reassign records to another batch' using errcode = '42501';
    elsif tg_table_name = 'recordings'
       and v_new -> 'session_id' is distinct from v_old -> 'session_id' then
      raise exception 'Trainers cannot reassign recordings to another session' using errcode = '42501';
    elsif tg_table_name = 'submissions'
       and (v_new -> 'assignment_id' is distinct from v_old -> 'assignment_id'
         or v_new -> 'student_id' is distinct from v_old -> 'student_id') then
      raise exception 'Trainers cannot reassign submissions to another assignment or student' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;
revoke all on function public.prevent_trainer_relationship_changes() from public, anon, authenticated;
drop trigger if exists trainer_relationships_immutable on public.sessions;
create trigger trainer_relationships_immutable before update of batch_id on public.sessions
  for each row execute function public.prevent_trainer_relationship_changes();
drop trigger if exists trainer_relationships_immutable on public.assignments;
create trigger trainer_relationships_immutable before update of batch_id on public.assignments
  for each row execute function public.prevent_trainer_relationship_changes();
drop trigger if exists trainer_relationships_immutable on public.recordings;
create trigger trainer_relationships_immutable before update of session_id on public.recordings
  for each row execute function public.prevent_trainer_relationship_changes();
drop trigger if exists trainer_relationships_immutable on public.submissions;
create trigger trainer_relationships_immutable before update of assignment_id, student_id on public.submissions
  for each row execute function public.prevent_trainer_relationship_changes();

-- Atomically append a payment and update its installment under the caller's
-- authenticated tenant context. Direct payment updates/deletes remain unavailable.
create or replace function public.record_payment(
  p_id text, p_student_id text, p_instalment_id text, p_amount numeric,
  p_method text, p_utr text, p_received_on text
)
returns jsonb language plpgsql security definer
set search_path = pg_catalog
as $function$
declare
  v_context record;
  v_instalment public.instalments%rowtype;
  v_payment public.payments%rowtype;
begin
  select * into v_context from public.current_user_context() limit 1;
  if v_context.user_id is null or v_context.role not in ('owner','accounts') then
    raise exception 'A current finance membership is required' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be positive' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.students s
    where s.id = p_student_id and s.institute_id = v_context.institute_id
  ) then
    raise exception 'Student is not in the active institute' using errcode = '23503';
  end if;
  if p_instalment_id is not null then
    select i.* into v_instalment from public.instalments i
    where i.id = p_instalment_id and i.institute_id = v_context.institute_id
    for update;
    if not found or v_instalment.student_id is distinct from p_student_id then
      raise exception 'Instalment does not belong to the selected student and institute' using errcode = '23503';
    end if;
  end if;

  insert into public.payments (id, institute_id, student_id, instalment_id, amount, method, utr, received_on)
  values (p_id, v_context.institute_id, p_student_id, p_instalment_id, p_amount,
          coalesce(p_method, 'bank_transfer'), coalesce(p_utr, ''), coalesce(p_received_on, pg_catalog.to_char(current_date, 'YYYY-MM-DD')))
  returning * into v_payment;

  if p_instalment_id is not null then
    update public.instalments i
    set paid_amount = least(i.amount, i.paid_amount + p_amount),
        status = case when i.paid_amount + p_amount >= i.amount then 'paid' else i.status end,
        paid_on = case when i.paid_amount + p_amount >= i.amount then coalesce(p_received_on, pg_catalog.to_char(current_date, 'YYYY-MM-DD')) else i.paid_on end
    where i.id = p_instalment_id and i.institute_id = v_context.institute_id;
  end if;
  return pg_catalog.to_jsonb(v_payment);
end;
$function$;
revoke all on function public.record_payment(text,text,text,numeric,text,text,text) from public, anon, authenticated;
revoke all on function public.record_payment(text,text,text,numeric,text,text,text) from service_role;

-- Server-only payment RPC. The server supplies the Auth UUID and active tenant
-- only after verifying the caller JWT and membership; browser roles cannot call it.
create or replace function public.record_payment_for_user(
  p_id text, p_student_id text, p_instalment_id text, p_amount numeric,
  p_method text, p_utr text, p_received_on text,
  p_auth_user_id uuid, p_institute_id text
)
returns jsonb language plpgsql security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id text;
  v_role text;
  v_instalment public.instalments%rowtype;
  v_payment public.payments%rowtype;
begin
  select u.id, m.role into v_user_id, v_role
  from public.users u
  join public.institute_members m on m.user_id = u.id
  where u.auth_user_id = p_auth_user_id and m.institute_id = p_institute_id;
  if v_user_id is null or v_role not in ('owner','accounts') then
    raise exception 'A verified finance membership is required' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be positive' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.students s
    where s.id = p_student_id and s.institute_id = p_institute_id
  ) then
    raise exception 'Student is not in the active institute' using errcode = '23503';
  end if;
  if p_instalment_id is not null then
    select i.* into v_instalment from public.instalments i
    where i.id = p_instalment_id and i.institute_id = p_institute_id
    for update;
    if not found or v_instalment.student_id is distinct from p_student_id then
      raise exception 'Instalment does not belong to the selected student and institute' using errcode = '23503';
    end if;
  end if;

  insert into public.payments (id, institute_id, student_id, instalment_id, amount, method, utr, received_on)
  values (p_id, p_institute_id, p_student_id, p_instalment_id, p_amount,
          coalesce(p_method, 'bank_transfer'), coalesce(p_utr, ''), coalesce(p_received_on, pg_catalog.to_char(current_date, 'YYYY-MM-DD')))
  returning * into v_payment;

  if p_instalment_id is not null then
    update public.instalments i
    set paid_amount = least(i.amount, i.paid_amount + p_amount),
        status = case when i.paid_amount + p_amount >= i.amount then 'paid' else i.status end,
        paid_on = case when i.paid_amount + p_amount >= i.amount then coalesce(p_received_on, pg_catalog.to_char(current_date, 'YYYY-MM-DD')) else i.paid_on end
    where i.id = p_instalment_id and i.institute_id = p_institute_id;
  end if;
  return pg_catalog.to_jsonb(v_payment);
end;
$function$;
revoke all on function public.record_payment_for_user(text,text,text,numeric,text,text,text,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_payment_for_user(text,text,text,numeric,text,text,text,uuid,text)
  to service_role;

-- Views preserve the established column signatures while applying tenant and
-- role filters at the database boundary.
create or replace view public.student_profiles with (security_barrier = true) as
  select s.id, s.name, s.phone, s.email, s.batch_id, s.status, s.joined_on,
         s.course_id, c.name as course_name, s.batch_name
  from public.students s
  left join public.courses c on c.id = s.course_id and c.institute_id = s.institute_id
  where s.institute_id = public.current_institute_id()
    and public.institute_role() in ('owner','counselor');
create or replace view public.trainer_students with (security_barrier = true) as
  select s.id, s.name, s.batch_id, s.status, s.batch_name
  from public.students s
  where s.institute_id = public.current_institute_id()
    and public.institute_role() = 'trainer' and public.trainer_owns_batch(s.batch_id);
create or replace view public.account_students with (security_barrier = true) as
  select s.id, s.name from public.students s
  where s.institute_id = public.current_institute_id() and public.institute_role() = 'accounts';
create or replace view public.counselor_fee_summary with (security_barrier = true) as
  select c.name as course_name, i.status, i.due_date,
         pg_catalog.count(i.id)::integer as instalment_count,
          pg_catalog.sum(greatest(i.amount - i.paid_amount, 0)) as amount_due
  from public.instalments i
  join public.students s on s.id = i.student_id and s.institute_id = i.institute_id
  join public.courses c on c.id = s.course_id and c.institute_id = s.institute_id
  where i.institute_id = public.current_institute_id() and public.institute_role() = 'counselor'
  group by c.name, i.status, i.due_date;
create or replace view public.course_catalog with (security_barrier = true, security_invoker = true) as
  select c.id, c.name, c.duration_weeks, c.created_at from public.courses c
  where c.institute_id = public.current_institute_id();
create or replace view public.course_finance with (security_barrier = true) as
  select c.id, c.name, c.fee_total from public.courses c
  where c.institute_id = public.current_institute_id() and public.institute_role() in ('owner','accounts');
revoke all on public.student_profiles, public.trainer_students, public.account_students,
  public.counselor_fee_summary, public.course_catalog, public.course_finance from public, anon, authenticated;
grant select on public.student_profiles, public.trainer_students, public.account_students,
  public.counselor_fee_summary, public.course_catalog, public.course_finance to authenticated;

-- Explicit grants; row access remains controlled by the policies above.
revoke all on public.institutes, public.users, public.institute_members,
  public.courses, public.trainers, public.trainer_availability, public.rooms,
  public.batches, public.students, public.sessions, public.attendance,
  public.assignments, public.submissions, public.fee_plans, public.instalments,
  public.payments, public.recordings, public.approvals, public.audit_log
  from public, anon, authenticated;
grant select on public.institutes, public.trainer_availability, public.rooms,
  public.batches, public.sessions,
  public.attendance, public.assignments, public.submissions, public.fee_plans,
  public.instalments, public.payments, public.recordings, public.approvals,
  public.audit_log to authenticated;
grant insert, update, delete on public.trainer_availability,
  public.rooms, public.batches, public.sessions, public.attendance,
  public.assignments, public.submissions,
  public.recordings to authenticated;
-- Approval and fee mutations must go through audited server operations.
revoke insert, update, delete on public.approvals from public, anon, authenticated;
revoke insert, update, delete on public.fee_plans, public.instalments from public, anon, authenticated;
revoke all on public.approvals, public.audit_log from service_role;
grant select, insert (id, institute_id, kind, payload, preview, status, requested_by),
  update (status, decided_by, decided_at, payload)
  on public.approvals to service_role;
grant delete on public.students to authenticated;
grant select (id, name, batch_id, status, joined_on, course_id, batch_name)
  on public.students to authenticated;
grant select (institute_id) on public.students to authenticated;
grant insert (id, name, email, phone, batch_id, status, joined_on, course_id, batch_name)
  on public.students to authenticated;
grant update (name, email, phone, batch_id, status, joined_on, course_id, batch_name, updated_at)
  on public.students to authenticated;
grant select (id, institute_id, name, role, email, created_at)
  on public.users to authenticated;
grant select (id, institute_id, name, skills, weekly_hours_max, created_at)
  on public.trainers to authenticated;
grant select (id, institute_id, name, duration_weeks, created_at)
  on public.courses to authenticated;
grant insert (id, name, fee_total, duration_weeks) on public.courses to authenticated;
grant update (name, fee_total, duration_weeks) on public.courses to authenticated;
grant insert (id, auth_user_id, name, skills, weekly_hours_max) on public.trainers to authenticated;
grant update (auth_user_id, name, skills, weekly_hours_max) on public.trainers to authenticated;
revoke insert, update, delete on public.audit_log from public, anon, authenticated, service_role;
grant insert on public.audit_log to service_role;
revoke insert, update, delete on public.institute_members from anon, authenticated;
revoke insert, update, delete on public.payments from public, anon, authenticated;

-- Keep the unused legacy aggregate RPC inaccessible and harden its definer path.
create or replace function public.get_dashboard_telemetry()
returns jsonb language plpgsql security definer
set search_path = pg_catalog
as $function$
declare
  v_total_students integer;
  v_active_batches integer;
  v_attendance_pct numeric;
  v_pending_fees numeric;
  v_overdue_count integer;
begin
  select pg_catalog.count(*) into v_total_students from public.students where status = 'Active';
  select pg_catalog.count(*) into v_active_batches from public.batches;
  select pg_catalog.round(
    (pg_catalog.count(*) filter (where status in ('Present','Late'))::numeric / nullif(pg_catalog.count(*),0)::numeric) * 100, 1
  ) into v_attendance_pct from public.attendance;
  select coalesce(pg_catalog.sum(greatest(amount - paid_amount,0)),0)
    into v_pending_fees from public.instalments where status <> 'paid';
  select pg_catalog.count(*) into v_overdue_count from public.instalments where status = 'overdue';
  return pg_catalog.jsonb_build_object(
    'totalStudents', coalesce(v_total_students,0), 'activeBatches', coalesce(v_active_batches,0),
    'attendancePercentage', v_attendance_pct, 'pendingFees', coalesce(v_pending_fees,0),
    'overdueInstalments', coalesce(v_overdue_count,0)
  );
end;
$function$;
revoke all on function public.get_dashboard_telemetry() from public, anon, authenticated;

-- Storage policies are tenant scoped; only the public avatar bucket is public.
drop policy if exists "avatars: public read" on storage.objects;
drop policy if exists "avatars: authenticated upload" on storage.objects;
drop policy if exists "avatars: own upload" on storage.objects;
drop policy if exists "documents: auth read" on storage.objects;
drop policy if exists "documents: auth upload" on storage.objects;
drop policy if exists "documents: scoped read" on storage.objects;
drop policy if exists "documents: scoped upload" on storage.objects;
drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read" on storage.objects
  for select using (bucket_id = 'avatars');
drop policy if exists "avatars: own upload" on storage.objects;
create policy "avatars: own upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "documents: tenant read" on storage.objects;
create policy "documents: tenant read" on storage.objects
  for select to authenticated using (
    bucket_id = 'documents' and exists (
      select 1 from public.students s
      where s.id = (storage.foldername(name))[1]
        and s.institute_id = public.current_institute_id()
        and (public.institute_role() in ('owner','counselor')
          or (public.institute_role() = 'trainer'
            and pg_catalog.lower(coalesce((storage.foldername(name))[2],'')) <> 'id_proof'
            and public.trainer_owns_batch(s.batch_id)))
    )
  );
drop policy if exists "documents: tenant upload" on storage.objects;
create policy "documents: tenant upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'documents' and exists (
      select 1 from public.students s
      where s.id = (storage.foldername(name))[1]
        and s.institute_id = public.current_institute_id()
        and (public.institute_role() in ('owner','counselor')
          or (public.institute_role() = 'trainer'
            and pg_catalog.lower(coalesce((storage.foldername(name))[2],'')) <> 'id_proof'
            and public.trainer_owns_batch(s.batch_id)))
    )
  );
-- No UPDATE or DELETE policy is created for either bucket.

commit;
-- END SOURCE FILE: supabase/migrations/20261017000003_enforce_tenant_identity_and_rls.sql

-- BEGIN SOURCE FILE: supabase/seed.sql
-- Fictional, non-auth demo fixtures for the first local/approved initialization.
-- Fixture IDs use the DEMO- namespace except INST-MAIN, the institute default
-- referenced by public.users; compatible rows are preserved and incompatible
-- fixture-ID conflicts abort the whole transaction.
begin;

-- Parent rows come first: users reference institutes, then memberships reference
-- both. These public.users rows do not create Supabase Auth accounts.
insert into public.institutes (id, name, code, currency, timezone) values
  ('INST-MAIN', 'InstituteOS Demo Institute', 'DEMO-IOS-01', 'INR', 'Asia/Kolkata')
on conflict (id) do nothing;
do $seed_guard$
begin
  if not exists (select 1 from public.institutes where id = 'INST-MAIN'
    and name = 'InstituteOS Demo Institute' and code = 'DEMO-IOS-01'
    and currency = 'INR' and timezone = 'Asia/Kolkata') then
    raise exception 'Demo institute ID conflicts with an incompatible existing row';
  end if;
end;
$seed_guard$;

insert into public.users (id, institute_id, name, role, email) values
  ('DEMO-USER-OWNER', 'INST-MAIN', 'Demo Owner', 'owner', 'owner@demo.example.invalid'),
  ('DEMO-USER-COUNSELOR', 'INST-MAIN', 'Demo Counselor', 'counselor', 'counselor@demo.example.invalid'),
  ('DEMO-USER-TRAINER-01', 'INST-MAIN', 'Demo Trainer One', 'trainer', 'trainer.one@demo.example.invalid'),
  ('DEMO-USER-ACCOUNTS', 'INST-MAIN', 'Demo Accounts', 'accounts', 'accounts@demo.example.invalid')
on conflict (id) do nothing;
do $seed_guard$
begin
  if exists (
    select 1 from (values
      ('DEMO-USER-OWNER','Demo Owner','owner','owner@demo.example.invalid'),
      ('DEMO-USER-COUNSELOR','Demo Counselor','counselor','counselor@demo.example.invalid'),
      ('DEMO-USER-TRAINER-01','Demo Trainer One','trainer','trainer.one@demo.example.invalid'),
      ('DEMO-USER-ACCOUNTS','Demo Accounts','accounts','accounts@demo.example.invalid')
    ) as expected(id, name, role, email)
    join public.users u on u.id = expected.id
    where u.institute_id is distinct from 'INST-MAIN'
      or u.name is distinct from expected.name
      or u.role is distinct from expected.role
      or u.email is distinct from expected.email
      or u.auth_user_id is not null
  ) then
    raise exception 'A demo user ID conflicts with an incompatible or Auth-linked row';
  end if;
end;
$seed_guard$;

insert into public.institute_members (institute_id, user_id, role) values
  ('INST-MAIN', 'DEMO-USER-OWNER', 'owner'),
  ('INST-MAIN', 'DEMO-USER-COUNSELOR', 'counselor'),
  ('INST-MAIN', 'DEMO-USER-TRAINER-01', 'trainer'),
  ('INST-MAIN', 'DEMO-USER-ACCOUNTS', 'accounts')
on conflict (institute_id, user_id) do nothing;
do $seed_guard$
begin
  if exists (
    select 1 from (values
      ('DEMO-USER-OWNER','owner'),
      ('DEMO-USER-COUNSELOR','counselor'),
      ('DEMO-USER-TRAINER-01','trainer'),
      ('DEMO-USER-ACCOUNTS','accounts')
    ) as expected(user_id, role)
    join public.institute_members m on m.institute_id = 'INST-MAIN' and m.user_id = expected.user_id
    where m.role is distinct from expected.role
  ) then
    raise exception 'A demo membership conflicts with an incompatible existing row';
  end if;
end;
$seed_guard$;

insert into public.courses (id, institute_id, name, fee_total, duration_weeks) values
  ('DEMO-COURSE-WEB', 'INST-MAIN', 'Web Application Foundations', 48000, 24),
  ('DEMO-COURSE-DATA', 'INST-MAIN', 'Data Analysis Foundations', 52000, 26)
on conflict (id) do nothing;
do $seed_guard$
begin
  if exists (
    select 1 from (values
      ('DEMO-COURSE-WEB','Web Application Foundations',48000::numeric,24),
      ('DEMO-COURSE-DATA','Data Analysis Foundations',52000::numeric,26)
    ) as expected(id, name, fee_total, duration_weeks)
    join public.courses c on c.id = expected.id
    where c.institute_id is distinct from 'INST-MAIN'
      or c.name is distinct from expected.name
      or c.fee_total is distinct from expected.fee_total
      or c.duration_weeks is distinct from expected.duration_weeks
  ) then
    raise exception 'A demo course ID conflicts with an incompatible existing row';
  end if;
end;
$seed_guard$;

insert into public.trainers (id, institute_id, name, skills, weekly_hours_max) values
  ('DEMO-TRAINER-01', 'INST-MAIN', 'Demo Trainer One', 'Web development, databases', 20),
  ('DEMO-TRAINER-02', 'INST-MAIN', 'Demo Trainer Two', 'Data analysis, visualization', 18)
on conflict (id) do nothing;
do $seed_guard$
begin
  if exists (
    select 1 from (values
      ('DEMO-TRAINER-01','Demo Trainer One','Web development, databases',20),
      ('DEMO-TRAINER-02','Demo Trainer Two','Data analysis, visualization',18)
    ) as expected(id, name, skills, weekly_hours_max)
    join public.trainers t on t.id = expected.id
    where t.institute_id is distinct from 'INST-MAIN'
      or t.name is distinct from expected.name
      or t.skills is distinct from expected.skills
      or t.weekly_hours_max is distinct from expected.weekly_hours_max
      or t.auth_user_id is not null
  ) then
    raise exception 'A demo trainer ID conflicts with an incompatible or Auth-linked row';
  end if;
end;
$seed_guard$;

insert into public.trainer_availability (id, institute_id, trainer_id, weekday, start, "end") values
  ('00000000-0000-4000-8000-000000000001', 'INST-MAIN', 'DEMO-TRAINER-01', 1, '09:00', '13:00'),
  ('00000000-0000-4000-8000-000000000002', 'INST-MAIN', 'DEMO-TRAINER-02', 3, '13:00', '17:00')
on conflict (id) do nothing;
do $seed_guard$
begin
  if exists (
    select 1 from public.trainer_availability a
    where a.id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002')
      and (a.institute_id is distinct from 'INST-MAIN'
        or (a.id = '00000000-0000-4000-8000-000000000001' and
          (a.trainer_id is distinct from 'DEMO-TRAINER-01' or a.weekday is distinct from 1 or a.start is distinct from '09:00' or a."end" is distinct from '13:00'))
        or (a.id = '00000000-0000-4000-8000-000000000002' and
          (a.trainer_id is distinct from 'DEMO-TRAINER-02' or a.weekday is distinct from 3 or a.start is distinct from '13:00' or a."end" is distinct from '17:00')))
  ) then
    raise exception 'A demo trainer-availability ID conflicts with an incompatible existing row';
  end if;
end;
$seed_guard$;

insert into public.rooms (id, institute_id, name, capacity) values
  ('DEMO-ROOM-01', 'INST-MAIN', 'Demo Classroom One', 24),
  ('DEMO-ROOM-02', 'INST-MAIN', 'Demo Classroom Two', 20)
on conflict (id) do nothing;
do $seed_guard$
begin
  if exists (
    select 1 from (values
      ('DEMO-ROOM-01','Demo Classroom One',24),
      ('DEMO-ROOM-02','Demo Classroom Two',20)
    ) as expected(id, name, capacity)
    join public.rooms r on r.id = expected.id
    where r.institute_id is distinct from 'INST-MAIN'
      or r.name is distinct from expected.name
      or r.capacity is distinct from expected.capacity
  ) then
    raise exception 'A demo room ID conflicts with an incompatible existing row';
  end if;
end;
$seed_guard$;

insert into public.batches (
  id, institute_id, course_id, trainer_id, name, mode, start_date, slot_days,
  slot_start, slot_end, room_id, online_seat_limit, student_count,
  course_name, trainer_name
) values
  ('DEMO-BATCH-WEB', 'INST-MAIN', 'DEMO-COURSE-WEB', 'DEMO-TRAINER-01', 'Web Foundations A', 'classroom', '2026-09-01', '[1, 3]', '09:00', '11:00', 'DEMO-ROOM-01', 20, 2, 'Web Application Foundations', 'Demo Trainer One'),
  ('DEMO-BATCH-DATA', 'INST-MAIN', 'DEMO-COURSE-DATA', 'DEMO-TRAINER-02', 'Data Foundations A', 'hybrid', '2026-09-08', '[2, 4]', '14:00', '16:00', 'DEMO-ROOM-02', 18, 2, 'Data Analysis Foundations', 'Demo Trainer Two')
on conflict (id) do nothing;
do $seed_guard$
begin
  if exists (
    select 1 from (values
      ('DEMO-BATCH-WEB','DEMO-COURSE-WEB','DEMO-TRAINER-01','DEMO-ROOM-01','Web Foundations A','classroom','2026-09-01','[1, 3]','09:00','11:00',20,2,'Web Application Foundations','Demo Trainer One'),
      ('DEMO-BATCH-DATA','DEMO-COURSE-DATA','DEMO-TRAINER-02','DEMO-ROOM-02','Data Foundations A','hybrid','2026-09-08','[2, 4]','14:00','16:00',18,2,'Data Analysis Foundations','Demo Trainer Two')
    ) as expected(id, course_id, trainer_id, room_id, name, mode, start_date, slot_days, slot_start, slot_end, online_seat_limit, student_count, course_name, trainer_name)
    join public.batches b on b.id = expected.id
    where b.institute_id is distinct from 'INST-MAIN'
      or b.course_id is distinct from expected.course_id
      or b.trainer_id is distinct from expected.trainer_id
      or b.room_id is distinct from expected.room_id
      or b.name is distinct from expected.name
      or b.mode is distinct from expected.mode
      or b.start_date is distinct from expected.start_date
      or b.slot_days is distinct from expected.slot_days
      or b.slot_start is distinct from expected.slot_start
      or b.slot_end is distinct from expected.slot_end
      or b.online_seat_limit is distinct from expected.online_seat_limit
      or b.student_count is distinct from expected.student_count
      or b.course_name is distinct from expected.course_name
      or b.trainer_name is distinct from expected.trainer_name
  ) then
    raise exception 'A demo batch ID conflicts with an incompatible existing row';
  end if;
end;
$seed_guard$;

insert into public.students (
  id, institute_id, name, phone, email, batch_id, status, joined_on, course_id, batch_name
) values
  ('DEMO-STUDENT-001', 'INST-MAIN', 'Demo Student One', '', 'student.one@demo.example.invalid', 'DEMO-BATCH-WEB', 'Active', '2026-09-01', 'DEMO-COURSE-WEB', 'Web Foundations A'),
  ('DEMO-STUDENT-002', 'INST-MAIN', 'Demo Student Two', '', 'student.two@demo.example.invalid', 'DEMO-BATCH-WEB', 'Active', '2026-09-02', 'DEMO-COURSE-WEB', 'Web Foundations A'),
  ('DEMO-STUDENT-003', 'INST-MAIN', 'Demo Student Three', '', 'student.three@demo.example.invalid', 'DEMO-BATCH-DATA', 'Active', '2026-09-08', 'DEMO-COURSE-DATA', 'Data Foundations A'),
  ('DEMO-STUDENT-004', 'INST-MAIN', 'Demo Student Four', '', 'student.four@demo.example.invalid', 'DEMO-BATCH-DATA', 'Pending', '2026-09-09', 'DEMO-COURSE-DATA', 'Data Foundations A')
on conflict (id) do nothing;
do $seed_guard$
begin
  if exists (
    select 1 from (values
      ('DEMO-STUDENT-001','Demo Student One','','student.one@demo.example.invalid','DEMO-BATCH-WEB','Active','2026-09-01','DEMO-COURSE-WEB','Web Foundations A'),
      ('DEMO-STUDENT-002','Demo Student Two','','student.two@demo.example.invalid','DEMO-BATCH-WEB','Active','2026-09-02','DEMO-COURSE-WEB','Web Foundations A'),
      ('DEMO-STUDENT-003','Demo Student Three','','student.three@demo.example.invalid','DEMO-BATCH-DATA','Active','2026-09-08','DEMO-COURSE-DATA','Data Foundations A'),
      ('DEMO-STUDENT-004','Demo Student Four','','student.four@demo.example.invalid','DEMO-BATCH-DATA','Pending','2026-09-09','DEMO-COURSE-DATA','Data Foundations A')
    ) as expected(id, name, phone, email, batch_id, status, joined_on, course_id, batch_name)
    join public.students s on s.id = expected.id
    where s.institute_id is distinct from 'INST-MAIN'
      or s.batch_id is distinct from expected.batch_id
      or s.course_id is distinct from expected.course_id
      or s.name is distinct from expected.name
      or s.phone is distinct from expected.phone
      or s.email is distinct from expected.email
      or s.status is distinct from expected.status
      or s.joined_on is distinct from expected.joined_on
      or s.batch_name is distinct from expected.batch_name
  ) then
    raise exception 'A demo student ID conflicts with an incompatible existing row';
  end if;
end;
$seed_guard$;

insert into public.sessions (id, institute_id, batch_id, date, start, "end") values
  ('DEMO-SESSION-WEB-01', 'INST-MAIN', 'DEMO-BATCH-WEB', '2026-10-14', '09:00', '11:00'),
  ('DEMO-SESSION-DATA-01', 'INST-MAIN', 'DEMO-BATCH-DATA', '2026-10-15', '14:00', '16:00')
on conflict (id) do nothing;
do $seed_guard$
begin
  if exists (
    select 1 from (values
      ('DEMO-SESSION-WEB-01','DEMO-BATCH-WEB','2026-10-14','09:00','11:00'),
      ('DEMO-SESSION-DATA-01','DEMO-BATCH-DATA','2026-10-15','14:00','16:00')
    ) as expected(id, batch_id, session_date, start_time, end_time)
    join public.sessions s on s.id = expected.id
    where s.institute_id is distinct from 'INST-MAIN'
      or s.batch_id is distinct from expected.batch_id
      or s.date is distinct from expected.session_date
      or s.start is distinct from expected.start_time
      or s."end" is distinct from expected.end_time
  ) then
    raise exception 'A demo session ID conflicts with an incompatible existing row';
  end if;
end;
$seed_guard$;

insert into public.attendance (id, institute_id, student_id, session_id, mode, status) values
  ('DEMO-ATTENDANCE-001', 'INST-MAIN', 'DEMO-STUDENT-001', 'DEMO-SESSION-WEB-01', 'classroom', 'Present'),
  ('DEMO-ATTENDANCE-002', 'INST-MAIN', 'DEMO-STUDENT-002', 'DEMO-SESSION-WEB-01', 'classroom', 'Late'),
  ('DEMO-ATTENDANCE-003', 'INST-MAIN', 'DEMO-STUDENT-003', 'DEMO-SESSION-DATA-01', 'hybrid', 'Present'),
  ('DEMO-ATTENDANCE-004', 'INST-MAIN', 'DEMO-STUDENT-004', 'DEMO-SESSION-DATA-01', 'hybrid', 'Absent')
on conflict (id) do nothing;
do $seed_guard$
begin
  if exists (
    select 1 from (values
      ('DEMO-ATTENDANCE-001','DEMO-STUDENT-001','DEMO-SESSION-WEB-01','classroom','Present'),
      ('DEMO-ATTENDANCE-002','DEMO-STUDENT-002','DEMO-SESSION-WEB-01','classroom','Late'),
      ('DEMO-ATTENDANCE-003','DEMO-STUDENT-003','DEMO-SESSION-DATA-01','hybrid','Present'),
      ('DEMO-ATTENDANCE-004','DEMO-STUDENT-004','DEMO-SESSION-DATA-01','hybrid','Absent')
    ) as expected(id, student_id, session_id, mode, status)
    join public.attendance a on a.id = expected.id
    where a.institute_id is distinct from 'INST-MAIN'
      or a.student_id is distinct from expected.student_id
      or a.session_id is distinct from expected.session_id
      or a.mode is distinct from expected.mode
      or a.status is distinct from expected.status
  ) then
    raise exception 'A demo attendance ID conflicts with an incompatible existing row';
  end if;
end;
$seed_guard$;

insert into public.assignments (id, institute_id, batch_id, title, due) values
  ('DEMO-ASSIGNMENT-WEB-01', 'INST-MAIN', 'DEMO-BATCH-WEB', 'Build a sample web page', '2026-10-28'),
  ('DEMO-ASSIGNMENT-DATA-01', 'INST-MAIN', 'DEMO-BATCH-DATA', 'Summarize a sample dataset', '2026-10-29')
on conflict (id) do nothing;
do $seed_guard$
begin
  if exists (
    select 1 from (values
      ('DEMO-ASSIGNMENT-WEB-01','DEMO-BATCH-WEB','Build a sample web page','2026-10-28'),
      ('DEMO-ASSIGNMENT-DATA-01','DEMO-BATCH-DATA','Summarize a sample dataset','2026-10-29')
    ) as expected(id, batch_id, title, due_date)
    join public.assignments a on a.id = expected.id
    where a.institute_id is distinct from 'INST-MAIN'
      or a.batch_id is distinct from expected.batch_id
      or a.title is distinct from expected.title
      or a.due is distinct from expected.due_date
  ) then
    raise exception 'A demo assignment ID conflicts with an incompatible existing row';
  end if;
end;
$seed_guard$;

insert into public.submissions (id, institute_id, assignment_id, student_id, submitted_at, score) values
  ('DEMO-SUBMISSION-001', 'INST-MAIN', 'DEMO-ASSIGNMENT-WEB-01', 'DEMO-STUDENT-001', '2026-10-16 10:00:00+00', 88),
  ('DEMO-SUBMISSION-002', 'INST-MAIN', 'DEMO-ASSIGNMENT-DATA-01', 'DEMO-STUDENT-003', '2026-10-16 12:00:00+00', 92)
on conflict (id) do nothing;
do $seed_guard$
begin
  if exists (
    select 1 from (values
      ('DEMO-SUBMISSION-001','DEMO-ASSIGNMENT-WEB-01','DEMO-STUDENT-001','2026-10-16 10:00:00+00'::timestamptz,88::numeric),
      ('DEMO-SUBMISSION-002','DEMO-ASSIGNMENT-DATA-01','DEMO-STUDENT-003','2026-10-16 12:00:00+00'::timestamptz,92::numeric)
    ) as expected(id, assignment_id, student_id, submitted_at, score)
    join public.submissions s on s.id = expected.id
    where s.institute_id is distinct from 'INST-MAIN'
      or s.assignment_id is distinct from expected.assignment_id
      or s.student_id is distinct from expected.student_id
      or s.submitted_at is distinct from expected.submitted_at
      or s.score is distinct from expected.score
  ) then
    raise exception 'A demo submission ID conflicts with an incompatible existing row';
  end if;
end;
$seed_guard$;

insert into public.recordings (id, institute_id, session_id, url, duration_min) values
  ('DEMO-RECORDING-WEB-01', 'INST-MAIN', 'DEMO-SESSION-WEB-01', 'https://media.example.invalid/demo/web-session-01', 120),
  ('DEMO-RECORDING-DATA-01', 'INST-MAIN', 'DEMO-SESSION-DATA-01', 'https://media.example.invalid/demo/data-session-01', 120)
on conflict (id) do nothing;
do $seed_guard$
begin
  if exists (
    select 1 from (values
      ('DEMO-RECORDING-WEB-01','DEMO-SESSION-WEB-01','https://media.example.invalid/demo/web-session-01',120),
      ('DEMO-RECORDING-DATA-01','DEMO-SESSION-DATA-01','https://media.example.invalid/demo/data-session-01',120)
    ) as expected(id, session_id, url, duration_min)
    join public.recordings r on r.id = expected.id
    where r.institute_id is distinct from 'INST-MAIN'
      or r.session_id is distinct from expected.session_id
      or r.url is distinct from expected.url
      or r.duration_min is distinct from expected.duration_min
  ) then
    raise exception 'A demo recording ID conflicts with an incompatible existing row';
  end if;
end;
$seed_guard$;

insert into public.fee_plans (id, institute_id, student_id, total, plan_type) values
  ('DEMO-FEE-PLAN-001', 'INST-MAIN', 'DEMO-STUDENT-001', 48000, 'two_instalments'),
  ('DEMO-FEE-PLAN-002', 'INST-MAIN', 'DEMO-STUDENT-002', 48000, 'full_payment'),
  ('DEMO-FEE-PLAN-003', 'INST-MAIN', 'DEMO-STUDENT-003', 52000, 'two_instalments'),
  ('DEMO-FEE-PLAN-004', 'INST-MAIN', 'DEMO-STUDENT-004', 52000, 'standard')
on conflict (id) do nothing;
do $seed_guard$
begin
  if exists (
    select 1 from (values
      ('DEMO-FEE-PLAN-001','DEMO-STUDENT-001',48000::numeric,'two_instalments'),
      ('DEMO-FEE-PLAN-002','DEMO-STUDENT-002',48000::numeric,'full_payment'),
      ('DEMO-FEE-PLAN-003','DEMO-STUDENT-003',52000::numeric,'two_instalments'),
      ('DEMO-FEE-PLAN-004','DEMO-STUDENT-004',52000::numeric,'standard')
    ) as expected(id, student_id, total, plan_type)
    join public.fee_plans f on f.id = expected.id
    where f.institute_id is distinct from 'INST-MAIN'
      or f.student_id is distinct from expected.student_id
      or f.total is distinct from expected.total
      or f.plan_type is distinct from expected.plan_type
  ) then
    raise exception 'A demo fee-plan ID conflicts with an incompatible existing row';
  end if;
end;
$seed_guard$;

insert into public.instalments (
  id, institute_id, student_id, due_date, amount, paid_amount, paid_on, status
) values
  ('DEMO-INSTALMENT-001-A', 'INST-MAIN', 'DEMO-STUDENT-001', '2026-09-15', 24000, 24000, '2026-09-14', 'paid'),
  ('DEMO-INSTALMENT-001-B', 'INST-MAIN', 'DEMO-STUDENT-001', '2026-11-15', 24000, 12000, '2026-10-10', 'pending'),
  ('DEMO-INSTALMENT-002-A', 'INST-MAIN', 'DEMO-STUDENT-002', '2026-09-15', 48000, 48000, '2026-09-12', 'paid'),
  ('DEMO-INSTALMENT-003-A', 'INST-MAIN', 'DEMO-STUDENT-003', '2026-09-22', 26000, 26000, '2026-09-20', 'paid'),
  ('DEMO-INSTALMENT-003-B', 'INST-MAIN', 'DEMO-STUDENT-003', '2026-11-22', 26000, 0, null, 'pending'),
  ('DEMO-INSTALMENT-004-A', 'INST-MAIN', 'DEMO-STUDENT-004', '2026-09-22', 52000, 0, null, 'overdue')
on conflict (id) do nothing;
do $seed_guard$
begin
  if exists (
    select 1 from (values
      ('DEMO-INSTALMENT-001-A','DEMO-STUDENT-001','2026-09-15',24000::numeric,24000::numeric,'2026-09-14','paid'),
      ('DEMO-INSTALMENT-001-B','DEMO-STUDENT-001','2026-11-15',24000::numeric,12000::numeric,'2026-10-10','pending'),
      ('DEMO-INSTALMENT-002-A','DEMO-STUDENT-002','2026-09-15',48000::numeric,48000::numeric,'2026-09-12','paid'),
      ('DEMO-INSTALMENT-003-A','DEMO-STUDENT-003','2026-09-22',26000::numeric,26000::numeric,'2026-09-20','paid'),
      ('DEMO-INSTALMENT-003-B','DEMO-STUDENT-003','2026-11-22',26000::numeric,0::numeric,null::text,'pending'),
      ('DEMO-INSTALMENT-004-A','DEMO-STUDENT-004','2026-09-22',52000::numeric,0::numeric,null::text,'overdue')
    ) as expected(id, student_id, due_date, amount, paid_amount, paid_on, status)
    join public.instalments i on i.id = expected.id
    where i.institute_id is distinct from 'INST-MAIN'
      or i.student_id is distinct from expected.student_id
      or i.due_date is distinct from expected.due_date
      or i.amount is distinct from expected.amount
      or i.paid_amount is distinct from expected.paid_amount
      or i.paid_on is distinct from expected.paid_on
      or i.status is distinct from expected.status
  ) then
    raise exception 'A demo instalment ID conflicts with an incompatible existing row';
  end if;
end;
$seed_guard$;

insert into public.payments (
  id, institute_id, student_id, instalment_id, amount, method, utr, received_on
) values
  ('DEMO-PAYMENT-001', 'INST-MAIN', 'DEMO-STUDENT-001', 'DEMO-INSTALMENT-001-A', 24000, 'bank_transfer', 'DEMO-REF-001', '2026-09-14'),
  ('DEMO-PAYMENT-002', 'INST-MAIN', 'DEMO-STUDENT-001', 'DEMO-INSTALMENT-001-B', 12000, 'card', 'DEMO-REF-002', '2026-10-10'),
  ('DEMO-PAYMENT-003', 'INST-MAIN', 'DEMO-STUDENT-002', 'DEMO-INSTALMENT-002-A', 48000, 'bank_transfer', 'DEMO-REF-003', '2026-09-12'),
  ('DEMO-PAYMENT-004', 'INST-MAIN', 'DEMO-STUDENT-003', 'DEMO-INSTALMENT-003-A', 26000, 'card', 'DEMO-REF-004', '2026-09-20')
on conflict (id) do nothing;
do $seed_guard$
begin
  if exists (
    select 1 from (values
      ('DEMO-PAYMENT-001','DEMO-STUDENT-001','DEMO-INSTALMENT-001-A',24000::numeric,'bank_transfer','DEMO-REF-001','2026-09-14'),
      ('DEMO-PAYMENT-002','DEMO-STUDENT-001','DEMO-INSTALMENT-001-B',12000::numeric,'card','DEMO-REF-002','2026-10-10'),
      ('DEMO-PAYMENT-003','DEMO-STUDENT-002','DEMO-INSTALMENT-002-A',48000::numeric,'bank_transfer','DEMO-REF-003','2026-09-12'),
      ('DEMO-PAYMENT-004','DEMO-STUDENT-003','DEMO-INSTALMENT-003-A',26000::numeric,'card','DEMO-REF-004','2026-09-20')
    ) as expected(id, student_id, instalment_id, amount, method, utr, received_on)
    join public.payments p on p.id = expected.id
    where p.institute_id is distinct from 'INST-MAIN'
      or p.student_id is distinct from expected.student_id
      or p.instalment_id is distinct from expected.instalment_id
      or p.amount is distinct from expected.amount
      or p.method is distinct from expected.method
      or p.utr is distinct from expected.utr
      or p.received_on is distinct from expected.received_on
  ) then
    raise exception 'A demo payment ID conflicts with an incompatible existing row';
  end if;
end;
$seed_guard$;

insert into public.approvals (id, institute_id, kind, payload, preview, requested_by) values
  ('DEMO-APPROVAL-001', 'INST-MAIN', 'attendance_review', '{"batch_id":"DEMO-BATCH-WEB","session_id":"DEMO-SESSION-WEB-01"}'::jsonb, 'Review demo attendance entries', 'DEMO-USER-TRAINER-01')
on conflict (id) do nothing;
do $seed_guard$
begin
  if exists (
    select 1 from public.approvals a
    where a.id = 'DEMO-APPROVAL-001'
      and (a.institute_id is distinct from 'INST-MAIN'
        or a.kind is distinct from 'attendance_review'
        or a.payload is distinct from '{"batch_id":"DEMO-BATCH-WEB","session_id":"DEMO-SESSION-WEB-01"}'::jsonb
        or a.preview is distinct from 'Review demo attendance entries'
        or a.requested_by is distinct from 'DEMO-USER-TRAINER-01'
        or a.status is distinct from 'pending')
  ) then
    raise exception 'A demo approval ID conflicts with an incompatible existing row';
  end if;
end;
$seed_guard$;

commit;
-- END SOURCE FILE: supabase/seed.sql
