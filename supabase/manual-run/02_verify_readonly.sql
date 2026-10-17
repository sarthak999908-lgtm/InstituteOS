-- InstituteOS read-only verification: first RLS policy pass
-- Prerequisites: the immediately preceding step committed successfully.
-- Check each returned row; stop if any required_ready value is false.
-- If it fails, stop and send the exact error before continuing.
begin;
set transaction read only;
select t.relname, t.relrowsecurity as rls_enabled,
       (select count(*) from pg_catalog.pg_policies p where p.schemaname='public' and p.tablename=t.relname) as policy_count
from pg_catalog.pg_class t
where t.relnamespace='public'::regnamespace and t.relkind in ('r','p')
  and t.relname in ('institutes','users','students','batches','sessions','attendance','fee_plans','instalments','payments','approvals','audit_log')
order by t.relname;
commit;