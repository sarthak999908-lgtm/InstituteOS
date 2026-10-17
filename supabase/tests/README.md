# Supabase migration and RLS test pack

These are local/isolated-database tests. Do not run them against the production
project. This work has not executed PostgreSQL or contacted Supabase.

## Order

1. Start a disposable local Supabase project and apply the timestamped
   migrations in filename order: `20261017000000`, `20261017000001`,
   `20261017000002`, then `20261017000003`.
2. Run `supabase test db` for `migration_contract_test.sql`. It checks catalog
   state, grants, RLS enablement, function execution privileges, view
   signatures, storage policy shape, and the storage folder path. It needs no
   application Auth users.
3. If the disposable database already has one legitimate Auth user linked to
   `public.users`, copy `rls_behavior.template.sql` to
   `supabase/tests/rls_behavior_test.sql` and run `supabase test db` again. The
   test temporarily uses that same linked Auth UUID while changing only its
   test-institute membership role (owner, counselor, trainer, accounts). The
   entire script is in a transaction and ends with `ROLLBACK`.
4. If no linked Auth user exists, do not create a fake account for these tests.
   First provision an existing authorized Auth identity with
   `provisioning/01_first_owner.template.sql`, then enable and run the role
   test. The first-owner template must be executed manually by a trusted DB
   owner after replacing all placeholders.
5. `rls_behavior_test.sql` creates two fictional institutes and related fixture
   rows. It aborts if its `IOS-RLS-*` fixture IDs are already present. It never
   inserts into `auth.users`; the transaction rollback removes all public
   fixtures and the temporary membership/profile changes.

## Coverage

`migration_contract_test.sql` checks the migration result as database metadata.
`rls_behavior.template.sql` exercises JWT claims, active institute selection,
cross-tenant reads and writes for all four roles, role-scoped views, trainer
batch ownership, student contact-column restrictions, fee visibility, audit
append-only grants, membership privacy, attendance batch constraints, and
anonymous/null-subject behavior. It also checks protected storage policy
catalog entries and the `studentId/category/file` path contract.

These tests do not prove production behavior unless executed against the
intended migration set and Supabase version. The behavior template uses a
pre-existing linked Auth UUID only; use an isolated local database.

## Seed idempotence and conflict check

On a fresh disposable database after migrations, run
`supabase/tests/seed_idempotence.psql` as a database owner. It applies the seed
twice in separate transactions and compares each captured fixture row. It is a
psql script, not part of `supabase test db`.

For the conflict case, use a disposable local database only:

1. Run the seed once.
2. Change `public.courses.name` for `DEMO-COURSE-WEB` to a deliberately
   incompatible marker value.
3. Run `supabase/seed.sql` with the SQL client configured to stop on errors.
   Expect the fixture conflict guard to raise an error and the seed transaction
   to roll back.
4. Verify the incompatible course row still has the marker and no other seed
   rows changed. Restore the course name to `Web Application Foundations`.

Never use these conflict steps against a shared or production database.
