# InstituteOS

InstituteOS is a TechSummitTrainers institute operations demo built with React and Vite. The workspace includes Dashboard, Students, Batches, Attendance, Fees, Schedules, Reports, Settings, and an operations Copilot.

## Run Locally

```sh
npm install
copy .env.example .env
npm run dev:all
```

The application requires Supabase Auth. Protected backend routes deny requests without a verified Supabase access token and an `institute_members` record linked to the Auth user through `public.users.auth_user_id`. Registration does not grant a staff role. The backend listens on port 5000 and Vite on port 5173.

```sh
npm run build
npm run test
npm run lint
```

## Local Demo Data

To open a clearly labeled, fictional local demo during development, visit `http://localhost:5173/?demo=local` (or add `?demo=local` to your current Vite URL). This route is available only in Vite development builds. It skips session restore, does not initialize the Supabase client, and routes API-shaped reads and writes to local fixtures; no Supabase or Express API requests are sent. Demo browser data uses a separate local-storage namespace. Exit the demo to return to the normal sign-in screen. Production builds do not enable this route.

Outside that explicit development route, the application requires Supabase Auth. If Supabase is missing or unavailable, the protected app remains inaccessible and live data requests fail visibly. The browser SQLite database and mock data also remain for local-only tests and legacy previews.

Legacy browser SQLite utilities still exist in the repository, but protected live requests use the authenticated API. The browser role selector has been removed; user interface state does not grant backend access.

## Intended Role Matrix (local policy design; not live-tested)

| Capability | Owner | Counselor | Trainer | Accounts |
| --- | --- | --- | --- | --- |
| Student records | Contact details and edit | Contact details and edit | Name and assigned batch | Name only |
| Copilot queries | RLS-scoped read-only schema | RLS-scoped read-only schema | Assigned-batch schema without fees/contact fields | RLS-scoped read-only schema |
| Fee workspace | Yes | Hidden | Hidden | Yes |
| Attendance and recordings | All | Read | Assigned batches | Read |
| Timetable | Propose and approve | Propose | Own batches | Read |
| Approvals | Approve all | Request | Request | Approve fee actions |

The SQL query guard only accepts one `SELECT`/`WITH` statement, rejects comments and write operations, checks role table/column access, binds parameters, and caps result sets at 200 rows. Trainer schemas do not contain fee tables or student contact columns. Finance-related trainer questions are refused and audited without running a query.

## Copilot

Copilot requests are sent to the authenticated backend. Read-only queries are validated server-side and run over bounded relation data fetched with the caller's Supabase JWT, so RLS applies to those fetches. The query itself runs against an in-memory SQL.js snapshot, not a PostgreSQL connection; the UI shows the exact query and result source. The backend can save audited pending action previews. Approval execution is intentionally blocked with HTTP 501 until a transactional, idempotent action executor is implemented; do not treat an approval as an applied data change.

## Supabase

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` for Supabase Auth and browser requests. The Express backend verifies each access token and uses the same user's token for database requests so RLS applies. The active role comes from `public.institute_members`; a user with multiple institute memberships must have a server-controlled `app_metadata.institute_id` selecting one of those memberships. User-editable metadata is not an authorization source. The tenant hardening migration is local and has not been applied by this workflow. The existing Supabase connection could not be verified from this environment.

The browser API does not use the service-role key. `SUPABASE_SERVICE_ROLE_KEY` is server-only and is used for trusted audit inserts, pending approval writes/rejections, and the verified finance payment RPC. Keep it out of frontend bundles and every `VITE_` variable.

## Example Copilot Questions

- Owner: “Which students in the Java batch have missed three or more classes and have an EMI due this week? Draft a WhatsApp reminder for each.”
- Owner: “Show overdue EMIs” or “Which batches have the highest fill rate?”
- Counselor: “How many students are at dropout risk?” or “Show fee summaries due this week.”
- Trainer: “Who is absent today?” or “Show recordings for the Java batch.” Fee questions are refused.
- Accounts: “Which students have overdue instalments?” or “Show unpaid totals by course.”

## Timetable and Reconciliation

The local timetable UI uses a pure backtracking solver with trainer availability, weekly hour caps, room capacity, online seat limits, and clash checks. There is no server timetable solve/replan endpoint yet. The CSV reconciliation panel currently parses the uploaded/sample statement in the browser against local fixtures; it does not upload, match, or apply rows against live database records. `public/sample-statement.csv` has one expected match and two unmatched rows. These local previews are not live backend reconciliation or approval execution.

## Scope Notes

This is a browser demo, not production authentication or payment software. Demo login roles are not security credentials. No payment is processed and no message is sent silently. Review the Supabase policy SQL against the deployed schema and claims before production use.

