-- InstituteOS read-only verification: role views and their ordered columns
-- Prerequisites: the immediately preceding step committed successfully.
-- Check each returned row; stop if any required_ready value is false.
-- If it fails, stop and send the exact error before continuing.
begin;
set transaction read only;
select c.relname as view_name, a.attnum, a.attname, pg_catalog.format_type(a.atttypid,a.atttypmod) as data_type
from pg_catalog.pg_class c
join pg_catalog.pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
where c.relnamespace='public'::regnamespace and c.relkind='v'
  and c.relname in ('student_profiles','trainer_students','account_students','counselor_fee_summary','course_catalog','course_finance')
order by c.relname,a.attnum;
commit;