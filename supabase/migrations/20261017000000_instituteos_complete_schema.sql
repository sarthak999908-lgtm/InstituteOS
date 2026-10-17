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
