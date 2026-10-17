-- pgTAP contract checks. Run after migrations 0000-0003 on a disposable local
-- Supabase database. Role/tenant behavior checks are in rls_behavior.template.
begin;
set local search_path = public, extensions, storage, pg_catalog;
select no_plan();

select ok(
  not exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any (array[
        'institutes','users','institute_members','courses','trainers',
        'trainer_availability','rooms','batches','students','sessions',
        'attendance','assignments','submissions','fee_plans','instalments',
        'payments','recordings','approvals','audit_log'
      ])
      and not c.relrowsecurity
  ),
  'RLS is enabled on every tenant-owned table'
);

select ok(
  not has_table_privilege('anon', 'public.institute_members', 'SELECT')
  and not has_table_privilege('anon', 'public.institute_members', 'INSERT')
  and not has_table_privilege('anon', 'public.institute_members', 'UPDATE')
  and not has_table_privilege('anon', 'public.institute_members', 'DELETE')
  and not has_table_privilege('authenticated', 'public.institute_members', 'SELECT')
  and not has_table_privilege('authenticated', 'public.institute_members', 'INSERT')
  and not has_table_privilege('authenticated', 'public.institute_members', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.institute_members', 'DELETE')
  and not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'institute_members'
  ),
  'membership records have no direct browser access or policy'
);

select ok(
  not has_schema_privilege('anon', 'public', 'CREATE')
  and not has_schema_privilege('authenticated', 'public', 'CREATE')
  and not has_schema_privilege('service_role', 'public', 'CREATE'),
  'API roles cannot create objects in public'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_default_acl d
    cross join lateral pg_catalog.aclexplode(d.defaclacl) a
    where d.defaclrole = 'postgres'::regrole
      and (d.defaclnamespace = 'public'::regnamespace or d.defaclnamespace = 0)
      and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
      and (
        (d.defaclobjtype = 'r' and a.privilege_type in ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'))
        or (d.defaclobjtype = 'S' and a.privilege_type in ('USAGE','SELECT','UPDATE'))
        or (d.defaclobjtype = 'f' and a.privilege_type = 'EXECUTE')
      )
  )
  and not exists (
    select 1
    from pg_catalog.pg_default_acl d
    cross join lateral pg_catalog.aclexplode(d.defaclacl) a
    where d.defaclrole = 'postgres'::regrole
      and d.defaclnamespace = 0
      and d.defaclobjtype = 'f'
      and a.grantee = 0
      and a.privilege_type = 'EXECUTE'
  ),
  'future postgres-owned public objects do not inherit browser or PUBLIC privileges'
);

select ok(
  not has_table_privilege('anon', 'public.audit_log', 'INSERT')
  and not has_table_privilege('anon', 'public.audit_log', 'UPDATE')
  and not has_table_privilege('anon', 'public.audit_log', 'DELETE')
  and not has_table_privilege('authenticated', 'public.audit_log', 'INSERT')
  and not has_table_privilege('authenticated', 'public.audit_log', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.audit_log', 'DELETE')
  and has_table_privilege('service_role', 'public.audit_log', 'INSERT')
  and not has_table_privilege('service_role', 'public.audit_log', 'UPDATE')
  and not has_table_privilege('service_role', 'public.audit_log', 'DELETE'),
  'audit rows are append-only through the server service role'
);

select ok(
  not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'audit_log'
      and cmd in ('INSERT','UPDATE','DELETE','ALL')
  ),
  'no direct-client audit mutation policy survives'
);

select ok(
  has_function_privilege('authenticated', 'public.current_user_context()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.current_institute_id()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.institute_role()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.trainer_owns_batch(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.current_user_context()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.trainer_owns_batch(text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.record_payment_for_user(text,text,text,numeric,text,text,text,uuid,text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.record_payment_for_user(text,text,text,numeric,text,text,text,uuid,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_dashboard_telemetry()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.get_dashboard_telemetry()', 'EXECUTE'),
  'RPC execution grants match browser and server boundaries'
);

select ok(
  not exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'current_user_context','current_institute_id','institute_role',
        'trainer_owns_batch','is_active_trainer_auth_user',
        'attendance_matches_session_batch','enforce_attendance_batch_match',
        'prevent_trainer_relationship_changes','record_payment',
        'record_payment_for_user','get_dashboard_telemetry'
      ])
      and p.prosecdef
      and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path=pg_catalog%'
  ),
  'security-definer functions pin search_path to pg_catalog'
);

select ok(
  (select array_agg(a.attname order by a.attnum) from pg_catalog.pg_attribute a
    where a.attrelid = 'public.student_profiles'::regclass and a.attnum > 0 and not a.attisdropped)
    = array['id','name','phone','email','batch_id','status','joined_on','course_id','course_name','batch_name']::name[]
  and (select array_agg(a.attname order by a.attnum) from pg_catalog.pg_attribute a
    where a.attrelid = 'public.trainer_students'::regclass and a.attnum > 0 and not a.attisdropped)
    = array['id','name','batch_id','status','batch_name']::name[],
  'student and trainer view signatures preserve the established ordered columns'
);

select ok(
  not has_column_privilege('authenticated', 'public.students', 'email', 'SELECT')
  and not has_column_privilege('authenticated', 'public.students', 'phone', 'SELECT'),
  'student contact columns are not granted directly to browser roles'
);

select ok(
  not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd in ('UPDATE','DELETE','ALL')
  )
  and exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars: public read' and cmd = 'SELECT'
      and qual ilike '%bucket_id%avatars%'
  )
  and exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'documents: tenant read' and cmd = 'SELECT'
      and qual ilike '%current_institute_id%'
      and qual ilike '%id_proof%'
  ),
  'storage remains insert/read scoped with public avatars and private tenant documents'
);

select ok(
  storage.foldername('IOS-RLS-STUDENT/id_proof/proof.pdf')[1] = 'IOS-RLS-STUDENT'
  and storage.foldername('IOS-RLS-STUDENT/id_proof/proof.pdf')[2] = 'id_proof',
  'document storage path resolves studentId/category/file in the policy folders'
);

select finish();
rollback;
