-- ==============================================================================
-- InstituteOS — Complete Supabase PostgreSQL Schema & Security Infrastructure
-- ==============================================================================

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
  -- Trainer reads stay closed until the canonical migration installs immutable Auth IDs.
  select false;
$$;
revoke all on function public.trainer_owns_batch(text) from public, anon, authenticated;
grant execute on function public.trainer_owns_batch(text) to authenticated;

-- Enable RLS across all tables
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

-- Fail closed: no anonymous reads/writes and no broad policies.
drop policy if exists "Allow read on catalog" on public.courses;
drop policy if exists "Allow read on rooms" on public.rooms;
drop policy if exists "Allow read on trainers" on public.trainers;
drop policy if exists "Allow read on users" on public.users;
drop policy if exists students_owner on public.students;
drop policy if exists batches_read on public.batches;
drop policy if exists sessions_read on public.sessions;
drop policy if exists attendance_read on public.attendance;
drop policy if exists fee_plans_read on public.fee_plans;
drop policy if exists instalments_read on public.instalments;
drop policy if exists payments_read on public.payments;
drop policy if exists approvals_read on public.approvals;
drop policy if exists audit_log_read on public.audit_log;

create policy "catalog: authenticated read" on public.courses for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'trainer', 'accounts'));
create policy "rooms: authenticated read" on public.rooms for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'trainer', 'accounts'));
create policy "trainers: authenticated read" on public.trainers for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'trainer', 'accounts'));
create policy "users: owner or self read" on public.users for select to authenticated
  using (public.institute_role() = 'owner' or lower(email) = lower(auth.jwt() ->> 'email'));

create policy "students: owner counselor read" on public.students for select to authenticated
  using (public.institute_role() in ('owner', 'counselor'));
create policy "students: trainer assigned read" on public.students for select to authenticated
  using (public.institute_role() = 'trainer' and public.trainer_owns_batch(batch_id));
create policy "students: accounts name read" on public.students for select to authenticated
  using (public.institute_role() = 'accounts');
create policy "students: owner counselor insert" on public.students for insert to authenticated
  with check (public.institute_role() in ('owner', 'counselor'));
create policy "students: owner counselor update" on public.students for update to authenticated
  using (public.institute_role() in ('owner', 'counselor'))
  with check (public.institute_role() in ('owner', 'counselor'));
create policy "students: owner delete" on public.students for delete to authenticated
  using (public.institute_role() = 'owner');

create policy "batches: scoped read" on public.batches for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'accounts')
    or (public.institute_role() = 'trainer' and public.trainer_owns_batch(id)));
create policy "batches: owner counselor write" on public.batches for insert to authenticated
  with check (public.institute_role() in ('owner', 'counselor'));
create policy "batches: owner counselor update" on public.batches for update to authenticated
  using (public.institute_role() in ('owner', 'counselor'))
  with check (public.institute_role() in ('owner', 'counselor'));
create policy "batches: owner delete" on public.batches for delete to authenticated
  using (public.institute_role() = 'owner');

create policy "sessions: scoped read" on public.sessions for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'accounts')
    or (public.institute_role() = 'trainer' and public.trainer_owns_batch(batch_id)));
create policy "sessions: owner counselor insert" on public.sessions for insert to authenticated
  with check (public.institute_role() in ('owner', 'counselor'));
create policy "sessions: owner counselor update" on public.sessions for update to authenticated
  using (public.institute_role() in ('owner', 'counselor'))
  with check (public.institute_role() in ('owner', 'counselor'));
create policy "sessions: owner delete" on public.sessions for delete to authenticated
  using (public.institute_role() = 'owner');

create policy "attendance: scoped read" on public.attendance for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'accounts') or exists (
    select 1 from public.sessions s where s.id = session_id
      and public.institute_role() = 'trainer' and public.trainer_owns_batch(s.batch_id)
  ));
create policy "attendance: owner trainer insert" on public.attendance for insert to authenticated
  with check (public.institute_role() = 'owner' or exists (
    select 1 from public.sessions s where s.id = session_id
      and public.institute_role() = 'trainer' and public.trainer_owns_batch(s.batch_id)
  ));
create policy "attendance: owner trainer update" on public.attendance for update to authenticated
  using (public.institute_role() = 'owner' or exists (
    select 1 from public.sessions s where s.id = session_id
      and public.institute_role() = 'trainer' and public.trainer_owns_batch(s.batch_id)
  ))
  with check (public.institute_role() = 'owner' or exists (
    select 1 from public.sessions s where s.id = session_id
      and public.institute_role() = 'trainer' and public.trainer_owns_batch(s.batch_id)
  ));

create policy "assignments: scoped read" on public.assignments for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'accounts')
    or (public.institute_role() = 'trainer' and public.trainer_owns_batch(batch_id)));
create policy "assignments: owner trainer write" on public.assignments for insert to authenticated
  with check (public.institute_role() = 'owner' or (public.institute_role() = 'trainer' and public.trainer_owns_batch(batch_id)));
create policy "submissions: scoped read" on public.submissions for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'accounts') or exists (
    select 1 from public.assignments a where a.id = assignment_id
      and public.institute_role() = 'trainer' and public.trainer_owns_batch(a.batch_id)
  ));
create policy "submissions: owner trainer insert" on public.submissions for insert to authenticated
  with check (public.institute_role() = 'owner' or exists (
    select 1 from public.assignments a where a.id = assignment_id
      and public.institute_role() = 'trainer' and public.trainer_owns_batch(a.batch_id)
  ));

create policy "recordings: scoped read" on public.recordings for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'accounts') or exists (
    select 1 from public.sessions s where s.id = session_id
      and public.institute_role() = 'trainer' and public.trainer_owns_batch(s.batch_id)
  ));
create policy "recordings: owner trainer insert" on public.recordings for insert to authenticated
  with check (public.institute_role() = 'owner' or exists (
    select 1 from public.sessions s where s.id = session_id
      and public.institute_role() = 'trainer' and public.trainer_owns_batch(s.batch_id)
  ));

create policy "availability: authenticated read" on public.trainer_availability for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'trainer', 'accounts'));
create policy "availability: owner write" on public.trainer_availability for all to authenticated
  using (public.institute_role() = 'owner') with check (public.institute_role() = 'owner');

create policy "fee_plans: finance only" on public.fee_plans for all to authenticated
  using (public.institute_role() in ('owner', 'accounts'))
  with check (public.institute_role() in ('owner', 'accounts'));
create policy "instalments: finance only" on public.instalments for all to authenticated
  using (public.institute_role() in ('owner', 'accounts'))
  with check (public.institute_role() in ('owner', 'accounts'));
create policy "payments: finance only" on public.payments for select to authenticated
  using (public.institute_role() in ('owner', 'accounts'));
create policy "payments: finance insert" on public.payments for insert to authenticated
  with check (public.institute_role() in ('owner', 'accounts'));

create policy "approvals: scoped read" on public.approvals for select to authenticated
  using (public.institute_role() = 'owner'
    or (public.institute_role() = 'accounts' and kind in ('fee_reconciliation', 'fee_action'))
    or requested_by::text = auth.uid()::text);
create policy "approvals: permitted request" on public.approvals for insert to authenticated
  with check (requested_by::text = auth.uid()::text and (
    public.institute_role() in ('owner', 'counselor')
    or (public.institute_role() = 'trainer' and kind like 'attendance_%')
    or (public.institute_role() = 'accounts' and kind in ('fee_reconciliation', 'fee_action'))
  ));
create policy "approvals: authorized decide" on public.approvals for update to authenticated
  using (public.institute_role() = 'owner'
    or (public.institute_role() = 'accounts' and kind in ('fee_reconciliation', 'fee_action')))
  with check (public.institute_role() = 'owner'
    or (public.institute_role() = 'accounts' and kind in ('fee_reconciliation', 'fee_action')));
create policy "audit: owner read" on public.audit_log for select to authenticated
  using (public.institute_role() = 'owner');
-- Audit rows must not be forgeable by browser clients. Remote appends are
-- unavailable until a trusted server-side writer is implemented.
revoke insert on public.audit_log from anon, authenticated;

-- Restrict base-table columns; privileged details are exposed via role-filtered views.
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
  
  select round(
    (count(*) filter (where status in ('Present', 'Late'))::numeric / nullif(count(*), 0)::numeric) * 100,
    1
  ) into v_attendance_pct from public.attendance;

  select coalesce(sum(greatest(amount - paid_amount, 0)), 0)
  into v_pending_fees from public.instalments where status != 'paid';

  select count(*) into v_overdue_count from public.instalments where status = 'overdue';

  return jsonb_build_object(
    'totalStudents', coalesce(v_total_students, 0),
    'activeBatches', coalesce(v_active_batches, 0),
    'attendancePercentage', v_attendance_pct,
    'pendingFees', coalesce(v_pending_fees, 0),
    'overdueInstalments', coalesce(v_overdue_count, 0)
  );
end;
$$;
revoke all on function public.get_dashboard_telemetry() from public, anon, authenticated;

-- ==============================================================================
-- 21. File Storage Buckets Configuration (Avatars & Documents)
-- ==============================================================================
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('documents', 'documents', false)
on conflict (id) do update set public = excluded.public;

-- Public can view avatars
create policy "avatars: public read" on storage.objects
  for select using (bucket_id = 'avatars');

-- Authenticated users can upload avatars (max 5MB, images only)
create policy "avatars: authenticated upload" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
  );

-- Student documents are private: owners/counselors can manage all documents;
-- trainers can access academic documents only for students in assigned batches.
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
