-- Read-only report. Run after migrations 0000-0003 as a trusted database
-- owner. It never changes or guesses tenant ownership or trainer identities.

select missing.relation_name, missing.row_id, missing.foreign_keys
from (
  select 'users'::text as relation_name, u.id::text as row_id,
         concat_ws(', ', 'auth_user_id=' || coalesce(u.auth_user_id::text, 'NULL')) as foreign_keys
  from public.users u where u.institute_id is null
  union all
  select 'courses', c.id::text, '' from public.courses c where c.institute_id is null
  union all
  select 'trainers', t.id::text, 'auth_user_id=' || coalesce(t.auth_user_id::text, 'NULL')
  from public.trainers t where t.institute_id is null
  union all
  select 'trainer_availability', a.id::text, 'trainer_id=' || a.trainer_id
  from public.trainer_availability a where a.institute_id is null
  union all
  select 'rooms', r.id::text, '' from public.rooms r where r.institute_id is null
  union all
  select 'batches', b.id::text,
         concat_ws(', ', 'course_id=' || coalesce(b.course_id, 'NULL'), 'trainer_id=' || coalesce(b.trainer_id, 'NULL'), 'room_id=' || coalesce(b.room_id, 'NULL'))
  from public.batches b where b.institute_id is null
  union all
  select 'students', s.id::text,
         concat_ws(', ', 'batch_id=' || coalesce(s.batch_id, 'NULL'), 'course_id=' || coalesce(s.course_id, 'NULL'))
  from public.students s where s.institute_id is null
  union all
  select 'sessions', s.id::text, 'batch_id=' || coalesce(s.batch_id, 'NULL')
  from public.sessions s where s.institute_id is null
  union all
  select 'attendance', a.id::text,
         concat_ws(', ', 'student_id=' || coalesce(a.student_id, 'NULL'), 'session_id=' || coalesce(a.session_id, 'NULL'))
  from public.attendance a where a.institute_id is null
  union all
  select 'assignments', a.id::text, 'batch_id=' || coalesce(a.batch_id, 'NULL')
  from public.assignments a where a.institute_id is null
  union all
  select 'submissions', s.id::text,
         concat_ws(', ', 'assignment_id=' || coalesce(s.assignment_id, 'NULL'), 'student_id=' || coalesce(s.student_id, 'NULL'))
  from public.submissions s where s.institute_id is null
  union all
  select 'fee_plans', f.id::text, 'student_id=' || coalesce(f.student_id, 'NULL')
  from public.fee_plans f where f.institute_id is null
  union all
  select 'instalments', i.id::text, 'student_id=' || coalesce(i.student_id, 'NULL')
  from public.instalments i where i.institute_id is null
  union all
  select 'payments', p.id::text,
         concat_ws(', ', 'student_id=' || coalesce(p.student_id, 'NULL'), 'instalment_id=' || coalesce(p.instalment_id, 'NULL'))
  from public.payments p where p.institute_id is null
  union all
  select 'recordings', r.id::text, 'session_id=' || coalesce(r.session_id, 'NULL')
  from public.recordings r where r.institute_id is null
  union all
  select 'approvals', a.id::text, 'requested_by=' || coalesce(a.requested_by, 'NULL')
  from public.approvals a where a.institute_id is null
  union all
  select 'audit_log', a.id::text, 'user_id=' || coalesce(a.user_id, 'NULL')
  from public.audit_log a where a.institute_id is null
) as missing
order by missing.relation_name, missing.row_id;

-- Rows can carry a non-null institute_id and still have a mismatched parent.
-- These are also unresolved ownership chains; this report does not repair them.
select conflict.relation_name, conflict.row_id, conflict.detail
from (
  select 'trainer_availability'::text as relation_name, a.id::text as row_id,
         'trainer institute=' || coalesce(t.institute_id, 'NULL') || ', row institute=' || coalesce(a.institute_id, 'NULL') as detail
  from public.trainer_availability a left join public.trainers t on t.id = a.trainer_id
  where t.id is null or t.institute_id is distinct from a.institute_id
  union all
  select 'batches', b.id::text,
         concat_ws(', ', 'course=' || coalesce(c.institute_id, 'NULL'), 'trainer=' || coalesce(t.institute_id, 'NULL'), 'room=' || coalesce(r.institute_id, 'NULL'))
  from public.batches b
  left join public.courses c on c.id = b.course_id
  left join public.trainers t on t.id = b.trainer_id
  left join public.rooms r on r.id = b.room_id
  where (b.course_id is not null and (c.id is null or c.institute_id is distinct from b.institute_id))
     or (b.trainer_id is not null and (t.id is null or t.institute_id is distinct from b.institute_id))
     or (b.room_id is not null and (r.id is null or r.institute_id is distinct from b.institute_id))
  union all
  select 'students', s.id::text,
         concat_ws(', ', 'batch=' || coalesce(b.institute_id, 'NULL'), 'course=' || coalesce(c.institute_id, 'NULL'))
  from public.students s
  left join public.batches b on b.id = s.batch_id
  left join public.courses c on c.id = s.course_id
  where (s.batch_id is not null and (b.id is null or b.institute_id is distinct from s.institute_id))
     or (s.course_id is not null and (c.id is null or c.institute_id is distinct from s.institute_id))
  union all
  select 'sessions', x.id::text, 'batch institute=' || coalesce(b.institute_id, 'NULL')
  from public.sessions x left join public.batches b on b.id = x.batch_id
  where x.batch_id is not null and (b.id is null or b.institute_id is distinct from x.institute_id)
  union all
  select 'attendance', a.id::text,
         concat_ws(', ', 'student institute=' || coalesce(s.institute_id, 'NULL'), 'session institute=' || coalesce(x.institute_id, 'NULL'), 'student batch=' || coalesce(s.batch_id, 'NULL'), 'session batch=' || coalesce(x.batch_id, 'NULL'))
  from public.attendance a
  left join public.students s on s.id = a.student_id
  left join public.sessions x on x.id = a.session_id
  where s.id is null or x.id is null
     or s.institute_id is distinct from a.institute_id
     or x.institute_id is distinct from a.institute_id
     or s.batch_id is distinct from x.batch_id
  union all
  select 'assignments', a.id::text, 'batch institute=' || coalesce(b.institute_id, 'NULL')
  from public.assignments a left join public.batches b on b.id = a.batch_id
  where a.batch_id is not null and (b.id is null or b.institute_id is distinct from a.institute_id)
  union all
  select 'submissions', x.id::text,
         concat_ws(', ', 'assignment institute=' || coalesce(a.institute_id, 'NULL'), 'student institute=' || coalesce(s.institute_id, 'NULL'))
  from public.submissions x
  left join public.assignments a on a.id = x.assignment_id
  left join public.students s on s.id = x.student_id
  where (x.assignment_id is not null and (a.id is null or a.institute_id is distinct from x.institute_id))
     or (x.student_id is not null and (s.id is null or s.institute_id is distinct from x.institute_id))
  union all
  select 'fee_plans', f.id::text, 'student institute=' || coalesce(s.institute_id, 'NULL')
  from public.fee_plans f left join public.students s on s.id = f.student_id
  where f.student_id is not null and (s.id is null or s.institute_id is distinct from f.institute_id)
  union all
  select 'instalments', i.id::text, 'student institute=' || coalesce(s.institute_id, 'NULL')
  from public.instalments i left join public.students s on s.id = i.student_id
  where i.student_id is not null and (s.id is null or s.institute_id is distinct from i.institute_id)
  union all
  select 'payments', p.id::text,
         concat_ws(', ', 'student institute=' || coalesce(s.institute_id, 'NULL'), 'instalment institute=' || coalesce(i.institute_id, 'NULL'))
  from public.payments p
  left join public.students s on s.id = p.student_id
  left join public.instalments i on i.id = p.instalment_id
  where (p.student_id is not null and (s.id is null or s.institute_id is distinct from p.institute_id))
     or (p.instalment_id is not null and (i.id is null or i.institute_id is distinct from p.institute_id))
  union all
  select 'recordings', r.id::text, 'session institute=' || coalesce(s.institute_id, 'NULL')
  from public.recordings r left join public.sessions s on s.id = r.session_id
  where r.session_id is not null and (s.id is null or s.institute_id is distinct from r.institute_id)
  union all
  select 'approvals', a.id::text, 'requester institute=' || coalesce(u.institute_id, 'NULL')
  from public.approvals a left join public.users u on u.id = a.requested_by
  where a.requested_by is not null and (u.id is null or u.institute_id is distinct from a.institute_id)
) as conflict
order by conflict.relation_name, conflict.row_id;

-- A trainer is usable by trainer_owns_batch() only with an exact Auth UUID and
-- same-institute profile/membership. This lists unresolved rows, not guesses.
select t.id as trainer_id,
       t.institute_id,
       t.auth_user_id::text as auth_user_id,
       u.id as linked_profile_id
from public.trainers t
left join public.users u
  on u.auth_user_id = t.auth_user_id
 and u.institute_id = t.institute_id
left join public.institute_members m
  on m.user_id = u.id
 and m.institute_id = t.institute_id
 and m.role = 'trainer'
where t.auth_user_id is null or u.id is null or m.user_id is null
order by t.institute_id nulls first, t.id;
