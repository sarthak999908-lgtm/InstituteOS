import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import { createCopilotService, CopilotFallbackRequired, isTrainerFinanceQuestion } from "./copilot/service.js";
import { PROMPT_VERSION } from "./copilot/systemPrompt.js";

dotenv.config();

export const app = express();
const PORT = process.env.PORT || 5000;


app.use(cors());
app.use(express.json({ limit: "256kb", strict: true }));

// ── Supabase clients ─────────────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Public-key client is used only for Auth verification and anonymous health probes.
// Data requests use a separate client carrying the verified user's JWT.
export const supabase = (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith("http"))
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

// Anon client — used to verify user JWTs (never bypasses RLS)
const supabaseAnon = (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith("http"))
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Never import this client into browser code. It is used only for append-only
// audit inserts and manually authorized server-side approval/payment writes.
const supabaseServiceRole = (supabaseUrl && supabaseServiceRoleKey && supabaseUrl.startsWith("http"))
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  : null;

export function createAuditWriter(client, { idFactory = randomUUID, clock = () => new Date() } = {}) {
  return async function audit(req, event, detail = {}) {
    const context = req?.authContext;
    if (!client || !context?.authUserId || !context?.userId || !context?.instituteId
        || !["owner", "counselor", "trainer", "accounts"].includes(context.role)
        || typeof event !== "string" || !event.trim()) {
      throw new Error("Audit write unavailable.");
    }

    let serializedDetail;
    try {
      serializedDetail = JSON.stringify(detail ?? {});
    } catch {
      throw new Error("Audit write unavailable.");
    }
    if (serializedDetail.length > 8000) throw new Error("Audit write unavailable.");

    const entry = {
      id: idFactory(),
      at: clock().toISOString(),
      user_id: context.userId,
      role: context.role,
      institute_id: context.instituteId,
      event: event.trim().slice(0, 120),
      detail: serializedDetail,
    };
    try {
      const { error } = await client.from("audit_log").insert(entry);
      if (error) throw error;
    } catch {
      throw new Error("Audit write unavailable.");
    }
    return entry;
  };
}

const audit = createAuditWriter(supabaseServiceRole);

export function createCopilotApprovalWriter(client, auditWriter = audit, idFactory = randomUUID) {
  return async function createCopilotApproval(req, { kind, payload, preview, actionKind }) {
    const context = req?.authContext;
    if (!client || !context?.userId || !context?.instituteId || !context?.role) {
      throw new Error("The audited approval service is unavailable.");
    }
    const allowedKinds = {
      owner: new Set(["whatsapp_reminders", "attendance_bulk_mark", "fee_action", "schedule_replan"]),
      counselor: new Set(["whatsapp_reminders", "fee_action", "schedule_replan"]),
      trainer: new Set(["attendance_bulk_mark"]),
      accounts: new Set(["fee_action"]),
    };
    if (!allowedKinds[context.role]?.has(kind)) throw new Error("This role cannot request this approval.");
    const approvalId = `COP-${idFactory()}`;
    const previewText = String(preview || "").slice(0, 8000);
    const payloadText = JSON.stringify(payload || {});
    const detail = {
      approvalId,
      kind,
      actionKind,
      previewHash: createHash("sha256").update(`${previewText}\n${payloadText}`).digest("hex"),
      previewLength: previewText.length,
      promptVersion: PROMPT_VERSION,
    };
    await auditWriter(req, "approval.request_attempt", detail);
    const { data, error } = await client.from("approvals").insert({
      id: approvalId,
      institute_id: context.instituteId,
      kind,
      payload: payload || {},
      preview: previewText,
      status: "pending",
      requested_by: context.userId,
    }).select("id,kind,status,created_at").single();
    if (error || !data) throw new Error("The approval preview could not be saved.");
    return data;
  };
}

export function withApprovedReminderMessages(existingPayload, submittedRecipients) {
  const payload = typeof existingPayload === "string" ? JSON.parse(existingPayload) : existingPayload;
  const recipients = payload && !Array.isArray(payload) ? payload.recipients : null;
  if (!Array.isArray(recipients) || !Array.isArray(submittedRecipients)
      || recipients.length < 1 || recipients.length > 200 || recipients.length !== submittedRecipients.length) {
    throw new Error("The edited reminder preview does not match the saved recipients.");
  }

  const edits = new Map();
  for (const item of submittedRecipients) {
    const id = typeof item?.studentId === "string" ? item.studentId : typeof item?.student_id === "string" ? item.student_id : "";
    if (!id || edits.has(id) || typeof item?.message !== "string" || item.message.length > 1000) {
      throw new Error("Each saved recipient needs one message of at most 1,000 characters.");
    }
    const message = item.message.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, " ").trim();
    if (!message) throw new Error("Reminder messages cannot be empty.");
    edits.set(id, message);
  }

  const savedIds = new Set();
  const updatedRecipients = recipients.map((recipient) => {
    const id = String(recipient?.studentId ?? recipient?.student_id ?? "");
    if (!id || savedIds.has(id) || !edits.has(id)) throw new Error("The edited reminder preview does not match the saved recipients.");
    savedIds.add(id);
    return { ...recipient, message: edits.get(id) };
  });
  if (savedIds.size !== edits.size) throw new Error("The edited reminder preview does not match the saved recipients.");
  return { ...payload, recipients: updatedRecipients };
}

const createCopilotApproval = createCopilotApprovalWriter(supabaseServiceRole, audit);
const copilotService = createCopilotService({ audit, approvalCreator: createCopilotApproval });

async function writeRequiredAudit(req, res, event, detail) {
  try {
    await audit(req, event, detail);
    return true;
  } catch {
    res.status(503).json({ success: false, error: "The audit service is unavailable; the action was not performed." });
    return false;
  }
}

if (supabase) {
  console.log("Supabase public-key client configured; connectivity is checked per request.");
} else {
  console.log("Supabase is not configured. Protected API requests will be denied.");
}

// ── JWT & Token Auth Middleware ──────────────────────────────────────────────
/**
 * requireAuth — verifies a Supabase access token and resolves its server-managed role.
 * Attaches req.user and req.role to the request.
 */
function readVerifiedJwtClaims(token, user) {
  try {
    const encoded = token.split(".")[1];
    const claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (claims.sub !== user.id || claims.role !== "authenticated" || Number(claims.exp) * 1000 <= Date.now()) return null;
    return Object.freeze({
      sub: user.id,
      role: "authenticated",
      ...(typeof claims.email === "string" ? { email: claims.email } : {}),
      app_metadata: claims.app_metadata && typeof claims.app_metadata === "object" ? claims.app_metadata : {},
    });
  } catch {
    return null;
  }
}

export function createRequireAuth({ verifyToken, createUserClient, allowUnlinked = false }) {
  return async function requireVerifiedAuth(req, res, next) {
    if (req.authContext) return next();
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token || token.startsWith("inst_token_") || token.split(".").length !== 3) {
      return res.status(401).json({ success: false, error: "Missing authorization token." });
    }

    let data;
    let error;
    try {
      ({ data, error } = await verifyToken(token));
    } catch {
      return res.status(503).json({ success: false, error: "Supabase Auth is temporarily unavailable." });
    }
    if (error || !data?.user) return res.status(401).json({ success: false, error: "Invalid or expired token." });
    const jwtClaims = readVerifiedJwtClaims(token, data.user);
    if (!jwtClaims) return res.status(401).json({ success: false, error: "Invalid or expired token." });

    let userSupabase;
    let contextResult;
    try {
      userSupabase = createUserClient(token);
      contextResult = await userSupabase.rpc("current_user_context");
    } catch {
      return res.status(503).json({ success: false, error: "InstituteOS membership verification is temporarily unavailable." });
    }
    if (contextResult.error) return res.status(503).json({ success: false, error: "InstituteOS membership verification is temporarily unavailable." });
    const context = Array.isArray(contextResult.data) ? contextResult.data[0] : contextResult.data;
    if (!context?.user_id || !context?.institute_id
        || !["owner", "counselor", "trainer", "accounts"].includes(context.role)) {
      if (allowUnlinked && !context) {
        req.user = data.user;
        req.role = null;
        req.dbUserId = null;
        req.instituteId = null;
        req.jwtClaims = jwtClaims;
        req.authContext = Object.freeze({ authUserId: data.user.id, userId: null, instituteId: null, role: null });
        req.supabase = userSupabase;
        return next();
      }
      return res.status(403).json({ success: false, error: "This account has no verified InstituteOS membership." });
    }
    req.user = data.user;
    req.role = context.role;
    req.dbUserId = context.user_id;
    req.instituteId = context.institute_id;
    req.jwtClaims = jwtClaims;
    req.authContext = Object.freeze({
      authUserId: data.user.id,
      userId: context.user_id,
      instituteId: context.institute_id,
      role: context.role,
    });
    req.supabase = userSupabase;
    return next();
  };
}

const authDependencies = {
  verifyToken: (token) => supabaseAnon.auth.getUser(token),
  createUserClient: (token) => createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  }),
};
export const requireAuth = createRequireAuth(authDependencies);
const requireAuthAllowUnlinked = createRequireAuth({ ...authDependencies, allowUnlinked: true });

export function createRateLimiter({ limit, windowMs, keyFor, clock = () => Date.now(), maxKeys = 20000 }) {
  const windows = new Map();
  return function rateLimit(req, res, next) {
    const key = String(keyFor(req) || "unknown");
    const now = clock();
    let window = windows.get(key);
    if (!window || now >= window.resetAt) {
      if (windows.size >= maxKeys) {
        for (const [existingKey, existing] of windows) {
          if (now >= existing.resetAt) windows.delete(existingKey);
        }
      }
      if (windows.size >= maxKeys && !windows.has(key)) {
        return res.status(429).json({ success: false, error: "Too many requests. Try again later." });
      }
      window = { count: 0, resetAt: now + windowMs };
      windows.set(key, window);
    }
    window.count += 1;
    if (window.count > limit) {
      const retrySeconds = Math.max(1, Math.ceil((window.resetAt - now) / 1000));
      if (typeof res.setHeader === "function") res.setHeader("Retry-After", String(retrySeconds));
      return res.status(429).json({ success: false, error: "Too many requests. Try again later." });
    }
    return next();
  };
}

export function auditRowsToCsv(rows) {
  const columns = ["at", "role", "user_id", "event", "detail"];
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [columns, ...(Array.isArray(rows) ? rows : []).map((row) => columns.map((column) => row?.[column] ?? ""))]
    .map((row) => row.map(quote).join(","))
    .join("\r\n");
}

export function normalizePaymentAmount(value) {
  const raw = typeof value === "string" ? value.trim() : Number.isSafeInteger(value) ? String(value) : "";
  const match = /^(0|[1-9]\d{0,11})(?:\.(\d{1,2}))?$/.exec(raw);
  if (!match) return null;
  const fraction = (match[2] || "").padEnd(2, "0");
  const minorUnits = BigInt(match[1]) * 100n + BigInt(fraction || "0");
  if (minorUnits <= 0n) return null;
  return `${match[1]}${match[2] ? `.${match[2].padEnd(2, "0")}` : ".00"}`;
}

const authIpRateLimit = createRateLimiter({
  limit: 12,
  windowMs: 15 * 60 * 1000,
  keyFor: (req) => req.ip || req.socket?.remoteAddress || "unknown-ip",
});
const userApiRateLimit = createRateLimiter({
  limit: 120,
  windowMs: 60 * 1000,
  keyFor: (req) => req.authContext?.authUserId || req.ip || "unknown-user",
});

/**
 * requireRole — gate a route to specific roles.
 * Usage: requireRole("owner", "accounts")
 */
export function requireRole(...allowedRoles) {
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

export const studentDeleteRoleGuard = requireRole("owner");

// ── Authentication Endpoints ──────────────────────────────────────────────────
app.post("/api/auth/magic-link", authIpRateLimit, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, error: "Email is required" });
  if (!supabaseAnon) return res.status(503).json({ success: false, error: "Supabase Auth is not configured." });
  const { error } = await supabaseAnon.auth.signInWithOtp({ email });
  if (error) return res.status(502).json({ success: false, error: "Could not start Supabase email verification." });
  return res.json({ success: true, message: "Check your email for a sign-in link or code." });
});

app.post("/api/auth/verify-otp", authIpRateLimit, async (req, res) => {
  const { email, token } = req.body;
  if (!email || !token) return res.status(400).json({ success: false, error: "Email and code are required" });

  if (!supabaseAnon) return res.status(503).json({ success: false, error: "Supabase Auth is not configured." });
  const { data, error } = await supabaseAnon.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data?.user || !data?.session) return res.status(401).json({ success: false, error: "Invalid or expired verification code." });
  return res.json({ success: true, user: data.user, session: data.session });
});

app.post("/api/auth/signin", authIpRateLimit, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, error: "Email and password are required" });

  if (!supabaseAnon) return res.status(503).json({ success: false, error: "Supabase Auth is not configured." });
  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
  if (error || !data?.user || !data?.session) return res.status(401).json({ success: false, error: "Email or password is incorrect." });
  return res.json({ success: true, user: data.user, session: data.session });
});

app.post("/api/auth/register", authIpRateLimit, async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, error: "Email and password are required" });
  if (!supabaseAnon) return res.status(503).json({ success: false, error: "Supabase Auth is not configured." });
  const { data, error } = await supabaseAnon.auth.signUp({ email, password, options: { data: { name: name || email.split("@")[0] } } });
  if (error || !data?.user) return res.status(400).json({ success: false, error: "Supabase could not create this account." });
  return res.json({ success: true, user: data.user, session: data.session, message: data.session ? undefined : "Check your email to confirm the account. A staff role must be assigned by an administrator." });
});

app.get("/api/auth/session", requireAuth, (req, res) => {
  res.json({ success: true, user: req.user, role: req.role });
});

app.get("/api/me", requireAuthAllowUnlinked, userApiRateLimit, (req, res) => {
  if (!req.authContext?.userId || !req.authContext?.instituteId || !req.authContext?.role) {
    return res.json({ success: true, data: { linked: false, userId: req.user.id } });
  }
  return res.json({ success: true, data: {
    linked: true,
    userId: req.user.id,
    profileId: req.authContext.userId,
    instituteId: req.authContext.instituteId,
    role: req.authContext.role,
  } });
});

// Every API route below requires a verified Supabase identity. Health remains public.
app.use("/api", (req, res, next) => req.path === "/health" ? next() :
  requireAuth(req, res, (error) => error ? next(error) : userApiRateLimit(req, res, next)));




// Root & API discovery endpoint
app.get(["/", "/api"], (req, res) => {
  const isHtml = req.headers.accept && req.headers.accept.includes("text/html");

  if (isHtml) {
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>InstituteOS · Backend REST API</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #090d16; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .card { max-width: 620px; width: 100%; background: #111827; border: 1px solid #1f293d; border-radius: 20px; padding: 36px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); text-align: center; }
    .status-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.25); font-size: 13px; font-weight: 600; margin-bottom: 20px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 10px; }
    p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin-bottom: 28px; }
    .cta-button { display: inline-flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 14px 24px; border-radius: 12px; background: #2563eb; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; transition: background 0.2s, transform 0.1s; box-shadow: 0 8px 24px -4px rgba(37, 99, 235, 0.5); }
    .cta-button:hover { background: #1d4ed8; transform: translateY(-1px); }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0; text-align: left; }
    .meta-item { background: #1e293b; padding: 12px 16px; border-radius: 10px; border: 1px solid #334155; }
    .meta-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 4px; }
    .meta-val { font-size: 14px; font-weight: 600; color: #f8fafc; font-family: monospace; }
    .endpoints-box { background: #0b1120; border: 1px solid #1e293b; border-radius: 12px; padding: 14px 18px; text-align: left; margin-top: 20px; }
    .endpoints-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 8px; }
    .endpoint-tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .tag { font-family: monospace; font-size: 11px; background: #1e293b; color: #38bdf8; padding: 4px 8px; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="status-badge"><span class="dot"></span> Backend REST API Healthy</div>
    <h1>InstituteOS Core Server</h1>
    <p>The backend REST API is up and running on port 5000. Open the interactive web application below to log in as Admin or access student operations.</p>
    <a href="http://localhost:5173" class="cta-button">🚀 Open InstituteOS Web App & Admin Portal</a>
    <div class="meta-grid">
      <div class="meta-item">
        <div class="meta-label">Port & Status</div>
        <div class="meta-val">5000 · Healthy</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Frontend URL</div>
        <div class="meta-val">http://localhost:5173</div>
      </div>
    </div>
    <div class="endpoints-box">
      <div class="endpoints-title">Active REST Endpoints</div>
      <div class="endpoint-tags">
        <span class="tag">/api/health</span>
        <span class="tag">/api/auth/magic-link</span>
        <span class="tag">/api/auth/verify-otp</span>
        <span class="tag">/api/auth/signin</span>
        <span class="tag">/api/dashboard</span>
        <span class="tag">/api/students</span>
        <span class="tag">/api/batches</span>
        <span class="tag">/api/fees</span>
        <span class="tag">/api/attendance</span>
        <span class="tag">/api/schedules</span>
        <span class="tag">/api/system/status</span>
      </div>
    </div>
  </div>
</body>
</html>`);
  }

  res.json({
    success: true,
    service: "InstituteOS Backend REST API",
    status: "healthy",
    supabaseConfigured: Boolean(supabase),
    frontendUrl: "http://localhost:5173",
    timestamp: new Date().toISOString(),
    endpoints: [
      "/api/health",
      "/api/auth/magic-link",
      "/api/auth/verify-otp",
      "/api/auth/signin",
      "/api/dashboard",
      "/api/students",
      "/api/batches",
      "/api/fees",
      "/api/attendance",
      "/api/trainers",
      "/api/courses",
      "/api/rooms",
      "/api/sessions",
      "/api/approvals",
      "/api/assignments",
      "/api/submissions",
      "/api/recordings",
      "/api/profile",
      "/api/system/status",
    ],
  });
});

// 1. Health check & status
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    supabaseConfigured: Boolean(supabase),
    timestamp: new Date().toISOString(),
  });
});

// 2. Dashboard telemetry
app.get("/api/dashboard", async (req, res) => {
  try {
    const [studentsRes, batchesRes] = await Promise.all([
      req.supabase.from("students").select("id", { count: "exact", head: true }),
      req.supabase.from("batches").select("id", { count: "exact", head: true }),
    ]);
    if (studentsRes.error || batchesRes.error) throw studentsRes.error || batchesRes.error;
    const data = { totalStudents: studentsRes.count || 0, activeBatches: batchesRes.count || 0 };
    return res.json({ success: true, source: "supabase-user-scoped", data });
  } catch {
    return res.status(502).json({ success: false, error: "Dashboard data is temporarily unavailable." });
  }
});

// 3. Students Endpoints
app.get("/api/students", async (req, res) => {
  if (supabase) {
    try {
      const relation = req.role === "trainer" ? "trainer_students" : req.role === "accounts" ? "account_students" : "student_profiles";
      const columns = req.role === "trainer"
        ? "id,name,batch_id,status,batch_name"
        : req.role === "accounts"
          ? "id,name"
          : "id,name,phone,email,batch_id,status,joined_on,course_id,course_name,batch_name";
      const { data, error } = await req.supabase.from(relation).select(columns).order("name", { ascending: true });
      if (!error) return res.json({ success: true, count: data.length, data });
    } catch (err) {
      console.error("Supabase students error:", err);
    }
  }
  return res.status(502).json({ success: false, error: "Supabase data is temporarily unavailable." });
});

app.post("/api/students", requireRole("owner", "counselor"), async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase credentials required for server-side persistence" });
  }

  const { id, name, email, phone, course_id, batch_id, course, batch, status } = req.body;
  if (!name) return res.status(400).json({ success: false, error: "Student name is required." });
  if (!await writeRequiredAudit(req, res, "student.create_attempt", { studentId: id || null })) return;
  try {
    const studentId = id || `STU-${Date.now().toString().slice(-4)}`;
      const { data, error } = await req.supabase
      .from("students")
      .upsert({
        id: studentId,
        name,
        email: email || "",
        phone: phone || "",
         course_id: course_id || null,
         batch_id: batch_id || null,
        batch_name: batch || "Morning Batch",
        status: status || "Active",
      })
      .select("id,name,batch_id,status,joined_on,course_id,batch_name")
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/students/:id", requireAuth, studentDeleteRoleGuard, async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase credentials required" });
  }

  if (!await writeRequiredAudit(req, res, "student.delete_attempt", { studentId: req.params.id })) return;
  try {
    const { error } = await req.supabase.from("students").delete().eq("id", req.params.id);
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
      const { data, error } = await req.supabase.from("batches").select("*").order("start_date", { ascending: false });
      if (!error) return res.json({ success: true, count: data.length, data });
    } catch (err) {
      console.error("Supabase batches error:", err);
    }
  }
  return res.status(502).json({ success: false, error: "Supabase data is temporarily unavailable." });
});

app.post("/api/batches", requireAuth, requireRole("owner", "counselor"), async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase credentials required" });
  }

  const { id, name, course_id, course_name, trainer_id, trainer_name, mode, start_date, slot_days, slot_start, slot_end, room_id, online_seat_limit } = req.body;
  if (!name || !start_date) {
    return res.status(400).json({ success: false, error: "Batch name and start_date are required" });
  }
  if (!await writeRequiredAudit(req, res, "batch.create_attempt", { batchId: typeof id === "string" ? id : null })) return;

  try {
    const batchId = id || `BAT-${Date.now().toString().slice(-5)}`;
      const { data, error } = await req.supabase
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
app.get("/api/fees", requireRole("owner", "accounts"), async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await req.supabase.from("instalments").select(`
        id, student_id, due_date, amount, paid_amount, status,
        students ( id, name, course_id )
      `);
      if (!error) return res.json({ success: true, count: data.length, data });
    } catch (err) {
      console.error("Supabase fees error:", err);
    }
  }
  return res.status(502).json({ success: false, error: "Supabase data is temporarily unavailable." });
});

app.post("/api/fees/payment", requireAuth, requireRole("owner", "accounts"), async (req, res) => {
  if (!supabaseServiceRole) {
    return res.status(503).json({ success: false, error: "The audited payment service is not configured." });
  }

  const { studentId, instalmentId, amount, method, utr } = req.body;
  const amountDecimal = normalizePaymentAmount(amount);
  if (typeof studentId !== "string" || !studentId.trim()
      || (instalmentId !== undefined && instalmentId !== null && (typeof instalmentId !== "string" || !instalmentId.trim()))
      || !amountDecimal
      || (method !== undefined && (typeof method !== "string" || !["bank_transfer", "upi", "cash", "card"].includes(method)))
      || (utr !== undefined && (typeof utr !== "string" || utr.length > 160))) {
    return res.status(400).json({ success: false, error: "Payment details are invalid." });
  }
  try {
    const paymentId = `PAY-${Date.now()}`;
    if (!await writeRequiredAudit(req, res, "fee.payment_attempt", {
      studentId,
      instalmentId: instalmentId || null,
      amount: amountDecimal,
      method: method || "bank_transfer",
    })) return;
    const { data, error } = await supabaseServiceRole.rpc("record_payment_for_user", {
      p_id: paymentId,
      p_student_id: studentId,
      p_instalment_id: instalmentId || null,
      p_amount: amountDecimal,
      p_method: method || "bank_transfer",
      p_utr: utr || "",
      p_received_on: new Date().toISOString().slice(0, 10),
      p_auth_user_id: req.authContext.authUserId,
      p_institute_id: req.authContext.instituteId,
    });
    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Attendance
app.get("/api/attendance", async (req, res) => {
  if (supabase) {
    try {
      const query = req.supabase.from("attendance").select(`
        id, session_id, student_id, status, checkin_at, created_at,
        students ( id, name ),
        sessions ( id, batch_id, date, start, "end" )
      `).order("created_at", { ascending: false }).limit(200);

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
  return res.status(502).json({ success: false, error: "Supabase data is temporarily unavailable." });
});

app.post("/api/attendance", requireAuth, requireRole("owner"), async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase credentials required" });
  }

  const { session_id, records } = req.body;
  // records = [{ student_id, status }]
  if (typeof session_id !== "string" || !session_id.trim() || !Array.isArray(records) || records.length !== 1) {
    return res.status(400).json({ success: false, error: "An owner may mark one record at a time; bulk attendance must use the approval workflow." });
  }

  try {
    const statusMap = { present: "Present", absent: "Absent", late: "Late" };
    const rows = records.map((r) => ({
      id: `ATT-${randomUUID()}`,
      session_id,
      student_id: typeof r?.student_id === "string" ? r.student_id.trim() : "",
      status: statusMap[String(r?.status || "present").toLowerCase()],
      checkin_at: new Date().toISOString(),
    }));
    if (rows.some((row) => !row.student_id || !row.status)) {
      return res.status(400).json({ success: false, error: "Each attendance record needs a student_id and a valid Present, Absent, or Late status." });
    }

    if (!await writeRequiredAudit(req, res, "attendance.mark_attempt", {
      sessionId: session_id,
      studentId: rows[0].student_id,
      status: rows[0].status,
    })) return;

    const { data, error } = await req.supabase.from("attendance").upsert(rows, {
      onConflict: "session_id,student_id",
    }).select("id,session_id,student_id,status,checkin_at,created_at");

    if (error) throw error;
    return res.json({ success: true, count: data.length, data });
  } catch {
    return res.status(502).json({ success: false, error: "The attendance record could not be saved." });
  }
});

// 7. Trainers
app.get("/api/trainers", async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await req.supabase.from("trainers").select(`
        id, name, skills, weekly_hours_max, created_at,
        trainer_availability ( weekday, start, "end" )
      `).order("name", { ascending: true });
      if (!error) return res.json({ success: true, count: data.length, data });
    } catch (err) {
      console.error("Supabase trainers error:", err);
    }
  }
  return res.status(502).json({ success: false, error: "Supabase data is temporarily unavailable." });
});

// 8. Courses
app.get("/api/courses", async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await req.supabase.from("course_catalog").select("id, name, duration_weeks").order("name", { ascending: true });
      if (!error) return res.json({ success: true, count: data.length, data });
    } catch (err) {
      console.error("Supabase courses error:", err);
    }
  }
  return res.status(502).json({ success: false, error: "Supabase data is temporarily unavailable." });
});

// 9. Audit Log (owner only)
app.get("/api/audit-log", requireAuth, requireRole("owner"), async (req, res) => {
  if (supabase) {
    try {
      const rawLimit = req.query.limit === undefined ? 50 : Number(req.query.limit);
      if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 200) {
        return res.status(400).json({ success: false, error: "limit must be an integer from 1 to 200." });
      }
      if (req.query.role && !["owner", "counselor", "trainer", "accounts"].includes(req.query.role)) {
        return res.status(400).json({ success: false, error: "Unsupported audit role filter." });
      }
      if (req.query.event && (typeof req.query.event !== "string" || req.query.event.length > 120)) {
        return res.status(400).json({ success: false, error: "event filter is too long." });
      }
      let query = req.supabase.from("audit_log")
        .select("id,at,user_id,role,event,detail,institute_id")
        .order("at", { ascending: false })
        .limit(rawLimit);
      if (req.query.role) query = query.eq("role", req.query.role);
      if (req.query.event && req.query.event !== "All events") query = query.eq("event", req.query.event);
      const { data, error } = await query;
      if (!error) return res.json({ success: true, count: data.length, data });
    } catch (err) {
      console.error("Supabase audit_log error:", err);
    }
  }
  return res.status(502).json({ success: false, error: "Supabase data is temporarily unavailable." });
});

// 10. User Profile (authenticated user)
app.get("/api/profile", requireAuth, async (req, res) => {
  return res.json({
    success: true,
    data: {
      id: req.user.id,
      email: req.user.email || null,
      name: req.user.user_metadata?.name || req.user.email?.split("@")[0] || "",
      role: req.role,
      avatar_url: null,
    },
  });
});

app.put("/api/profile", requireAuth, async (req, res) => {
  return res.status(501).json({ success: false, error: "Profile editing is not connected to a persistent profile store." });
});

// 11. Rooms (for timetable scheduling and capacity check)
app.get("/api/rooms", async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await req.supabase.from("rooms").select("*").order("name", { ascending: true });
      if (!error) return res.json({ success: true, count: data.length, data });
    } catch (err) {
      console.error("Supabase rooms error:", err);
    }
  }
  return res.status(502).json({ success: false, error: "Supabase data is temporarily unavailable." });
});

// 12. Sessions / Timetable
app.get("/api/sessions", async (req, res) => {
  if (supabase) {
    try {
      let query = req.supabase.from("sessions").select(`
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
  return res.status(502).json({ success: false, error: "Supabase data is temporarily unavailable." });
});

app.post("/api/sessions", requireAuth, requireRole("owner", "counselor", "trainer"), async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase credentials required" });
  }

  const { id, batch_id, date, start, end } = req.body;
  if (!batch_id || !date || !start || !end) {
    return res.status(400).json({ success: false, error: "batch_id, date, start, and end are required" });
  }
  if (!await writeRequiredAudit(req, res, "session.create_attempt", { batchId: batch_id })) return;

  try {
    const sessionId = id || `SES-${Date.now().toString().slice(-6)}`;
    const { data, error } = await req.supabase.from("sessions").upsert({
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

app.patch("/api/sessions/:id", requireRole("owner", "counselor", "trainer"), async (req, res) => {
  const { date, start, end } = req.body;
  if (!date || !start || !end) return res.status(400).json({ success: false, error: "date, start, and end are required." });
  if (!await writeRequiredAudit(req, res, "session.update_attempt", { sessionId: req.params.id })) return;
  try {
    const { data, error } = await req.supabase.from("sessions")
      .update({ date, start, end })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    return res.json({ success: true, data });
  } catch {
    return res.status(502).json({ success: false, error: "The session could not be updated." });
  }
});

app.delete("/api/sessions/:id", requireRole("owner"), async (req, res) => {
  if (!await writeRequiredAudit(req, res, "session.delete_attempt", { sessionId: req.params.id })) return;
  try {
    const { error } = await req.supabase.from("sessions").delete().eq("id", req.params.id);
    if (error) throw error;
    return res.json({ success: true, data: { id: req.params.id } });
  } catch {
    return res.status(502).json({ success: false, error: "The session could not be deleted." });
  }
});

// 13. Approvals Workflow
app.get("/api/approvals", requireAuth, async (req, res) => {
  if (supabase) {
    try {
      let query = req.supabase.from("approvals").select("*").order("created_at", { ascending: false });
      if (req.query.status) query = query.eq("status", req.query.status);
      const { data, error } = await query;
      if (!error) return res.json({ success: true, count: data.length, data });
    } catch (err) {
      console.error("Supabase approvals error:", err);
    }
  }
  return res.status(502).json({ success: false, error: "Supabase data is temporarily unavailable." });
});

app.post("/api/approvals", requireAuth, async (req, res) => {
  if (!supabaseServiceRole) {
    return res.status(503).json({ success: false, error: "The audited approval service is not configured." });
  }

  const { id, kind, payload, preview } = req.body;
  if (typeof kind !== "string" || !kind.trim() || kind.length > 120
      || typeof preview !== "string" || preview.length > 8000) {
    return res.status(400).json({ success: false, error: "A valid approval kind and preview are required." });
  }
  const allowedRequest = req.authContext.role === "owner"
    || req.authContext.role === "counselor"
    || (req.authContext.role === "trainer" && kind.startsWith("attendance_"))
    || (req.authContext.role === "accounts" && ["fee_reconciliation", "fee_action"].includes(kind));
  if (!allowedRequest) return res.status(403).json({ success: false, error: "This role cannot request the selected approval." });

  try {
    const approvalId = typeof id === "string" && id.length <= 120 ? id : `APP-${randomUUID()}`;
    if (preview && !await writeRequiredAudit(req, res, "copilot.preview_attempt", {
      approvalId,
      kind,
      previewLength: preview.length,
    })) return;
    if (!await writeRequiredAudit(req, res, "approval.request_attempt", { approvalId, kind })) return;
    const { data, error } = await supabaseServiceRole.from("approvals").insert({
      id: approvalId,
      institute_id: req.authContext.instituteId,
      kind,
      payload: payload || {},
      preview: preview || "",
      requested_by: req.authContext.userId,
    }).select().single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch("/api/approvals/:id", requireAuth, requireRole("owner", "accounts"), async (req, res) => {
  if (!supabaseServiceRole) {
    return res.status(503).json({ success: false, error: "The audited approval service is not configured." });
  }

  const { status } = req.body;
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ success: false, error: "status must be 'approved' or 'rejected'" });
  }

  try {
    const { data: existing, error: readError } = await supabaseServiceRole.from("approvals")
      .select("id,institute_id,kind,status,payload")
      .eq("id", req.params.id)
      .eq("institute_id", req.authContext.instituteId)
      .maybeSingle();
    if (readError) throw readError;
    if (!existing) return res.status(404).json({ success: false, error: "Approval was not found." });
    if (existing.status !== "pending") return res.status(409).json({ success: false, error: "Approval is no longer pending." });
    if (req.authContext.role === "accounts" && !["fee_reconciliation", "fee_action"].includes(existing.kind)) {
      return res.status(403).json({ success: false, error: "Accounts may decide fee approvals only." });
    }
    let approvedPayload;
    if (Object.hasOwn(req.body || {}, "payload")) {
      if (status !== "approved" || existing.kind !== "whatsapp_reminders") {
        return res.status(400).json({ success: false, error: "Only an approved WhatsApp preview may include edited messages." });
      }
      try {
        approvedPayload = withApprovedReminderMessages(existing.payload, req.body.payload);
      } catch (error) {
        return res.status(400).json({ success: false, error: error.message });
      }
    }
    if (status === "approved") {
      if (!await writeRequiredAudit(req, res, "approval.execution_blocked", {
        approvalId: existing.id,
        kind: existing.kind,
        reason: "transactional_action_executor_unavailable",
      })) return;
      return res.status(501).json({
        success: false,
        error: "This approval remains pending because its action cannot yet be applied transactionally.",
      });
    }
    const event = status === "approved" ? "copilot.approval_attempt" : "copilot.rejection_attempt";
    const auditDetails = { approvalId: existing.id, kind: existing.kind, decision: status };
    if (approvedPayload) {
      auditDetails.editedPayloadHash = createHash("sha256").update(JSON.stringify(approvedPayload)).digest("hex");
      auditDetails.recipientCount = approvedPayload.recipients.length;
    }
    if (!await writeRequiredAudit(req, res, event, auditDetails)) return;

    const { data, error } = await supabaseServiceRole.from("approvals")
      .update({
        status,
        decided_by: req.authContext.userId,
        decided_at: new Date().toISOString(),
        ...(approvedPayload ? { payload: approvedPayload } : {}),
      })
      .eq("id", req.params.id)
      .eq("institute_id", req.authContext.instituteId)
      .eq("status", "pending")
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14. Assignments & Submissions
app.get("/api/assignments", async (req, res) => {
  if (supabase) {
    try {
      let query = req.supabase.from("assignments").select(`
        id, batch_id, title, due_date:due, created_at,
        batches ( id, name, course_name )
      `).order("due", { ascending: true });

      if (req.query.batch_id) query = query.eq("batch_id", req.query.batch_id);
      const { data, error } = await query;
      if (!error) {
        const assignments = data.map((assignment) => ({ ...assignment, max_score: 100 }));
        return res.json({ success: true, count: assignments.length, data: assignments });
      }
    } catch (err) {
      console.error("Supabase assignments error:", err);
    }
  }
  return res.status(502).json({ success: false, error: "Supabase data is temporarily unavailable." });
});

app.post("/api/assignments", requireAuth, requireRole("owner", "counselor", "trainer"), async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase credentials required" });
  }

  const { id, batch_id, title, due_date, due } = req.body;
  const assignmentDue = due_date || due;
  if (!batch_id || !title || !assignmentDue) {
    return res.status(400).json({ success: false, error: "batch_id, title, and due_date are required" });
  }
  if (!await writeRequiredAudit(req, res, "assignment.create_attempt", { batchId: batch_id, assignmentId: typeof id === "string" ? id : null })) return;

  try {
    const assignmentId = id || `ASN-${Date.now().toString().slice(-6)}`;
    const { data, error } = await req.supabase.from("assignments").upsert({
      id: assignmentId,
      batch_id,
      title,
      due: assignmentDue,
    }).select("id,batch_id,title,due,created_at").single();

    if (error) throw error;
    res.json({ success: true, data: { ...data, due_date: data.due, max_score: 100 } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/submissions", async (req, res) => {
  if (supabase) {
    try {
      let query = req.supabase.from("submissions").select(`
        id, assignment_id, student_id, score, submitted_at,
        students ( id, name ),
        assignments ( id, title, batch_id, due )
      `).order("submitted_at", { ascending: false });

      if (req.query.assignment_id) query = query.eq("assignment_id", req.query.assignment_id);
      if (req.query.student_id) query = query.eq("student_id", req.query.student_id);

      const { data, error } = await query;
      if (!error) {
        const submissions = data.map((submission) => ({
          ...submission,
          status: submission.score == null ? "submitted" : "graded",
          assignments: submission.assignments
            ? { ...submission.assignments, max_score: 100 }
            : submission.assignments,
        }));
        return res.json({ success: true, count: submissions.length, data: submissions });
      }
    } catch (err) {
      console.error("Supabase submissions error:", err);
    }
  }
  return res.status(502).json({ success: false, error: "Supabase data is temporarily unavailable." });
});

app.post("/api/submissions", requireAuth, requireRole("owner", "counselor", "trainer"), async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase credentials required" });
  }

  const { id, assignment_id, student_id, score } = req.body;
  if (!assignment_id || !student_id) {
    return res.status(400).json({ success: false, error: "assignment_id and student_id are required" });
  }
  if (!await writeRequiredAudit(req, res, "submission.create_attempt", { assignmentId: assignment_id, studentId: student_id })) return;

  try {
    const submissionId = id || `SUB-${Date.now().toString().slice(-6)}`;
    const { data, error } = await req.supabase.from("submissions").upsert({
      id: submissionId,
      assignment_id,
      student_id,
      score: score !== undefined ? Number(score) : null,
      submitted_at: new Date().toISOString(),
    }).select("id,assignment_id,student_id,score,submitted_at").single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 15. Lecture Recordings
app.get("/api/recordings", async (req, res) => {
  if (supabase) {
    try {
      let query = req.supabase.from("recordings").select(`
        id, session_id, url, duration_min, created_at,
        sessions ( id, batch_id, date, start, "end" )
      `).order("created_at", { ascending: false });

      if (req.query.session_id) query = query.eq("session_id", req.query.session_id);
      const { data, error } = await query;
      if (!error) return res.json({ success: true, count: data.length, data });
    } catch (err) {
      console.error("Supabase recordings error:", err);
    }
  }
  return res.status(502).json({ success: false, error: "Supabase data is temporarily unavailable." });
});

app.post("/api/recordings", requireAuth, requireRole("owner", "counselor", "trainer"), async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase credentials required" });
  }

  const { id, session_id, url, duration_min } = req.body;
  if (!session_id || !url) {
    return res.status(400).json({ success: false, error: "session_id and url are required" });
  }
  if (!await writeRequiredAudit(req, res, "recording.create_attempt", { sessionId: session_id, recordingId: typeof id === "string" ? id : null })) return;

  try {
    const recordingId = id || `REC-${Date.now().toString().slice(-6)}`;
    const { data, error } = await req.supabase.from("recordings").upsert({
      id: recordingId,
      session_id,
      url,
      duration_min: Number(duration_min) || 60,
    }).select().single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 16. Admin Resources (Trainers, Courses, Rooms)
app.post("/api/trainers", requireAuth, requireRole("owner"), async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase credentials required" });
  }

  const { id, name, auth_user_id, skills, specialization, weekly_hours_max } = req.body;
  if (!name) return res.status(400).json({ success: false, error: "Trainer name is required" });
  if (!await writeRequiredAudit(req, res, "trainer.create_attempt", { trainerId: typeof id === "string" ? id : null })) return;

  try {
    const trainerId = id || `TRN-${Date.now().toString().slice(-4)}`;
    const trainerRow = {
      id: trainerId,
      name,
      skills: skills || specialization || "General",
      weekly_hours_max: Number(weekly_hours_max) || 24,
    };
    if (Object.hasOwn(req.body, "auth_user_id")) trainerRow.auth_user_id = auth_user_id || null;
    const { data, error } = await req.supabase.from("trainers").upsert(trainerRow)
      .select("id,name,skills,weekly_hours_max,created_at").single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/courses", requireAuth, requireRole("owner"), async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase credentials required" });
  }

  const { id, name, duration_weeks, fee_total, fee_default } = req.body;
  if (!name) return res.status(400).json({ success: false, error: "Course name is required" });
  if (!await writeRequiredAudit(req, res, "course.create_attempt", { courseId: typeof id === "string" ? id : null })) return;

  try {
    const courseId = id || `CRS-${Date.now().toString().slice(-4)}`;
    const { data, error } = await req.supabase.from("courses").upsert({
      id: courseId,
      name,
      duration_weeks: Number(duration_weeks) || 12,
      fee_total: Number(fee_total ?? fee_default) || 45000,
    }).select("id,name,duration_weeks,created_at").single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/rooms", requireAuth, requireRole("owner"), async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Supabase credentials required" });
  }

  const { id, name, capacity } = req.body;
  if (!name) return res.status(400).json({ success: false, error: "Room name is required" });
  if (!await writeRequiredAudit(req, res, "room.create_attempt", { roomId: typeof id === "string" ? id : null })) return;

  try {
    const roomId = id || `RM-${Date.now().toString().slice(-4)}`;
    const { data, error } = await req.supabase.from("rooms").upsert({
      id: roomId,
      name,
      capacity: Number(capacity) || 30,
    }).select().single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 17. Audit Log Recording
app.post("/api/audit-log", requireAuth, async (req, res) => {
  return res.status(405).json({ success: false, error: "Audit events are written only by protected server operations." });
});

app.post("/api/audit-log/export", requireAuth, async (req, res) => {
  const { resource, format = "csv", filters = {} } = req.body || {};
  if (!new Set(["attendance", "audit_log", "student_records"]).has(resource) || format !== "csv") {
    return res.status(400).json({ success: false, error: "Unsupported export request." });
  }
  if (!filters || typeof filters !== "object" || Array.isArray(filters)
      || Object.keys(filters).some((key) => !["query", "role", "event"].includes(key))
      || (filters.query !== undefined && (typeof filters.query !== "string" || filters.query.length > 100))
      || (filters.role !== undefined && filters.role !== "All roles" && !["owner", "counselor", "trainer", "accounts"].includes(filters.role))
      || (filters.event !== undefined && (typeof filters.event !== "string" || filters.event.length > 120))) {
    return res.status(400).json({ success: false, error: "Unsupported export filters." });
  }
  if (resource === "audit_log" && req.authContext.role !== "owner") {
    return res.status(403).json({ success: false, error: "Only an owner can export the audit log." });
  }
  if (!await writeRequiredAudit(req, res, "data.export_attempt", { resource, format, filtered: Object.keys(filters).length > 0 })) return;
  if (resource === "audit_log") {
    if (!supabase) return res.status(503).json({ success: false, error: "Supabase data is temporarily unavailable." });
    try {
      let query = req.supabase.from("audit_log")
        .select("id,at,user_id,role,event,detail,institute_id")
        .order("at", { ascending: false })
        .limit(5001);
      if (filters.role && filters.role !== "All roles") query = query.eq("role", filters.role);
      if (filters.event && filters.event !== "All events") query = query.eq("event", filters.event);
      const { data, error } = await query;
      if (error || !Array.isArray(data)) return res.status(502).json({ success: false, error: "The audit export could not be loaded." });
      if (data.length > 5000) return res.status(413).json({ success: false, error: "The audit export exceeds 5,000 rows; add filters and try again." });
      const search = (filters.query || "").trim().toLocaleLowerCase();
      const filtered = search
        ? data.filter((entry) => [entry.event, entry.detail, entry.user_id, entry.role].some((value) => String(value || "").toLocaleLowerCase().includes(search)))
        : data;
      res.type("text/csv");
      res.attachment("instituteos-audit-log.csv");
      return res.send(auditRowsToCsv(filtered));
    } catch {
      return res.status(502).json({ success: false, error: "The audit export could not be loaded." });
    }
  }
  return res.json({ success: true });
});

// 18. AI Copilot Execution Gateway
export function isFinancialCopilotRequest(prompt, intent = "") {
  return isTrainerFinanceQuestion(prompt)
    || /fee|emi|payment/i.test(String(intent || ""));
}

app.post("/api/copilot/audit", requireAuth, async (req, res) => {
  const event = req.body?.event;
  const detail = req.body?.detail;
  if (!["copilot.local_query", "copilot.local_answer"].includes(event) || !detail || typeof detail !== "object" || Array.isArray(detail)) {
    return res.status(400).json({ success: false, error: "Unsupported Copilot audit event." });
  }
  const safeDetail = {};
  if (event === "copilot.local_query") {
    if (typeof detail.sql !== "string" || detail.sql.length > 12000) return res.status(400).json({ success: false, error: "A bounded SQL statement is required." });
    safeDetail.sql = detail.sql;
    safeDetail.rowCount = Math.max(0, Math.min(Number(detail.rowCount) || 0, 200));
    safeDetail.promptVersion = PROMPT_VERSION;
  } else {
    safeDetail.promptHash = typeof detail.promptHash === "string" ? detail.promptHash.slice(0, 64) : "";
    safeDetail.mode = "local";
    safeDetail.promptVersion = PROMPT_VERSION;
  }
  if (!await writeRequiredAudit(req, res, event, safeDetail)) return;
  return res.json({ success: true });
});

app.post("/api/copilot/feedback", requireAuth, async (req, res) => {
  const { answerId, feedback } = req.body || {};
  if (typeof answerId !== "string" || answerId.length > 120 || !["up", "down"].includes(feedback)) {
    return res.status(400).json({ success: false, error: "A valid answer ID and feedback value are required." });
  }
  if (!await writeRequiredAudit(req, res, "copilot.feedback", { answerId, feedback, promptVersion: PROMPT_VERSION })) return;
  return res.json({ success: true });
});

app.post("/api/copilot/chat", requireAuth, async (req, res) => {
  const question = req.body?.question;
  if (typeof question !== "string" || !question.trim() || question.length > 4000) {
    return res.status(400).json({ success: false, error: "A question of up to 4,000 characters is required." });
  }
  const controller = new AbortController();
  req.once("aborted", () => controller.abort());
  res.once("close", () => { if (!res.writableEnded) controller.abort(); });
  res.status(200);
  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  const send = (event, payload) => {
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  };
  try {
    const result = await copilotService.run(req, question.trim(), { signal: controller.signal, emit: (event, payload) => send(event, payload) });
    if (result.queryResult) send("query", result.queryResult);
    const answer = result.answer || "I could not complete that request.";
    if (!result.fallbackAvailable && !result.streamedText) {
      for (let index = 0; index < answer.length; index += 48) send("token", { text: answer.slice(index, index + 48) });
    }
    send("complete", {
      mode: result.mode,
      dataMode: result.dataMode || "none",
      answer,
      refusal: Boolean(result.refusal),
      fallbackAvailable: Boolean(result.fallbackAvailable),
      unavailableReason: result.unavailableReason || null,
      sql: result.queryResult?.sql || null,
      columns: result.queryResult?.columns || [],
      rows: result.queryResult?.rows || [],
      truncated: Boolean(result.queryResult?.truncated),
      actionPreview: result.actionPreview || null,
      followups: result.followups || [],
      promptVersion: result.promptVersion || PROMPT_VERSION,
      answerId: result.answerId || randomUUID(),
    });
    res.end();
  } catch (error) {
    if (error instanceof CopilotFallbackRequired && error.message === "audit-unavailable") {
      if (!res.headersSent) res.status(503);
      send("error", { error: "Copilot audit logging is unavailable; the request was not processed." });
    } else if (Number.isInteger(error?.status)) {
      send("error", { error: error.message, status: error.status });
    } else {
      send("error", { error: "The Copilot request could not be completed." });
    }
    res.end();
  }
});

// Compatibility endpoint for older clients. New clients use the SSE route.
app.post("/api/copilot/query", requireAuth, async (req, res) => {
  const prompt = req.body?.prompt;
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 4000) {
    return res.status(400).json({ success: false, error: "A prompt of up to 4,000 characters is required." });
  }
  try {
    const result = await copilotService.run(req, prompt.trim());
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(Number.isInteger(error?.status) ? error.status : 503).json({ success: false, error: "The Copilot request could not be completed." });
  }
});

// 19. System Status & Diagnostics
app.get("/api/system/status", async (req, res) => {
  const status = {
    server: "healthy",
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
    supabase: {
      configured: Boolean(supabase),
      url: supabaseUrl ? `${supabaseUrl.slice(0, 15)}...` : "not configured",
    },
    tables: {},
  };

  if (supabase) {
    try {
      const tablesToCheck = ["users", "students", "batches", "courses", "trainers", "rooms", "attendance"];
      if (["owner", "accounts"].includes(req.role)) tablesToCheck.push("instalments");
      const counts = await Promise.all(
        tablesToCheck.map(async (tbl) => {
          try {
            const { count, error } = await req.supabase.from(tbl).select("id", { count: "exact", head: true });
            return [tbl, error ? "error" : count ?? 0];
          } catch {
            return [tbl, "unavailable"];
          }
        })
      );
      status.tables = Object.fromEntries(counts);
    } catch (err) {
      status.supabase.error = err.message;
    }
  }

  res.json({ success: true, data: status });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error("API request failed:", error?.name || "Error");
  if (error?.type === "entity.too.large" || error?.status === 413) {
    return res.status(413).json({ success: false, error: "Request body exceeds the 256 KB limit." });
  }
  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, error: "Request body must be valid JSON." });
  }
  return res.status(500).json({ success: false, error: "The request could not be completed." });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "..", "dist");

// Serve Vite frontend in production
app.use(express.static(distPath));
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api/")) {
    return res.sendFile(path.join(distPath, "index.html"), (err) => {
      if (err) next();
    });
  }
  next();
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`InstituteOS API server running at http://localhost:${PORT}`);
  });
}
