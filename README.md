# InstituteOS

InstituteOS is a TechSummitTrainers institute operations demo built with React and Vite. The workspace includes Dashboard, Students, Batches, Attendance, Fees, Schedules, Reports, Settings, and an operations Copilot.

## Run Locally

```sh
npm install
copy .env.example .env
npm run dev
```

The demo login is local-only. Choose Owner, Counselor, Trainer, or Accounts; no password or external identity is used. The original dashboard endpoint remains `http://localhost:5000/api/dashboard` and its response contract is unchanged.

```sh
npm run build
npm run test
npm run lint
```

## Demo Data

Without Supabase credentials, the browser SQLite database is seeded from `src/data/mockData.js` and persisted in local storage. The seed contains five courses, eight trainers, four rooms, twelve batches, 140 students, six weeks of sessions and attendance, instalments, payments, assignments, and recordings. Dates are generated from the system clock. Four Java-A students are guaranteed to meet the headline demo query during the current Monday-start week.

The Students, Batches, Fees, and Attendance pages keep editable browser records. Copilot queries use separate sql.js databases with role-specific table and column allow-lists. Switching demo roles rebuilds the relevant view; it is not a substitute for authentication on a public deployment.

## Role Matrix

| Capability | Owner | Counselor | Trainer | Accounts |
| --- | --- | --- | --- | --- |
| Student records | Contact details and edit | Contact details and edit | Name and assigned batch | Name only |
| Fees in Copilot | Detailed | Aggregated summary | Refused | Detailed |
| Fee workspace | Yes | Hidden | Hidden | Yes |
| Attendance and recordings | All | Read | Assigned batches | Read |
| Timetable | Propose and approve | Propose | Own batches | Read |
| Approvals | Approve all | Request | Request | Approve fee actions |

The SQL query guard only accepts one `SELECT`/`WITH` statement, rejects comments and write operations, checks role table/column access, binds user values, and caps result sets at 200 rows. Trainer databases do not contain fee tables or student contact columns. Finance-related trainer questions are refused and audited without running a query.

## Copilot

The local planner supports missed classes, Java attendance/EMI matching, overdue and upcoming EMIs, fee summaries, trainer load, rooms, absences, recordings, batch fill rates, and unpaid totals by course. Results show the SQL and rows. WhatsApp actions create editable previews; approval opens individual WhatsApp draft links and never sends messages automatically.

Conversation history is saved per demo user. Enter sends, Shift+Enter inserts a line break, and `/` focuses the composer. Queries, refusals, previews, approvals, and rejections appear in Settings audit history.

Set `VITE_COPILOT_MODE=llm` and `VITE_COPILOT_ENDPOINT` to request an optional SQL plan. The endpoint receives the question and active role schema and should return JSON like:

```json
{"sql":"SELECT ...", "params":[], "answer":"Short summary"}
```

Returned SQL still passes the same guard and scoped database. If the endpoint fails, the local planner is used.

## Supabase

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` to enable Supabase reads for Copilot. Apply `supabase/policies.sql` after creating the schema tables. Policies expect trusted server-managed JWT `app_metadata.role` and `app_metadata.user_id` claims; never set these claims from user-editable metadata. The browser demo role switcher does not change Supabase identity.

Supabase must have an authenticated session and matching RLS claims before real student or payment information is used. Never expose a service-role key in a Vite environment variable.

## Example Questions

- Owner: “Which students in the Java batch have missed three or more classes and have an EMI due this week? Draft a WhatsApp reminder for each.”
- Owner: “Show overdue EMIs” or “Which batches have the highest fill rate?”
- Counselor: “How many students are at dropout risk?” or “Show fee summaries due this week.”
- Trainer: “Who is absent today?” or “Show recordings for the Java batch.” Fee questions are refused.
- Accounts: “Which students have overdue instalments?” or “Show unpaid totals by course.”

## Timetable and Reconciliation

Schedules uses a pure backtracking solver with trainer availability, weekly hour caps, room capacity, online seat limits, and clash checks. Re-plans require owner approval before saving. Fees includes CSV statement reconciliation, confidence scores, unmatched rows, and bulk approval. `public/sample-statement.csv` has one expected match and two unmatched rows.

## Scope Notes

This is a browser demo, not production authentication or payment software. Demo login roles are not security credentials. No payment is processed and no message is sent silently. Review the Supabase policy SQL against the deployed schema and claims before production use.

