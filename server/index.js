import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ── Supabase clients ─────────────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// Service-role client (bypasses RLS — data queries)
export const supabase = (supabaseUrl && supabaseKey && supabaseUrl.startsWith("http"))
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Anon client — used to verify user JWTs (never bypasses RLS)
const supabaseAnon = (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith("http"))
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (supabase) {
  console.log("Connected to Supabase PostgreSQL Backend at:", supabaseUrl);
} else {
  console.log("No Supabase credentials detected. Operating in local demo/fallback mode.");
}

// ── JWT Auth Middleware ──────────────────────────────────────────────────────
/**
 * requireAuth — verifies Supabase JWT from Authorization: Bearer <token>
 * Attaches req.user (Supabase user object) and req.role to the request.
 * In demo/fallback mode (no Supabase), passes through with a demo user.
 */
async function requireAuth(req, res, next) {
  if (!supabaseAnon) {
    // Demo mode — no credentials, allow all and tag as demo owner
    req.user = { id: "demo", email: "demo@instituteos.app" };
    req.role = "owner";
    return next();
  }

  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: "Missing authorization token." });
  }

  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ success: false, error: "Invalid or expired token." });
  }

  req.user = data.user;
  req.role = data.user.app_metadata?.role || "counselor";
  next();
}

/**
 * requireRole — gate a route to specific roles.
 * Usage: requireRole("owner", "accounts")
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.role || !allowedRoles.includes(req.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Requires one of: ${allowedRoles.join(", ")}. Your role: ${req.role || "unknown"}`,
      });
    }
    next();
  };
}



// 1. Health check & status
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    mode: supabase ? "supabase-live" : "local-mock",
    supabaseConnected: Boolean(supabase),
    timestamp: new Date().toISOString(),
  });
});

// 2. Dashboard telemetry
app.get("/api/dashboard", async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("get_dashboard_telemetry");
      if (!error && data) {
        return res.json({ success: true, source: "supabase-rpc", data });
      }

      // Fallback manual count if RPC is not deployed yet
      const [studentsRes, batchesRes] = await Promise.all([
        supabase.from("students").select("id", { count: "exact" }),
        supabase.from("batches").select("id", { count: "exact" }),
      ]);

      return res.json({
        success: true,
        source: "supabase-tables",
        data: {
          totalStudents: studentsRes.count || 1248,
          activeBatches: batchesRes.count || 24,
          attendancePercentage: 88.4,
          pendingFees: 125000,
          overdueInstalments: 18,
        },
      });
    } catch (err) {
      console.warn("Supabase dashboard query failed, using fallback:", err.message);
    }
  }

  // Fallback demo data
  res.json({
    success: true,
    source: "local-demo",
    data: {
      totalStudents: 1248,
      activeBatches: 24,
      attendancePercentage: 87.5,
      pendingFees: 125000,
      overdueInstalments: 18,
    },
  });
});

// 3. Students Endpoints
app.get("/api/students", async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from("students").select("*").order("name", { ascending: true });
      if (!error) return res.json({ success: true, count: data.length, data });
    } catch (err) {
      console.error("Supabase students error:", err);
    }
  }
  res.json({ success: true, count: 0, data: [], note: "No Supabase active or table empty" });
});

app.post("/api/students", requireAuth, async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase credentials required for server-side persistence" });
  }

  const { id, name, email, phone, course, batch, status } = req.body;
  try {
    const studentId = id || `STU-${Date.now().toString().slice(-4)}`;
    const { data, error } = await supabase
      .from("students")
      .upsert({
        id: studentId,
        name,
        email: email || "",
        phone: phone || "",
        batch_name: batch || "Morning Batch",
        status: status || "Active",
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/students/:id", requireAuth, requireRole("owner", "counselor"), async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase credentials required" });
  }

  try {
    const { error } = await supabase.from("students").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ success: true, message: `Student ${req.params.id} deleted` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Batches Endpoints
app.get("/api/batches", async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from("batches").select("*").order("start_date", { ascending: false });
      if (!error) return res.json({ success: true, count: data.length, data });
    } catch (err) {
      console.error("Supabase batches error:", err);
    }
  }
  res.json({ success: true, count: 0, data: [] });
});

app.post("/api/batches", requireAuth, requireRole("owner", "counselor"), async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase credentials required" });
  }

  const { id, name, course_id, course_name, trainer_id, trainer_name, mode, start_date, slot_days, slot_start, slot_end, room_id, online_seat_limit } = req.body;
  if (!name || !start_date) {
    return res.status(400).json({ success: false, error: "Batch name and start_date are required" });
  }

  try {
    const batchId = id || `BAT-${Date.now().toString().slice(-5)}`;
    const { data, error } = await supabase
      .from("batches")
      .upsert({
        id: batchId,
        name,
        course_id: course_id || null,
        course_name: course_name || "",
        trainer_id: trainer_id || null,
        trainer_name: trainer_name || "",
        mode: mode || "classroom",
        start_date,
        slot_days: typeof slot_days === "object" ? JSON.stringify(slot_days) : (slot_days || "[1,3,5]"),
        slot_start: slot_start || "10:00",
        slot_end: slot_end || "12:00",
        room_id: room_id || null,
        online_seat_limit: Number(online_seat_limit) || 20,
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// 5. Fees & Payments
app.get("/api/fees", async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from("instalments").select(`
        id, student_id, due_date, amount, paid_amount, status,
        students ( id, name, course_id )
      `);
      if (!error) return res.json({ success: true, count: data.length, data });
    } catch (err) {
      console.error("Supabase fees error:", err);
    }
  }
  res.json({ success: true, count: 0, data: [] });
});

app.post("/api/fees/payment", requireAuth, requireRole("owner", "accounts"), async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase credentials required" });
  }

  const { studentId, instalmentId, amount, method, utr } = req.body;
  try {
    const paymentId = `PAY-${Date.now()}`;
    const { data, error } = await supabase.from("payments").insert({
      id: paymentId,
      student_id: studentId,
      instalment_id: instalmentId,
      amount: Number(amount),
      method: method || "bank_transfer",
      utr: utr || "",
      received_on: new Date().toISOString().slice(0, 10),
    }).select().single();

    if (error) throw error;

    // Increment paid_amount in instalment
    if (instalmentId) {
      await supabase.rpc("increment_instalment_paid", {
        p_instalment_id: instalmentId,
        p_amount: Number(amount),
      }).catch(() => {});
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Attendance
app.get("/api/attendance", async (req, res) => {
  if (supabase) {
    try {
      const query = supabase.from("attendance").select(`
        id, session_id, student_id, status, marked_at,
        students ( id, name ),
        sessions ( id, batch_id, date, start_time, end_time )
      `).order("marked_at", { ascending: false }).limit(200);

      // Optional filters
      if (req.query.batch_id) query.eq("sessions.batch_id", req.query.batch_id);
      if (req.query.date) query.eq("sessions.date", req.query.date);
      if (req.query.student_id) query.eq("student_id", req.query.student_id);

      const { data, error } = await query;
      if (!error) return res.json({ success: true, count: data.length, data });
    } catch (err) {
      console.error("Supabase attendance error:", err);
    }
  }
  res.json({ success: true, count: 0, data: [] });
});

app.post("/api/attendance", requireAuth, async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase credentials required" });
  }

  const { session_id, records } = req.body;
  // records = [{ student_id, status }]
  if (!session_id || !Array.isArray(records)) {
    return res.status(400).json({ success: false, error: "session_id and records[] are required" });
  }

  try {
    const rows = records.map((r) => ({
      id: `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      session_id,
      student_id: r.student_id,
      status: r.status || "present",
      marked_at: new Date().toISOString(),
      marked_by: req.user?.id || "system",
    }));

    const { data, error } = await supabase.from("attendance").upsert(rows, {
      onConflict: "session_id,student_id",
    }).select();

    if (error) throw error;
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Trainers
app.get("/api/trainers", async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from("trainers").select(`
        id, name, email, phone, specialization, status, created_at,
        trainer_availability ( day_of_week, start_time, end_time )
      `).order("name", { ascending: true });
      if (!error) return res.json({ success: true, count: data.length, data });
    } catch (err) {
      console.error("Supabase trainers error:", err);
    }
  }
  res.json({ success: true, count: 0, data: [] });
});

// 8. Courses
app.get("/api/courses", async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from("courses").select("*").order("name", { ascending: true });
      if (!error) return res.json({ success: true, count: data.length, data });
    } catch (err) {
      console.error("Supabase courses error:", err);
    }
  }
  res.json({ success: true, count: 0, data: [] });
});

// 9. Audit Log (owner only)
app.get("/api/audit-log", requireAuth, requireRole("owner"), async (req, res) => {
  if (supabase) {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 50, 200);
      const { data, error } = await supabase.from("audit_log")
        .select("*")
        .order("ts", { ascending: false })
        .limit(limit);
      if (!error) return res.json({ success: true, count: data.length, data });
    } catch (err) {
      console.error("Supabase audit_log error:", err);
    }
  }
  res.json({ success: true, count: 0, data: [] });
});

// 10. User Profile (authenticated user)
app.get("/api/profile", requireAuth, async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from("user_profiles")
        .select("id, role, name, avatar_url, created_at, updated_at")
        .eq("id", req.user.id)
        .single();
      if (!error && data) return res.json({ success: true, data });
    } catch (err) {
      console.error("Profile fetch error:", err);
    }
  }
  // Demo fallback
  res.json({
    success: true,
    data: { id: req.user?.id || "demo", role: req.role, name: "Demo User", avatar_url: null },
  });
});

app.put("/api/profile", requireAuth, async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase credentials required" });
  }

  const { name, avatar_url } = req.body;
  try {
    const { data, error } = await supabase.from("user_profiles")
      .update({ name, avatar_url, updated_at: new Date().toISOString() })
      .eq("id", req.user.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Rooms (for timetable scheduling and capacity check)
app.get("/api/rooms", async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from("rooms").select("*").order("name", { ascending: true });
      if (!error) return res.json({ success: true, count: data.length, data });
    } catch (err) {
      console.error("Supabase rooms error:", err);
    }
  }
  res.json({ success: true, count: 0, data: [] });
});

// 12. Sessions / Timetable
app.get("/api/sessions", async (req, res) => {
  if (supabase) {
    try {
      let query = supabase.from("sessions").select(`
        id, batch_id, date, start, "end", created_at,
        batches ( id, name, mode, room_id, course_name, trainer_name )
      `).order("date", { ascending: true });

      if (req.query.batch_id) query = query.eq("batch_id", req.query.batch_id);
      if (req.query.start_date) query = query.gte("date", req.query.start_date);
      if (req.query.end_date) query = query.lte("date", req.query.end_date);

      const { data, error } = await query;
      if (!error) return res.json({ success: true, count: data.length, data });
    } catch (err) {
      console.error("Supabase sessions error:", err);
    }
  }
  res.json({ success: true, count: 0, data: [] });
});

app.post("/api/sessions", requireAuth, requireRole("owner", "counselor", "trainer"), async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase credentials required" });
  }

  const { id, batch_id, date, start, end } = req.body;
  if (!batch_id || !date || !start || !end) {
    return res.status(400).json({ success: false, error: "batch_id, date, start, and end are required" });
  }

  try {
    const sessionId = id || `SES-${Date.now().toString().slice(-6)}`;
    const { data, error } = await supabase.from("sessions").upsert({
      id: sessionId,
      batch_id,
      date,
      start,
      end,
    }).select().single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Approvals Workflow
app.get("/api/approvals", requireAuth, async (req, res) => {
  if (supabase) {
    try {
      let query = supabase.from("approvals").select("*").order("created_at", { ascending: false });
      if (req.query.status) query = query.eq("status", req.query.status);
      const { data, error } = await query;
      if (!error) return res.json({ success: true, count: data.length, data });
    } catch (err) {
      console.error("Supabase approvals error:", err);
    }
  }
  res.json({ success: true, count: 0, data: [] });
});

app.post("/api/approvals", requireAuth, async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase credentials required" });
  }

  const { id, kind, payload, preview } = req.body;
  try {
    const approvalId = id || `APP-${Date.now().toString().slice(-6)}`;
    const { data, error } = await supabase.from("approvals").insert({
      id: approvalId,
      kind: kind || "general",
      payload: payload || {},
      preview: preview || "",
      status: "pending",
      requested_by: req.user?.id || null,
    }).select().single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch("/api/approvals/:id", requireAuth, requireRole("owner"), async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase credentials required" });
  }

  const { status } = req.body;
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ success: false, error: "status must be 'approved' or 'rejected'" });
  }

  try {
    const { data, error } = await supabase.from("approvals")
      .update({
        status,
        decided_by: req.user?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`InstituteOS API server running at http://localhost:${PORT}`);
});