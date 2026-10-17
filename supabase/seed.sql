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
