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
