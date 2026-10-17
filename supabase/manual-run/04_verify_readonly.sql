-- InstituteOS read-only verification: final tenant hardening and grants
-- Prerequisites: the immediately preceding step committed successfully.
-- Check each returned row; stop if any required_ready value is false.
-- If it fails, stop and send the exact error before continuing.
begin;
set transaction read only;
select c.relname, c.relrowsecurity as rls_enabled
from pg_catalog.pg_class c
where c.relnamespace='public'::regnamespace and c.relkind in ('r','p')
  and c.relname in ('institutes','users','institute_members','courses','trainers','trainer_availability','rooms','batches','students','sessions','attendance','assignments','submissions','fee_plans','instalments','payments','recordings','approvals','audit_log')
order by c.relname;
select p.proname, p.prosecdef,
       coalesce(array_to_string(p.proconfig,','),'') as function_settings,
       pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') as anon_can_execute,
       pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_can_execute
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('current_user_context','current_institute_id','institute_role','trainer_owns_batch','record_payment','record_payment_for_user','get_dashboard_telemetry')
order by p.proname;
select tablename,policyname,cmd,roles,qual,with_check
from pg_catalog.pg_policies where schemaname='storage' and tablename='objects'
order by policyname;
commit;