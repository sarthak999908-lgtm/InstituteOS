# InstituteOS — Supabase Backend Guide

This guide describes the configuration expected by the current authenticated API. The browser and Express server use the Supabase project URL and public/anon key; Express verifies Supabase access tokens and uses a user-scoped client so database RLS applies.

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **"New Project"**.
3. Choose a name (e.g. `InstituteOS`) and set a strong database password.
4. Select your nearest region and click **"Create new project"** (takes ~1-2 minutes to provision).

---

## 2. Review and apply database migrations

Do not paste the schema or seed scripts into a live project as a substitute for reviewing the migration history. Review and apply the timestamped migrations in filename order: `20261017000000`, `20261017000001`, `20261017000002`, then `20261017000003`. Review them against the target project's current schema and policies and take a backup before any remote application. This repository's recent security migrations have **not** been applied to your remote project.

The `supabase/schema.sql` and `supabase/policies.sql` files are legacy reference scripts, not additional initialization steps. Use the ordered timestamped migrations only after review. `supabase/seed.sql` is optional fictional demo data and can only run after all migrations on an empty demo project; do not run it against a project with real records.

---

## 3. Configure Your Environment Variables

1. In Supabase, go to **Project Settings** (gear icon) ➔ **API**.
2. Copy the following:
   - **Project URL** (`https://xyzcompany.supabase.co`)
   - **anon / public** key
3. Create a `.env` file in the root of this project (you can copy `.env.example`):
   ```bash
   cp .env.example .env
   ```
4. Paste your public project values into `.env`:
   ```ini
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   PORT=5000
   ```
5. For audited sensitive server operations, configure `SUPABASE_SERVICE_ROLE_KEY`
   as a server-only environment variable. Keep it out of every `VITE_` variable,
   browser bundle, and frontend log. The server uses it only for append-only
   audit writes and the explicitly authorized approval/payment routes; those
   routes fail closed if the key or audit insert is unavailable.

---

## 4. Running the Backend

You can run the full-stack system in multiple ways:

### A. Run Full Stack (Frontend + Express API Server)
```bash
npm run dev:all
```
- **Frontend**: `http://localhost:5173`
- **Express Backend**: `http://localhost:5000`

### B. Run Frontend Only
```bash
npm run dev
```
Protected application data requires the Express API. The frontend uses Supabase Auth for sign-in and calls the backend for protected records; running only Vite does not provide the full application data flow.

### C. Run Backend Server Only
```bash
npm run server
```

---

## First login

Create the owner identity in Supabase Auth first, or use InstituteOS Register
and confirm the email. Registration creates only an Auth account; it does not
assign an institute or role. Copy the Auth user's UUID from the unlinked-account
screen or Supabase Auth, then ask a trusted operator to fill the UUID and
institute placeholders in
[`supabase/provisioning/01_first_owner.template.sql`](supabase/provisioning/01_first_owner.template.sql)
and run the template. After provisioning succeeds, sign in again. If the app
shows the unlinked-account screen, use **Copy my user ID** to provide the UUID
to the operator. Do not add a role or institute from the browser.

| Message | What to do |
| --- | --- |
| Wrong email or password, or this account does not exist yet. | Check the credentials, or create/confirm the Auth user first. |
| Please confirm your email first. Check your inbox. | Confirm the address, then sign in again. |
| Too many attempts. Please wait a few minutes. | Wait before another email or sign-in attempt; do not retry repeatedly. |
| Cannot reach the server. Check your connection. | Check network connectivity, then retry. |
| App configuration problem. Contact the administrator. | Ask an operator to check the Supabase URL and anon-key configuration; never share keys in chat. |
| Your account is not linked to an institute yet. Ask your administrator to link it. | Copy the Auth UUID and give it to a trusted operator to provision. |

## First Owner Bootstrap

Use an already-existing, authorized Supabase Auth account. A trusted database
owner/postgres operator should verify the Auth UUID and target institute, then
replace the placeholders in
[`supabase/provisioning/01_first_owner.template.sql`](supabase/provisioning/01_first_owner.template.sql)
and run the complete file once in the trusted SQL editor. The template checks
that the Auth user and institute exist, rejects a UUID or profile already
linked elsewhere, preserves compatible existing profiles, and adds only the
owner membership. It does not create Auth accounts. Do not execute it before
the migrations create the `auth_user_id` and membership schema.

Before mapping old records, a trusted database owner can run the read-only
[`supabase/provisioning/02_legacy_mapping_report.sql`](supabase/provisioning/02_legacy_mapping_report.sql).
It reports rows whose `institute_id` is null and trainers lacking an exact
same-institute Auth profile and trainer membership. Review results and map them
explicitly; no tenant or identity is inferred automatically.

For a first initialization, use this order on a disposable local or isolated
staging database:

1. Review and apply migrations `20261017000000`, `20261017000001`,
   `20261017000002`, and `20261017000003`, in that order.
2. Run `supabase test db` for the catalog contract checks. If the database has
   no linked Auth identity, run the role-behavior test after first-owner
   provisioning instead; do not manufacture a user for testing.
3. Run the first-owner template as the trusted database owner/postgres role.
4. Run the legacy mapping report as the trusted database owner, then resolve
   each row through an explicitly reviewed process.
5. On a clean demo database only, run `supabase/seed.sql` once. It inserts
   fictional `.invalid` public profiles and demo records but creates no Auth
   users. Its conflicts are guarded and the transaction aborts on incompatible
   fixture IDs.
6. Copy `supabase/tests/rls_behavior.template.sql` to
   `supabase/tests/rls_behavior_test.sql` and run `supabase test db` again if
   the database has a linked Auth identity. See
   [`supabase/tests/README.md`](supabase/tests/README.md).
7. Smoke-test each existing role in the application. Only after local/staging
   checks and a backup should anyone consider the real project.

Trainer batch access also requires an exact Auth UUID link on `public.trainers.auth_user_id` and a matching `trainer` membership for that same institute. This repository does not create Auth accounts or automatically promote the first registrant. Keep any administrative credentials in a trusted server-only environment; never print a service-role key or place one in a `VITE_` variable.

## Verification & API Endpoints

Once your server is running, `http://localhost:5000/api/health` reports server/configuration status only. Protected endpoints require a valid Supabase session and a database-backed membership. Assign roles through a trusted administrative process; signup metadata and browser requests cannot grant roles. Financial endpoints are restricted to Owner and Accounts roles. Trainer access to fees and payment records is denied.

The frontend and server require `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` (the server accepts these same project settings). A
service-role key is used only by the server-side audited routes and is never a
frontend setting. Never put it in a `VITE_` variable or browser code.
