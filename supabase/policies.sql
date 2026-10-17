-- LEGACY REFERENCE ONLY. Do not apply this script separately; use the ordered
-- timestamped migrations. Current authorization derives from institute_members.
create or replace function public.institute_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
$$;

create or replace function public.trainer_owns_batch(target_batch text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from batches b
    join trainers t on t.id::text = b.trainer_id::text
    join users u on lower(u.name) = lower(t.name)
    where b.id::text = target_batch
      and lower(u.email) = lower(auth.jwt() ->> 'email')
      and u.role = 'trainer'
  );
$$;

alter table public.students enable row level security;
alter table public.batches enable row level security;
alter table public.attendance enable row level security;
alter table public.sessions enable row level security;
alter table public.recordings enable row level security;
alter table public.instalments enable row level security;
alter table public.fee_plans enable row level security;
alter table public.payments enable row level security;
alter table public.approvals enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists students_owner on public.students;
create policy students_owner on public.students for select to authenticated
  using (public.institute_role() = 'owner');
drop policy if exists students_counselor on public.students;
create policy students_counselor on public.students for select to authenticated
  using (public.institute_role() = 'counselor');
drop policy if exists students_trainer_batch on public.students;
create policy students_trainer_batch on public.students for select to authenticated
  using (public.institute_role() = 'trainer' and public.trainer_owns_batch(batch_id::text));
drop policy if exists students_accounts on public.students;
create policy students_accounts on public.students for select to authenticated
  using (public.institute_role() = 'accounts');

drop policy if exists batches_scoped_read on public.batches;
create policy batches_scoped_read on public.batches for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'accounts')
    or (public.institute_role() = 'trainer' and public.trainer_owns_batch(id::text)));
drop policy if exists attendance_scoped_read on public.attendance;
create policy attendance_scoped_read on public.attendance for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'accounts')
    or (public.institute_role() = 'trainer' and exists (
      select 1 from sessions s where s.id::text = attendance.session_id::text and public.trainer_owns_batch(s.batch_id::text)
    )));
drop policy if exists sessions_scoped_read on public.sessions;
create policy sessions_scoped_read on public.sessions for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'accounts')
    or (public.institute_role() = 'trainer' and public.trainer_owns_batch(batch_id::text)));
drop policy if exists recordings_scoped_read on public.recordings;
create policy recordings_scoped_read on public.recordings for select to authenticated
  using (public.institute_role() in ('owner', 'counselor', 'accounts')
    or (public.institute_role() = 'trainer' and exists (
      select 1 from sessions s where s.id::text = recordings.session_id::text and public.trainer_owns_batch(s.batch_id::text)
    )));

drop policy if exists fees_owner_accounts on public.instalments;
create policy fees_owner_accounts on public.instalments for select to authenticated
  using (public.institute_role() in ('owner', 'accounts'));
drop policy if exists plans_owner_accounts on public.fee_plans;
create policy plans_owner_accounts on public.fee_plans for select to authenticated
  using (public.institute_role() in ('owner', 'accounts'));
drop policy if exists payments_owner_accounts on public.payments;
create policy payments_owner_accounts on public.payments for select to authenticated
  using (public.institute_role() in ('owner', 'accounts'));

create or replace view public.trainer_students
with (security_invoker = true)
as select s.id, s.name, s.batch_id, s.status, b.name as batch_name
from public.students s join public.batches b on b.id = s.batch_id
where public.institute_role() = 'trainer' and public.trainer_owns_batch(b.id::text);

create or replace view public.account_students
with (security_invoker = true)
as select s.id, s.name
from public.students s
where public.institute_role() = 'accounts';

create or replace view public.counselor_fee_summary
with (security_invoker = false)
as select c.name as course_name, i.status, i.due_date,
       count(i.id)::integer as instalment_count,
       sum(greatest(i.amount - i.paid_amount, 0)) as amount_due
from public.instalments i
join public.students s on s.id = i.student_id
join public.courses c on c.id = s.course_id
where public.institute_role() = 'counselor'
group by c.name, i.status, i.due_date;

drop policy if exists approvals_owner_accounts on public.approvals;
create policy approvals_owner_accounts on public.approvals for select to authenticated
  using (public.institute_role() in ('owner', 'accounts')
    or requested_by::text = (auth.jwt() -> 'app_metadata' ->> 'user_id'));
drop policy if exists audit_owner on public.audit_log;
create policy audit_owner on public.audit_log for select to authenticated
  using (public.institute_role() = 'owner');
drop policy if exists audit_insert_authenticated on public.audit_log;
revoke insert on public.audit_log from anon, authenticated;

grant select on public.trainer_students, public.account_students, public.counselor_fee_summary to authenticated;
