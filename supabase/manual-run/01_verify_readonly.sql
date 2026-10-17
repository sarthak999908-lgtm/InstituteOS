-- InstituteOS read-only verification: base schema objects
-- Prerequisites: the immediately preceding step committed successfully.
-- Check each returned row; stop if any required_ready value is false.
-- If it fails, stop and send the exact error before continuing.
begin;
set transaction read only;
with expected(relation_name) as (
  values ('institutes'),('users'),('institute_members'),('courses'),('trainers'),('trainer_availability'),
         ('rooms'),('batches'),('students'),('sessions'),('attendance'),('assignments'),('submissions'),
         ('fee_plans'),('instalments'),('payments'),('recordings'),('approvals'),('audit_log')
)
select e.relation_name, c.oid is not null as exists_now,
       coalesce(c.relrowsecurity,false) as rls_enabled
from expected e left join pg_catalog.pg_class c
  on c.relnamespace='public'::regnamespace and c.relname=e.relation_name
order by e.relation_name;
commit;