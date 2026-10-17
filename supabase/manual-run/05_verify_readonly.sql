-- InstituteOS read-only verification: fictional demo rows and seed email domain
-- Prerequisites: the immediately preceding step committed successfully.
-- Check each returned row; stop if any required_ready value is false.
-- If it fails, stop and send the exact error before continuing.
begin;
set transaction read only;
select 'institutes' as relation_name, count(*) as expected_fixture_rows from public.institutes where id='INST-MAIN'
union all select 'users',count(*) from public.users where id like 'DEMO-USER-%'
union all select 'courses',count(*) from public.courses where id like 'DEMO-COURSE-%'
union all select 'trainers',count(*) from public.trainers where id like 'DEMO-TRAINER-%'
union all select 'students',count(*) from public.students where id like 'DEMO-STUDENT-%'
union all select 'attendance',count(*) from public.attendance where id like 'DEMO-ATTENDANCE-%';
select count(*) as demo_email_count,
       coalesce(bool_and(email ~* '\.invalid$'),true) as all_demo_emails_use_invalid_domain
from public.users where id like 'DEMO-USER-%';
select count(*) as demo_auth_links
from public.users where id like 'DEMO-USER-%' and auth_user_id is not null;
commit;