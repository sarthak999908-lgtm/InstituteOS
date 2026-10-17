-- Local/isolated Supabase role-behavior test template. It temporarily adds a
-- second institute membership to an already-linked Auth profile, switches the
-- membership role to exercise the role matrix, and rolls everything back.
-- It never creates Auth users. Read tests/README.md before copying this file to
-- supabase/tests/rls_behavior_test.sql and running `supabase test db`.
begin;
set local search_path = public, extensions, storage, pg_catalog;
select no_plan();

do $setup$
declare
  v_auth_id uuid;
  v_user_id text;
  v_trainer_id text;
begin
  select u.auth_user_id, u.id into v_auth_id, v_user_id
  from public.users u
  join public.institute_members m on m.user_id = u.id
  where u.auth_user_id is not null
  order by case when m.role = 'owner' then 0 else 1 end, u.id
  limit 1;
  if not found then
    raise exception 'Role tests require one existing Auth user already linked to a public.users profile; do not create an Auth user for this test';
  end if;
  if v_auth_id is null or v_user_id is null then
    raise exception 'No usable linked Auth profile was found';
  end if;
  if exists (
    select 1 from public.institutes where id like 'IOS-RLS-%'
    union all select 1 from public.users where id like 'IOS-RLS-%'
    union all select 1 from public.courses where id like 'IOS-RLS-%'
    union all select 1 from public.trainers where id like 'IOS-RLS-%'
    union all select 1 from public.rooms where id like 'IOS-RLS-%'
    union all select 1 from public.batches where id like 'IOS-RLS-%'
    union all select 1 from public.students where id like 'IOS-RLS-%'
    union all select 1 from public.sessions where id like 'IOS-RLS-%'
    union all select 1 from public.attendance where id like 'IOS-RLS-%'
    union all select 1 from public.assignments where id like 'IOS-RLS-%'
    union all select 1 from public.submissions where id like 'IOS-RLS-%'
    union all select 1 from public.fee_plans where id like 'IOS-RLS-%'
    union all select 1 from public.instalments where id like 'IOS-RLS-%'
    union all select 1 from public.payments where id like 'IOS-RLS-%'
    union all select 1 from public.recordings where id like 'IOS-RLS-%'
    union all select 1 from public.approvals where id like 'IOS-RLS-%'
    union all select 1 from public.audit_log where id like 'IOS-RLS-%'
  ) or exists (
    select 1 from public.trainer_availability
    where id in ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000b1')
  ) then
    raise exception 'IOS-RLS-* fixture IDs already exist; use a clean local test database';
  end if;

  perform pg_catalog.set_config('ios_test.auth_id', v_auth_id::text, true);
  perform pg_catalog.set_config('ios_test.user_id', v_user_id, true);

  insert into public.institutes (id, name, code, currency, timezone) values
    ('IOS-RLS-A','Fictional Test Institute A','IOS-RLS-A','INR','Asia/Kolkata'),
    ('IOS-RLS-B','Fictional Test Institute B','IOS-RLS-B','INR','Asia/Kolkata');
  update public.users set institute_id = 'IOS-RLS-A' where id = v_user_id;
  insert into public.institute_members (institute_id, user_id, role)
    values ('IOS-RLS-A', v_user_id, 'owner');
  insert into public.users (id, institute_id, name, role, email)
    values ('IOS-RLS-B-USER','IOS-RLS-B','Fictional Other Owner','owner','other.owner@instituteos.invalid');

  select t.id into v_trainer_id from public.trainers t where t.auth_user_id = v_auth_id;
  if found then
    update public.trainers set institute_id = 'IOS-RLS-A' where id = v_trainer_id;
  else
    v_trainer_id := 'IOS-RLS-A-TRAINER';
    insert into public.trainers (id, institute_id, auth_user_id, name, skills, weekly_hours_max)
    values (v_trainer_id, 'IOS-RLS-A', v_auth_id, 'Fictional Test Trainer', 'testing', 10);
  end if;
  perform pg_catalog.set_config('ios_test.trainer_id', v_trainer_id, true);

  insert into public.courses (id, institute_id, name, fee_total, duration_weeks) values
    ('IOS-RLS-A-COURSE','IOS-RLS-A','Fictional Course A',1000,4),
    ('IOS-RLS-B-COURSE','IOS-RLS-B','Fictional Course B',2000,8);
  insert into public.trainers (id, institute_id, name, skills, weekly_hours_max)
    values ('IOS-RLS-B-TRAINER','IOS-RLS-B','Fictional Other Trainer','testing',10);
  insert into public.rooms (id, institute_id, name, capacity) values
    ('IOS-RLS-A-ROOM','IOS-RLS-A','Room A',10),
    ('IOS-RLS-B-ROOM','IOS-RLS-B','Room B',10);
  insert into public.trainer_availability (id, institute_id, trainer_id, weekday, start, "end") values
    ('00000000-0000-4000-8000-0000000000a1','IOS-RLS-A',v_trainer_id,1,'09:00','10:00'),
    ('00000000-0000-4000-8000-0000000000b1','IOS-RLS-B','IOS-RLS-B-TRAINER',2,'10:00','11:00');
  insert into public.batches (
    id,institute_id,course_id,trainer_id,name,mode,start_date,slot_days,slot_start,slot_end,
    room_id,online_seat_limit,student_count,course_name,trainer_name
  ) values
    ('IOS-RLS-A-BATCH','IOS-RLS-A','IOS-RLS-A-COURSE',v_trainer_id,'Batch A','classroom','2026-10-01','[1]','09:00','10:00','IOS-RLS-A-ROOM',10,1,'Fictional Course A','Fictional Test Trainer'),
    ('IOS-RLS-B-BATCH','IOS-RLS-B','IOS-RLS-B-COURSE','IOS-RLS-B-TRAINER','Batch B','classroom','2026-10-02','[2]','10:00','11:00','IOS-RLS-B-ROOM',10,1,'Fictional Course B','Fictional Other Trainer');
  insert into public.students (id,institute_id,name,phone,email,batch_id,status,joined_on,course_id,batch_name) values
    ('IOS-RLS-A-STUDENT','IOS-RLS-A','Fictional Student A','000-TEST','student.a@instituteos.invalid','IOS-RLS-A-BATCH','Active','2026-10-01','IOS-RLS-A-COURSE','Batch A'),
    ('IOS-RLS-B-STUDENT','IOS-RLS-B','Fictional Student B','000-TEST','student.b@instituteos.invalid','IOS-RLS-B-BATCH','Active','2026-10-02','IOS-RLS-B-COURSE','Batch B');
  insert into public.sessions (id,institute_id,batch_id,date,start,"end") values
    ('IOS-RLS-A-SESSION','IOS-RLS-A','IOS-RLS-A-BATCH','2026-10-15','09:00','10:00'),
    ('IOS-RLS-B-SESSION','IOS-RLS-B','IOS-RLS-B-BATCH','2026-10-16','10:00','11:00');
  insert into public.attendance (id,institute_id,student_id,session_id,mode,status) values
    ('IOS-RLS-A-ATTENDANCE','IOS-RLS-A','IOS-RLS-A-STUDENT','IOS-RLS-A-SESSION','classroom','Present'),
    ('IOS-RLS-B-ATTENDANCE','IOS-RLS-B','IOS-RLS-B-STUDENT','IOS-RLS-B-SESSION','classroom','Present');
  insert into public.assignments (id,institute_id,batch_id,title,due) values
    ('IOS-RLS-A-ASSIGNMENT','IOS-RLS-A','IOS-RLS-A-BATCH','Assignment A','2026-10-30'),
    ('IOS-RLS-B-ASSIGNMENT','IOS-RLS-B','IOS-RLS-B-BATCH','Assignment B','2026-10-31');
  insert into public.submissions (id,institute_id,assignment_id,student_id,score) values
    ('IOS-RLS-A-SUBMISSION','IOS-RLS-A','IOS-RLS-A-ASSIGNMENT','IOS-RLS-A-STUDENT',80),
    ('IOS-RLS-B-SUBMISSION','IOS-RLS-B','IOS-RLS-B-ASSIGNMENT','IOS-RLS-B-STUDENT',90);
  insert into public.fee_plans (id,institute_id,student_id,total,plan_type) values
    ('IOS-RLS-A-FEE-PLAN','IOS-RLS-A','IOS-RLS-A-STUDENT',1000,'standard'),
    ('IOS-RLS-B-FEE-PLAN','IOS-RLS-B','IOS-RLS-B-STUDENT',2000,'standard');
  insert into public.instalments (id,institute_id,student_id,due_date,amount,paid_amount,status) values
    ('IOS-RLS-A-INSTALMENT','IOS-RLS-A','IOS-RLS-A-STUDENT','2026-11-01',1000,0,'pending'),
    ('IOS-RLS-B-INSTALMENT','IOS-RLS-B','IOS-RLS-B-STUDENT','2026-11-02',2000,0,'pending');
  insert into public.payments (id,institute_id,student_id,instalment_id,amount,method,utr,received_on) values
    ('IOS-RLS-A-PAYMENT','IOS-RLS-A','IOS-RLS-A-STUDENT','IOS-RLS-A-INSTALMENT',10,'bank_transfer','TEST-A','2026-10-10'),
    ('IOS-RLS-B-PAYMENT','IOS-RLS-B','IOS-RLS-B-STUDENT','IOS-RLS-B-INSTALMENT',20,'bank_transfer','TEST-B','2026-10-11');
  insert into public.recordings (id,institute_id,session_id,url,duration_min) values
    ('IOS-RLS-A-RECORDING','IOS-RLS-A','IOS-RLS-A-SESSION','https://media.example.invalid/a',60),
    ('IOS-RLS-B-RECORDING','IOS-RLS-B','IOS-RLS-B-SESSION','https://media.example.invalid/b',60);
  insert into public.approvals (id,institute_id,kind,payload,preview,requested_by) values
    ('IOS-RLS-A-APPROVAL','IOS-RLS-A','attendance_review','{}','Review A',v_user_id),
    ('IOS-RLS-B-APPROVAL','IOS-RLS-B','attendance_review','{}','Review B','IOS-RLS-B-USER');
  insert into public.audit_log (id,institute_id,user_id,role,event,detail) values
    ('IOS-RLS-A-AUDIT','IOS-RLS-A',v_user_id,'owner','test.event','{}'),
    ('IOS-RLS-B-AUDIT','IOS-RLS-B','IOS-RLS-B-USER','owner','test.event','{}');
end;
$setup$;

-- Owner: all reads remain limited to institute A and cross-tenant writes fail.
select pg_catalog.set_config('request.jwt.claims',
  pg_catalog.jsonb_build_object('sub',current_setting('ios_test.auth_id'),
    'app_metadata',pg_catalog.jsonb_build_object('institute_id','IOS-RLS-A'))::text,true);
set local role authenticated;
select is(public.current_institute_id(),'IOS-RLS-A','JWT selects the active institute');
select ok(
  not exists (select 1 from public.institutes where id='IOS-RLS-B')
  and not exists (select 1 from public.users where id='IOS-RLS-B-USER')
  and not exists (select 1 from public.courses where id='IOS-RLS-B-COURSE')
  and not exists (select 1 from public.trainers where id='IOS-RLS-B-TRAINER')
  and not exists (select 1 from public.trainer_availability where id='00000000-0000-4000-8000-0000000000b1')
  and not exists (select 1 from public.rooms where id='IOS-RLS-B-ROOM')
  and not exists (select 1 from public.batches where id='IOS-RLS-B-BATCH')
  and not exists (select 1 from public.students where id='IOS-RLS-B-STUDENT')
  and not exists (select 1 from public.sessions where id='IOS-RLS-B-SESSION')
  and not exists (select 1 from public.attendance where id='IOS-RLS-B-ATTENDANCE')
  and not exists (select 1 from public.assignments where id='IOS-RLS-B-ASSIGNMENT')
  and not exists (select 1 from public.submissions where id='IOS-RLS-B-SUBMISSION')
  and not exists (select 1 from public.fee_plans where id='IOS-RLS-B-FEE-PLAN')
  and not exists (select 1 from public.instalments where id='IOS-RLS-B-INSTALMENT')
  and not exists (select 1 from public.payments where id='IOS-RLS-B-PAYMENT')
  and not exists (select 1 from public.recordings where id='IOS-RLS-B-RECORDING')
  and not exists (select 1 from public.approvals where id='IOS-RLS-B-APPROVAL')
  and not exists (select 1 from public.audit_log where id='IOS-RLS-B-AUDIT'),
  'owner cannot read any of institute B table fixtures'
);
select ok(
  not exists (select 1 from public.student_profiles where id='IOS-RLS-B-STUDENT')
  and not exists (select 1 from public.trainer_students where id='IOS-RLS-B-STUDENT')
  and not exists (select 1 from public.account_students where id='IOS-RLS-B-STUDENT')
  and not exists (select 1 from public.counselor_fee_summary where course_name='Fictional Course B')
  and not exists (select 1 from public.course_catalog where id='IOS-RLS-B-COURSE')
  and not exists (select 1 from public.course_finance where id='IOS-RLS-B-COURSE'),
  'owner cannot read institute B through any application view'
);
select throws_ok($q$insert into public.students (id,institute_id,name,batch_id,status) values ('IOS-RLS-B-ATTACK','IOS-RLS-B','Unauthorized','IOS-RLS-B-BATCH','Active')$q$,
  '42501',null,'owner cannot insert a student into institute B');
select is((with changed as (update public.batches set name='ATTACKED' where id='IOS-RLS-B-BATCH' returning id) select count(*) from changed),0::bigint,
  'owner cannot update a row in institute B');
select throws_ok('select * from public.institute_members','42501',null,'owner cannot query membership internals directly');
select throws_ok($q$insert into public.audit_log(id,institute_id,event) values ('IOS-RLS-A-AUDIT-ATTACK','IOS-RLS-A','attack')$q$,
  '42501',null,'authenticated owner cannot insert audit rows');
select throws_ok('update public.audit_log set event=''changed'' where id=''IOS-RLS-A-AUDIT''','42501',null,
  'authenticated owner cannot update audit rows');
select throws_ok('delete from public.audit_log where id=''IOS-RLS-A-AUDIT''','42501',null,
  'authenticated owner cannot delete audit rows');
select throws_ok($q$insert into public.approvals(id,institute_id,kind,payload,requested_by) values ('IOS-RLS-A-APPROVAL-ATTACK','IOS-RLS-A','attendance_review','{}',current_setting('ios_test.user_id'))$q$,
  '42501',null,'approval writes must go through the audited server');
select is((with changed as (update public.attendance set status='Late' where id='IOS-RLS-A-ATTENDANCE' returning id) select count(*) from changed),1::bigint,
  'owner can mark one same-batch attendance row directly');
reset role;

-- Counselor: own-institute student view and fee summary, but no fee tables.
update public.institute_members set role='counselor' where institute_id='IOS-RLS-A' and user_id=current_setting('ios_test.user_id');
select pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',current_setting('ios_test.auth_id'),
  'app_metadata',pg_catalog.jsonb_build_object('institute_id','IOS-RLS-A'))::text,true);
set local role authenticated;
select is(public.institute_role(),'counselor','membership grants the counselor role');
select ok(
  not exists (select 1 from public.institutes where id='IOS-RLS-B')
  and not exists (select 1 from public.users where id='IOS-RLS-B-USER')
  and not exists (select 1 from public.courses where id='IOS-RLS-B-COURSE')
  and not exists (select 1 from public.trainers where id='IOS-RLS-B-TRAINER')
  and not exists (select 1 from public.trainer_availability where id='00000000-0000-4000-8000-0000000000b1')
  and not exists (select 1 from public.rooms where id='IOS-RLS-B-ROOM')
  and not exists (select 1 from public.batches where id='IOS-RLS-B-BATCH')
  and not exists (select 1 from public.students where id='IOS-RLS-B-STUDENT')
  and not exists (select 1 from public.sessions where id='IOS-RLS-B-SESSION')
  and not exists (select 1 from public.attendance where id='IOS-RLS-B-ATTENDANCE')
  and not exists (select 1 from public.assignments where id='IOS-RLS-B-ASSIGNMENT')
  and not exists (select 1 from public.submissions where id='IOS-RLS-B-SUBMISSION')
  and not exists (select 1 from public.fee_plans where id='IOS-RLS-B-FEE-PLAN')
  and not exists (select 1 from public.instalments where id='IOS-RLS-B-INSTALMENT')
  and not exists (select 1 from public.payments where id='IOS-RLS-B-PAYMENT')
  and not exists (select 1 from public.recordings where id='IOS-RLS-B-RECORDING')
  and not exists (select 1 from public.approvals where id='IOS-RLS-B-APPROVAL')
  and not exists (select 1 from public.audit_log where id='IOS-RLS-B-AUDIT'),
  'counselor cannot read any of institute B table fixtures'
);
select ok(exists (select 1 from public.student_profiles where id='IOS-RLS-A-STUDENT')
  and not exists (select 1 from public.student_profiles where id='IOS-RLS-B-STUDENT'),
  'counselor student profiles are scoped to institute A');
select ok(not exists (select 1 from public.trainer_students where id='IOS-RLS-B-STUDENT')
  and not exists (select 1 from public.account_students where id='IOS-RLS-B-STUDENT')
  and not exists (select 1 from public.counselor_fee_summary where course_name='Fictional Course B')
  and not exists (select 1 from public.course_catalog where id='IOS-RLS-B-COURSE')
  and not exists (select 1 from public.course_finance where id='IOS-RLS-B-COURSE'),
  'counselor cannot read institute B through any application view');
select ok(exists (select 1 from public.counselor_fee_summary where course_name='Fictional Course A')
  and not exists (select 1 from public.counselor_fee_summary where course_name='Fictional Course B')
  and not exists (select 1 from public.course_finance where id='IOS-RLS-A-COURSE')
  and not exists (select 1 from public.instalments where id='IOS-RLS-A-INSTALMENT'),
  'counselor receives only the tenant fee summary, not finance tables or course finance');
select throws_ok($q$insert into public.students (id,institute_id,name,batch_id,status) values ('IOS-RLS-B-COUNSELOR-ATTACK','IOS-RLS-B','Unauthorized','IOS-RLS-B-BATCH','Active')$q$,
  '42501',null,'counselor cannot write a student to institute B');
select is((with changed as (update public.batches set name='ATTACKED' where id='IOS-RLS-B-BATCH' returning id) select count(*) from changed),0::bigint,
  'counselor cannot update a row in institute B');
reset role;

-- Trainer: only the batch tied to the exact Auth UUID is visible; finance is denied.
update public.institute_members set role='trainer' where institute_id='IOS-RLS-A' and user_id=current_setting('ios_test.user_id');
select pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',current_setting('ios_test.auth_id'),
  'app_metadata',pg_catalog.jsonb_build_object('institute_id','IOS-RLS-A'))::text,true);
set local role authenticated;
select ok(public.trainer_owns_batch('IOS-RLS-A-BATCH')
  and not public.trainer_owns_batch('IOS-RLS-B-BATCH'),
  'trainer ownership is linked by Auth UUID and institute');
select ok(
  not exists (select 1 from public.institutes where id='IOS-RLS-B')
  and not exists (select 1 from public.users where id='IOS-RLS-B-USER')
  and not exists (select 1 from public.courses where id='IOS-RLS-B-COURSE')
  and not exists (select 1 from public.trainers where id='IOS-RLS-B-TRAINER')
  and not exists (select 1 from public.trainer_availability where id='00000000-0000-4000-8000-0000000000b1')
  and not exists (select 1 from public.rooms where id='IOS-RLS-B-ROOM')
  and not exists (select 1 from public.batches where id='IOS-RLS-B-BATCH')
  and not exists (select 1 from public.students where id='IOS-RLS-B-STUDENT')
  and not exists (select 1 from public.sessions where id='IOS-RLS-B-SESSION')
  and not exists (select 1 from public.attendance where id='IOS-RLS-B-ATTENDANCE')
  and not exists (select 1 from public.assignments where id='IOS-RLS-B-ASSIGNMENT')
  and not exists (select 1 from public.submissions where id='IOS-RLS-B-SUBMISSION')
  and not exists (select 1 from public.fee_plans where id='IOS-RLS-B-FEE-PLAN')
  and not exists (select 1 from public.instalments where id='IOS-RLS-B-INSTALMENT')
  and not exists (select 1 from public.payments where id='IOS-RLS-B-PAYMENT')
  and not exists (select 1 from public.recordings where id='IOS-RLS-B-RECORDING')
  and not exists (select 1 from public.approvals where id='IOS-RLS-B-APPROVAL')
  and not exists (select 1 from public.audit_log where id='IOS-RLS-B-AUDIT'),
  'trainer cannot read any of institute B table fixtures'
);
select ok(exists (select 1 from public.trainer_students where id='IOS-RLS-A-STUDENT')
  and not exists (select 1 from public.trainer_students where id='IOS-RLS-B-STUDENT'),
  'trainer sees only assigned students');
select ok(not exists (select 1 from public.student_profiles where id='IOS-RLS-B-STUDENT')
  and not exists (select 1 from public.account_students where id='IOS-RLS-B-STUDENT')
  and not exists (select 1 from public.counselor_fee_summary where course_name='Fictional Course B')
  and not exists (select 1 from public.course_catalog where id='IOS-RLS-B-COURSE')
  and not exists (select 1 from public.course_finance where id='IOS-RLS-B-COURSE'),
  'trainer cannot read institute B through any application view');
select ok(not exists (select 1 from public.fee_plans where id='IOS-RLS-A-FEE-PLAN')
  and not exists (select 1 from public.instalments where id='IOS-RLS-A-INSTALMENT')
  and not exists (select 1 from public.payments where id='IOS-RLS-A-PAYMENT')
  and not exists (select 1 from public.course_finance where id='IOS-RLS-A-COURSE'),
  'trainer cannot reach fee tables or finance views');
select throws_ok('select email from public.students where id=''IOS-RLS-A-STUDENT''','42501',null,
  'trainer cannot select student contact columns');
select throws_ok('update public.sessions set batch_id=''IOS-RLS-B-BATCH'' where id=''IOS-RLS-A-SESSION''','42501',null,
  'trainer cannot reassign a session to another batch');
select throws_ok('update public.sessions set institute_id=''IOS-RLS-B'' where id=''IOS-RLS-A-SESSION''','42501',null,
  'trainer cannot move a session to another institute');
select is((with changed as (update public.attendance set session_id='IOS-RLS-B-SESSION' where id='IOS-RLS-A-ATTENDANCE' returning id) select count(*) from changed),0::bigint,
  'trainer cannot directly update attendance or reassign its session');
select is((with changed as (update public.attendance set student_id='IOS-RLS-B-STUDENT' where id='IOS-RLS-A-ATTENDANCE' returning id) select count(*) from changed),0::bigint,
  'trainer cannot directly update attendance or reassign its student');
select throws_ok($q$insert into public.attendance(id,institute_id,student_id,session_id,status) values ('IOS-RLS-MISMATCH','IOS-RLS-A','IOS-RLS-A-STUDENT','IOS-RLS-B-SESSION','Present')$q$,
  '23514',null,'attendance trigger rejects a student and session from different batches');
select is((with changed as (update public.students set batch_id='IOS-RLS-B-BATCH' where id='IOS-RLS-A-STUDENT' returning id) select count(*) from changed),0::bigint,
  'trainer cannot move a student to a different batch');
select is((with changed as (update public.batches set trainer_id='IOS-RLS-B-TRAINER' where id='IOS-RLS-A-BATCH' returning id) select count(*) from changed),0::bigint,
  'trainer cannot reassign a batch to another trainer');
select is((with changed as (update public.trainers set auth_user_id=null where id=current_setting('ios_test.trainer_id') returning id) select count(*) from changed),0::bigint,
  'trainer cannot change the immutable Auth UUID relationship');
reset role;

-- Accounts: tenant finance is available; student contact fields remain denied.
update public.institute_members set role='accounts' where institute_id='IOS-RLS-A' and user_id=current_setting('ios_test.user_id');
select pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',current_setting('ios_test.auth_id'),
  'app_metadata',pg_catalog.jsonb_build_object('institute_id','IOS-RLS-A'))::text,true);
set local role authenticated;
select is(public.institute_role(),'accounts','membership grants the accounts role');
select ok(
  not exists (select 1 from public.institutes where id='IOS-RLS-B')
  and not exists (select 1 from public.users where id='IOS-RLS-B-USER')
  and not exists (select 1 from public.courses where id='IOS-RLS-B-COURSE')
  and not exists (select 1 from public.trainers where id='IOS-RLS-B-TRAINER')
  and not exists (select 1 from public.trainer_availability where id='00000000-0000-4000-8000-0000000000b1')
  and not exists (select 1 from public.rooms where id='IOS-RLS-B-ROOM')
  and not exists (select 1 from public.batches where id='IOS-RLS-B-BATCH')
  and not exists (select 1 from public.students where id='IOS-RLS-B-STUDENT')
  and not exists (select 1 from public.sessions where id='IOS-RLS-B-SESSION')
  and not exists (select 1 from public.attendance where id='IOS-RLS-B-ATTENDANCE')
  and not exists (select 1 from public.assignments where id='IOS-RLS-B-ASSIGNMENT')
  and not exists (select 1 from public.submissions where id='IOS-RLS-B-SUBMISSION')
  and not exists (select 1 from public.fee_plans where id='IOS-RLS-B-FEE-PLAN')
  and not exists (select 1 from public.instalments where id='IOS-RLS-B-INSTALMENT')
  and not exists (select 1 from public.payments where id='IOS-RLS-B-PAYMENT')
  and not exists (select 1 from public.recordings where id='IOS-RLS-B-RECORDING')
  and not exists (select 1 from public.approvals where id='IOS-RLS-B-APPROVAL')
  and not exists (select 1 from public.audit_log where id='IOS-RLS-B-AUDIT'),
  'accounts cannot read any of institute B table fixtures'
);
select ok(exists (select 1 from public.account_students where id='IOS-RLS-A-STUDENT')
  and not exists (select 1 from public.account_students where id='IOS-RLS-B-STUDENT')
  and exists (select 1 from public.course_finance where id='IOS-RLS-A-COURSE')
  and not exists (select 1 from public.course_finance where id='IOS-RLS-B-COURSE')
  and exists (select 1 from public.fee_plans where id='IOS-RLS-A-FEE-PLAN')
  and not exists (select 1 from public.fee_plans where id='IOS-RLS-B-FEE-PLAN'),
  'accounts sees its own limited student view and tenant finance');
select ok(not exists (select 1 from public.student_profiles where id='IOS-RLS-B-STUDENT')
  and not exists (select 1 from public.trainer_students where id='IOS-RLS-B-STUDENT')
  and not exists (select 1 from public.counselor_fee_summary where course_name='Fictional Course B')
  and not exists (select 1 from public.course_catalog where id='IOS-RLS-B-COURSE'),
  'accounts cannot read institute B through any application view');
select throws_ok('select email from public.students where id=''IOS-RLS-A-STUDENT''','42501',null,
  'accounts cannot select student contact columns');
select throws_ok($q$insert into public.students (id,institute_id,name,batch_id,status) values ('IOS-RLS-B-ACCOUNTS-ATTACK','IOS-RLS-B','Unauthorized','IOS-RLS-B-BATCH','Active')$q$,
  '42501',null,'accounts cannot write a student to institute B');
select is((with changed as (update public.batches set name='ATTACKED' where id='IOS-RLS-B-BATCH' returning id) select count(*) from changed),0::bigint,
  'accounts cannot update a row in institute B');
reset role;

-- Anonymous and null-subject contexts have no data access or helper privileges.
select pg_catalog.set_config('request.jwt.claims','{}',true);
set local role anon;
select throws_ok('select * from public.students','42501',null,'anonymous cannot read private application rows');
select throws_ok($q$insert into public.audit_log(id,event) values ('IOS-RLS-ANON-AUDIT','anon')$q$,
  '42501',null,'anonymous cannot insert audit rows');
select ok(not has_function_privilege('anon','public.current_user_context()','EXECUTE')
  and not has_function_privilege('anon','public.trainer_owns_batch(text)','EXECUTE'),
  'anonymous cannot execute membership or trainer helpers');
reset role;
set local role authenticated;
select ok(not exists (select 1 from public.current_user_context())
  and not public.trainer_owns_batch('IOS-RLS-A-BATCH')
  and not public.attendance_matches_session_batch('IOS-RLS-A','IOS-RLS-A-STUDENT','IOS-RLS-A-SESSION'),
  'a null auth.uid() grants no membership, trainer ownership, or attendance predicate');
reset role;

select finish();
rollback;
