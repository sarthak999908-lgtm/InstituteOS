-- Final read-only checks after all five initialization steps.
-- Prerequisites: steps 01-05 and their verification files completed successfully.
-- Check: review any false/true violation rows and compare the copilet inventory with the decision you made.
-- This script does not mutate schema/data. If it fails, stop and send the exact error.
begin;
set transaction read only;

select c.relname, c.relrowsecurity as rls_enabled,
       (select count(*) from pg_catalog.pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policy_count
from pg_catalog.pg_class c
where c.relnamespace='public'::regnamespace and c.relkind in ('r','p')
  and c.relname in ('institutes','users','institute_members','courses','trainers','trainer_availability','rooms','batches','students','sessions','attendance','assignments','submissions','fee_plans','instalments','payments','recordings','approvals','audit_log')
order by c.relname;

select p.schemaname,p.tablename,p.policyname,p.cmd,p.roles,p.qual,p.with_check
from pg_catalog.pg_policies p
where p.schemaname in ('public','storage')
order by p.schemaname,p.tablename,p.policyname;

select p.schemaname,p.tablename,p.policyname,p.cmd,p.roles,p.qual,p.with_check
from pg_catalog.pg_policies p
where p.schemaname in ('public','storage')
  and (p.cmd='ALL' or 'anon'=any(p.roles) or p.qual ilike '%true%' or p.with_check ilike '%true%')
order by p.schemaname,p.tablename,p.policyname;

select c.relname,
       coalesce(pg_catalog.array_agg(distinct
         case when a.grantee=0 then 'PUBLIC:' || a.privilege_type
              else a.grantee::regrole::text || ':' || a.privilege_type end),
         array[]::text[]) as effective_acl
from pg_catalog.pg_class c
cross join lateral pg_catalog.aclexplode(coalesce(
  c.relacl,
  pg_catalog.acldefault((case when c.relkind='S' then 'S' else 'r' end)::"char",c.relowner)
)) a
where c.relnamespace='public'::regnamespace
  and c.relkind in ('r','p','v','m','S')
group by c.relname
order by c.relname;

select p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
       case when a.grantee=0 then 'PUBLIC' else a.grantee::regrole::text end as grantee,
       a.privilege_type
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
cross join lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
where n.nspname='public'
  and p.proname in ('current_user_context','current_institute_id','institute_role','trainer_owns_batch',
                    'is_active_trainer_auth_user','attendance_matches_session_batch','enforce_attendance_batch_match',
                    'prevent_trainer_relationship_changes','record_payment','record_payment_for_user','get_dashboard_telemetry')
order by p.proname,arguments,grantee;

select d.defaclrole::regrole::text as owner_role,
       case when d.defaclnamespace=0 then null else d.defaclnamespace::regnamespace::text end as schema_name,
       d.defaclobjtype,
       case when a.grantee=0 then 'PUBLIC' else a.grantee::regrole::text end as grantee,
       a.privilege_type
from pg_catalog.pg_default_acl d
cross join lateral pg_catalog.aclexplode(d.defaclacl) a
where d.defaclrole='postgres'::regrole
  and (d.defaclnamespace='public'::regnamespace or d.defaclnamespace=0)
order by owner_role,schema_name,d.defaclobjtype,grantee,privilege_type;

select has_table_privilege('anon','public.audit_log','INSERT') as anon_audit_insert,
       has_table_privilege('authenticated','public.audit_log','INSERT') as authenticated_audit_insert,
       has_table_privilege('service_role','public.audit_log','INSERT') as service_role_audit_insert,
       has_table_privilege('authenticated','public.institute_members','SELECT') as authenticated_members_read,
       has_schema_privilege('anon','public','CREATE') as anon_public_create,
       has_schema_privilege('authenticated','public','CREATE') as authenticated_public_create;

select p.proname,
       p.prosecdef as security_definer,
       coalesce(array_to_string(p.proconfig,','),'') as function_settings,
       pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') as anon_can_execute,
       pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_can_execute
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('current_user_context','current_institute_id','institute_role','trainer_owns_batch','record_payment','record_payment_for_user','get_dashboard_telemetry')
order by p.proname;

select c.relname as copilet_exists,
       c.relrowsecurity as copilet_rls_enabled,
       (select count(*) from pg_catalog.pg_policies p where p.schemaname='public' and p.tablename='copilet') as copilet_policy_count
from pg_catalog.pg_class c
where c.relnamespace='public'::regnamespace and c.relname='copilet';

commit;
