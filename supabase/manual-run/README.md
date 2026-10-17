# InstituteOS manual initialization bundle

This folder is a local convenience package. Nothing here has been run against Supabase.

## Before starting

1. Read `00_preflight_readonly.sql` and run it on the intended project. Stop for an unexpected existing InstituteOS relation, any PostgreSQL version below 15, unknown grants/policies, or any result you cannot explain.
2. Review the reported `public.copilet` grants and policies. Do not proceed with that table until its owner/dependency is known and you choose an option in `10_copilet_decision_TEMPLATE.sql` yourself. The migration scripts do not alter it.
3. Run the five numbered initialization files one at a time in this exact order: base schema, fix policies, remove legacy policies, tenant/identity/RLS hardening, fictional demo seed. Run the matching `NN_verify_readonly.sql` after each step. Stop on any SQL error and send the exact error; do not continue after a failed transaction.
4. Finish with `99_final_security_checks_readonly.sql`.

Each numbered SQL source file is copied verbatim after its explanatory header from its matching migration or `supabase/seed.sql`. Each source has its own `BEGIN`/`COMMIT`; verifiers also use read-only transactions. The files contain no psql `\ir`/meta commands. I have not tested whether the hosted SQL Editor accepts explicit transaction-control statements in this setup; if it rejects them, stop and use the documented local Docker workflow rather than deleting transaction statements ad hoc.

## Local disposable database validation

Only in your own terminal after installing Docker and the Supabase CLI, and after confirming the CLI is targeting `127.0.0.1`, use the official local workflow:

```powershell
supabase start
supabase status
# Confirm the reported API/DB URLs are 127.0.0.1 before any reset/test.
supabase db reset
supabase test db
```

These commands are instructions only; this task did not run them. `supabase db reset` is destructive to the selected local database. Do not proceed unless the displayed endpoint is loopback and the database is disposable.

`supabase/tests/database/001_migration_contract_test.sql` is a pgTAP catalog/ACL contract suite. It needs local Supabase's pgTAP support and PostgreSQL execution. `supabase/tests/rls_behavior.template.sql` remains a separate role behavior template because it requires an already-authorized linked Auth identity; it never creates an Auth user. It must be reviewed against the current target and copied/run only in a disposable local test DB with an existing authorized identity. Static tests cannot establish RLS, storage or view runtime behavior.

## Manual SQL Editor use and migration history

Manual SQL Editor execution does not record the CLI migration history. After manually applying and independently validating the complete schema, make sure each remote migration actually corresponds to the applied SQL before using `supabase migration repair --status applied <timestamp>` for timestamps `20261017000000` through `20261017000003`. Do not use migration repair as a substitute for applying/verifying SQL. No repair or remote command was run here.

After successful database initialization, create the first Auth user in the Supabase dashboard, copy that existing user's UUID, fill the explicit placeholders in `supabase/provisioning/01_first_owner.template.sql`, and run that template as the database owner. Then run `supabase/provisioning/02_legacy_mapping_report.sql` and review every unresolved tenant/identity row before linking staff. Build the frontend locally, sign in with one existing account for each provisioned role, and smoke-test Copilot both with and without the configured provider key. Only after the schema was manually applied and verified should you mark timestamps `20261017000000`, `20261017000001`, `20261017000002`, and `20261017000003` as applied in migration history, before a later CLI push.

## Destructive cleanup

`ZZ_cleanup_DESTRUCTIVE.sql` is an opt-in cleanup script only for a disposable local database. It refuses to run unless two transaction-local confirmation settings are supplied and stops if either storage bucket contains objects. It drops only explicitly named InstituteOS views, tables, functions and storage policies, with no `CASCADE`; it never drops `public.copilet`, Auth users, extensions, schemas, storage buckets or storage files. Do not run it on production or a shared database.
