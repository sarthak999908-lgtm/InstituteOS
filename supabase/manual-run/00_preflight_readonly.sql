-- InstituteOS manual initialization preflight. Read-only; this changes no rows or schema.
-- Prerequisites: run against the intended target with a role allowed to inspect catalogs.
-- Check: PostgreSQL 15+, expected extensions, current public objects/RLS/policies,
-- and any pre-existing public.copilet grants/policies. Do not continue on surprises.
-- If it fails, stop and send the exact error before continuing.
begin;
set transaction read only;

select current_setting('server_version') as server_version,
       current_setting('server_version_num')::integer >= 150000 as postgresql_15_or_later;

select e.extname as installed_extension, e.extversion
from pg_catalog.pg_extension e
where e.extname in ('uuid-ossp','pgcrypto','pg_tap','pgtap')
order by e.extname;

with expected(relation_name) as (
  values ('institutes'),('users'),('institute_members'),('courses'),('trainers'),
         ('trainer_availability'),('rooms'),('batches'),('students'),('sessions'),
         ('attendance'),('assignments'),('submissions'),('fee_plans'),('instalments'),
         ('payments'),('recordings'),('approvals'),('audit_log')
)
select e.relation_name,
       c.oid is not null as exists_now,
       coalesce(c.relrowsecurity, false) as rls_enabled,
       (select count(*) from pg_catalog.pg_policies p
        where p.schemaname='public' and p.tablename=e.relation_name) as policy_count
from expected e
left join pg_catalog.pg_class c on c.relnamespace='public'::regnamespace and c.relname=e.relation_name
order by e.relation_name;

select obj.name, pg_catalog.to_regclass('public.' || obj.name) is not null as exists_now
from (values ('student_profiles'),('trainer_students'),('account_students'),
             ('counselor_fee_summary'),('course_catalog'),('course_finance'),('copilet')) obj(name)
order by obj.name;

select p.policyname, p.cmd, p.roles, p.qual, p.with_check
from pg_catalog.pg_policies p
where p.schemaname='public' and p.tablename='copilet'
order by p.policyname;

select c.relname,
       coalesce(pg_catalog.array_agg(distinct
         case when a.grantee=0 then 'PUBLIC:' || a.privilege_type
              else a.grantee::regrole::text || ':' || a.privilege_type end)
         filter (where a.grantee in ('anon'::regrole,'authenticated'::regrole) or a.grantee = 0),
         array[]::text[]) as browser_and_public_privileges
from pg_catalog.pg_class c
cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) a
where c.relnamespace='public'::regnamespace and c.relname='copilet'
group by c.relname;

select n.nspname, c.relname, c.relkind, c.relrowsecurity,
       count(p.policyname) as policy_count
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
left join pg_catalog.pg_policies p on p.schemaname=n.nspname and p.tablename=c.relname
where n.nspname='public' and c.relkind in ('r','p','v','m')
group by n.nspname,c.relname,c.relkind,c.relrowsecurity
order by c.relname;

commit;
