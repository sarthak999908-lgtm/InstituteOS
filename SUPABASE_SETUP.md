# InstituteOS — Supabase Backend Guide

This guide walks you through setting up the **Supabase PostgreSQL backend** for InstituteOS in 3 simple steps.

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **"New Project"**.
3. Choose a name (e.g. `InstituteOS`) and set a strong database password.
4. Select your nearest region and click **"Create new project"** (takes ~1-2 minutes to provision).

---

## 2. Deploy Schema & Seed Data (One-Click SQL)

1. In your Supabase dashboard, click **SQL Editor** from the left navigation bar (icon `>_`).
2. Click **"New query"**.
3. Open [`supabase/schema.sql`](file:///c:/Users/Dell/Desktop/COPILET/supabase/schema.sql) from this repository, copy all the SQL, paste it into the editor, and click **"Run"** (`Ctrl + Enter`).
   - This creates all 17 tables, foreign key constraints, Row-Level Security (RLS) rules, and the `get_dashboard_telemetry()` stored procedure.
4. Open [`supabase/seed.sql`](file:///c:/Users/Dell/Desktop/COPILET/supabase/seed.sql), copy all SQL, paste it in a new query, and click **"Run"**.
   - This seeds courses, trainers, classrooms, active batches, student rosters, fee plans, and initial payments.

---

## 3. Configure Your Environment Variables

1. In Supabase, go to **Project Settings** (gear icon) ➔ **API**.
2. Copy the following:
   - **Project URL** (`https://xyzcompany.supabase.co`)
   - **anon / public** key (`eyJhbGciOi...`)
3. Create a `.env` file in the root of this project (you can copy `.env.example`):
   ```bash
   cp .env.example .env
   ```
4. Paste your values into `.env`:
   ```ini
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   PORT=5000
   ```

---

## 4. Running the Backend

You can run the full-stack system in multiple ways:

### A. Run Full Stack (Frontend + Express API Server)
```bash
npm run dev:all
```
- **Frontend**: `http://localhost:5173`
- **Express Backend**: `http://localhost:5000`

### B. Run Frontend Only (Direct Supabase Connection)
```bash
npm run dev
```
The browser will connect directly to Supabase via `@supabase/supabase-js` with WebSockets and Row-Level Security enabled!

### C. Run Backend Server Only
```bash
npm run server
```

---

## Verification & API Endpoints

Once your server is running, check:
- `http://localhost:5000/api/health` ➔ Returns status and Supabase connection health.
- `http://localhost:5000/api/dashboard` ➔ Returns live counts of active students, batches, and fee metrics.
- `http://localhost:5000/api/students` ➔ Returns student roster from Supabase.
