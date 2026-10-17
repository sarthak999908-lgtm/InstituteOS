-- Manual first-owner bootstrap template. Run only after the migrations, from a
-- trusted SQL editor as the database owner/postgres role. This never creates
-- an Auth account and must be filled with explicit, verified identifiers.
-- Replace every <...> placeholder before execution. Run the whole file at once.
begin;

do $provision_first_owner$
declare
  v_auth_id uuid := '<OWNER_AUTH_UUID>'::uuid;
  v_profile_id text := '<OWNER_PROFILE_ID>';
  v_institute_id text := '<INSTITUTE_ID>';
  v_display_name text := '<OWNER_DISPLAY_NAME>';
  v_email text;
  v_existing_role text;
  v_existing_auth_id uuid;
  v_existing_institute_id text;
begin
  if v_profile_id = '<OWNER_PROFILE_ID>' or v_institute_id = '<INSTITUTE_ID>'
     or v_display_name = '<OWNER_DISPLAY_NAME>' then
    raise exception 'Replace all first-owner template placeholders before running';
  end if;

  select a.email into v_email
  from auth.users a
  where a.id = v_auth_id;
  if not found or v_email is null or btrim(v_email) = '' then
    raise exception 'The supplied Auth UUID does not identify an existing Auth user with an email';
  end if;

  perform 1 from public.institutes i where i.id = v_institute_id for key share;
  if not found then
    raise exception 'The target institute does not exist';
  end if;

  if exists (
    select 1 from public.users u
    where u.auth_user_id = v_auth_id and u.id <> v_profile_id
  ) then
    raise exception 'The Auth UUID is already linked to a different profile';
  end if;

  if exists (
    select 1
    from public.users u
    join public.institute_members m on m.user_id = u.id
    where u.auth_user_id = v_auth_id and m.institute_id <> v_institute_id
  ) then
    raise exception 'The Auth UUID already has a membership in another institute';
  end if;

  select u.role, u.auth_user_id, u.institute_id
    into v_existing_role, v_existing_auth_id, v_existing_institute_id
  from public.users u
  where u.id = v_profile_id
  for update;

  if found then
    if v_existing_role <> 'owner'
       or v_existing_institute_id is distinct from v_institute_id
       or v_existing_auth_id is not null and v_existing_auth_id <> v_auth_id then
      raise exception 'The selected profile ID is already assigned to an incompatible row';
    end if;
    if v_existing_auth_id is null and not exists (
      select 1 from public.users u
      where u.id = v_profile_id and u.email = v_email
    ) then
      raise exception 'The unlinked profile email does not match the existing Auth email';
    end if;
    update public.users
      set auth_user_id = v_auth_id
      where id = v_profile_id and auth_user_id is null;
  else
    if exists (select 1 from public.users u where u.email = v_email) then
      raise exception 'The Auth email is already assigned to a different profile';
    end if;
    insert into public.users (id, institute_id, name, role, email, auth_user_id)
    values (v_profile_id, v_institute_id, v_display_name, 'owner', v_email, v_auth_id);
  end if;

  select m.role into v_existing_role
  from public.institute_members m
  where m.institute_id = v_institute_id and m.user_id = v_profile_id
  for update;
  if found and v_existing_role <> 'owner' then
    raise exception 'The target profile already has a non-owner membership in this institute';
  end if;

  insert into public.institute_members (institute_id, user_id, role)
  values (v_institute_id, v_profile_id, 'owner')
  on conflict (institute_id, user_id) do nothing;

  if not exists (
    select 1 from public.institute_members m
    where m.institute_id = v_institute_id
      and m.user_id = v_profile_id
      and m.role = 'owner'
  ) then
    raise exception 'The owner membership could not be verified';
  end if;
end;
$provision_first_owner$;

commit;
