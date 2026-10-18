import { getSession, supabaseEnabled } from "./supabase.js";
import { localDemoMode } from "../lib/localDemo.js";
import { localDemoApiResponse } from "./localDemoApi.js";

const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const API_BASE = env.VITE_API_URL || (typeof window !== "undefined" && window.location.origin ? `${window.location.origin}/api` : "http://localhost:5000/api");

/**
 * Internal helper to retrieve auth headers with the current Supabase JWT token
 */
async function getAuthHeaders() {
  const headers = { "Content-Type": "application/json" };
  try {
    const session = await getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  } catch {
    console.debug("Could not resolve authenticated session for API request.");
  }
  return headers;
}

/**
 * Universal fetch wrapper with automatic JWT injection and structured error handling
 */
async function apiFetch(endpoint, options = {}) {
  if (localDemoMode) return localDemoApiResponse(endpoint, options);

  const authHeaders = await getAuthHeaders();
  const mergedHeaders = { ...authHeaders, ...(options.headers || {}) };

  const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const response = await fetch(url, {
    ...options,
    headers: mergedHeaders,
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = (isJson && data?.error) || (isJson && data?.message) || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return isJson && data && "data" in data ? data.data : data;
}

// ── 1. Telemetry & Health ────────────────────────────────────────────────────
export async function getDashboard() {
  return apiFetch("/dashboard");
}

export async function getHealth() {
  return apiFetch("/health");
}

// ── 2. Students ──────────────────────────────────────────────────────────────
export async function getStudents() {
  return apiFetch("/students");
}

export async function createStudent(student) {
  return apiFetch("/students", {
    method: "POST",
    body: JSON.stringify(student),
  });
}

export async function deleteStudent(studentId) {
  return apiFetch(`/students/${studentId}`, {
    method: "DELETE",
  });
}

// ── 3. Batches ───────────────────────────────────────────────────────────────
export async function getBatches() {
  return apiFetch("/batches");
}

export async function createBatch(batchData) {
  return apiFetch("/batches", {
    method: "POST",
    body: JSON.stringify(batchData),
  });
}

// ── 4. Fees & Payments ───────────────────────────────────────────────────────
export async function getFees() {
  return apiFetch("/fees");
}

export async function recordFeePayment({ studentId, instalmentId, amount, method, utr }) {
  return apiFetch("/fees/payment", {
    method: "POST",
    body: JSON.stringify({ studentId, instalmentId, amount, method, utr }),
  });
}

// ── 5. Attendance ────────────────────────────────────────────────────────────
export async function getAttendance(filters = {}) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== "")).toString();
  return apiFetch(`/attendance${query ? `?${query}` : ""}`);
}

export async function markAttendance(sessionId, records) {
  return apiFetch("/attendance", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, records }),
  });
}

// ── 6. Academics: Trainers, Courses, Rooms ───────────────────────────────────
export async function getTrainers() {
  return apiFetch("/trainers");
}

export async function getCourses() {
  return apiFetch("/courses");
}

export async function getRooms() {
  return apiFetch("/rooms");
}

// ── 7. Sessions / Timetable ──────────────────────────────────────────────────
export async function getSessions(filters = {}) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== "")).toString();
  return apiFetch(`/sessions${query ? `?${query}` : ""}`);
}

export async function createSession(sessionData) {
  return apiFetch("/sessions", {
    method: "POST",
    body: JSON.stringify(sessionData),
  });
}

export async function updateSession(sessionId, sessionData) {
  return apiFetch(`/sessions/${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    body: JSON.stringify(sessionData),
  });
}

export async function deleteSession(sessionId) {
  return apiFetch(`/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
}

// ── 8. Approvals Workflow ────────────────────────────────────────────────────
export async function getApprovals(status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch(`/approvals${query}`);
}

export async function createApproval(approvalData) {
  return apiFetch("/approvals", {
    method: "POST",
    body: JSON.stringify(approvalData),
  });
}

export async function decideApproval(id, status, payload) {
  return apiFetch(`/approvals/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, ...(payload === undefined ? {} : { payload }) }),
  });
}

// ── 9. Profiles & Audit ──────────────────────────────────────────────────────
export async function getUserProfile() {
  return apiFetch("/profile");
}

export async function updateUserProfile(profileData) {
  return apiFetch("/profile", {
    method: "PUT",
    body: JSON.stringify(profileData),
  });
}

export async function getAuditLog(limit = 50) {
  return apiFetch(`/audit-log?limit=${limit}`);
}

/**
 * Require a server-side audit record before exporting remotely scoped data.
 * Offline demo exports remain local and do not require a backend.
 */
export async function requestAuditExport(resource, filters) {
  if (!supabaseEnabled) return { audited: false };
  return apiFetch("/audit-log/export", {
    method: "POST",
    body: JSON.stringify({ resource, format: "csv", ...(filters ? { filters } : {}) }),
  });
}

// ── 10. Assignments & Submissions ────────────────────────────────────────────
export async function getAssignments(batchId) {
  const query = batchId ? `?batch_id=${encodeURIComponent(batchId)}` : "";
  return apiFetch(`/assignments${query}`);
}

export async function createAssignment(assignmentData) {
  return apiFetch("/assignments", {
    method: "POST",
    body: JSON.stringify(assignmentData),
  });
}

export async function getSubmissions(filters = {}) {
  const query = new URLSearchParams(filters).toString();
  return apiFetch(`/submissions${query ? `?${query}` : ""}`);
}

export async function submitAssignment(submissionData) {
  return apiFetch("/submissions", {
    method: "POST",
    body: JSON.stringify(submissionData),
  });
}

// ── 11. Lecture Recordings ───────────────────────────────────────────────────
export async function getRecordings(sessionId) {
  const query = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
  return apiFetch(`/recordings${query}`);
}

export async function createRecording(recordingData) {
  return apiFetch("/recordings", {
    method: "POST",
    body: JSON.stringify(recordingData),
  });
}

// ── 12. Admin Resources ──────────────────────────────────────────────────────
export async function createTrainer(trainerData) {
  return apiFetch("/trainers", {
    method: "POST",
    body: JSON.stringify(trainerData),
  });
}

export async function createCourse(courseData) {
  return apiFetch("/courses", {
    method: "POST",
    body: JSON.stringify(courseData),
  });
}

export async function createRoom(roomData) {
  return apiFetch("/rooms", {
    method: "POST",
    body: JSON.stringify(roomData),
  });
}

// ── 13. Copilot Backend Gateway ──────────────────────────────────────────────
export async function queryCopilotBackend(prompt, intent) {
  return apiFetch("/copilot/query", {
    method: "POST",
    body: JSON.stringify({ prompt, intent }),
  });
}

export async function streamCopilotBackend(question, { signal, onStage, onText } = {}) {
  if (localDemoMode) return { mode: "local", fallbackAvailable: true, unavailableReason: "local-demo", answer: "Using the local planner." };
  const response = await fetch(`${API_BASE}/copilot/chat`, {
    method: "POST",
    signal,
    headers: await getAuthHeaders(),
    body: JSON.stringify({ question }),
  });
  if (!response.ok) {
    let message = "The Copilot request could not be completed.";
    try { message = (await response.json())?.error || message; } catch { /* Keep a safe generic response. */ }
    throw new Error(message);
  }
  if (!response.body) throw new Error("The Copilot stream is unavailable.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = null;
  let query = null;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";
      for (const block of events) {
        const lines = block.split(/\r?\n/);
        const name = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
        const payloadText = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
        if (!name || !payloadText) continue;
        const payload = JSON.parse(payloadText);
        if (name === "stage") onStage?.(payload.stage);
        else if (name === "token") onText?.(payload.text || "", false);
        else if (name === "reset") onText?.("", true);
        else if (name === "query") query = payload;
        else if (name === "complete") completed = payload;
        else if (name === "error") throw new Error(payload.error || "The Copilot request failed.");
      }
    }
  } catch (error) {
    try { await reader.cancel(); } catch { /* The stream may already be closed. */ }
    throw error;
  }
  if (!completed) throw new Error("The Copilot stream ended before completing.");
  return { ...completed, ...(query || {}) };
}

export async function auditCopilotEvent(event, detail) {
  try {
    return await apiFetch("/copilot/audit", { method: "POST", body: JSON.stringify({ event, detail }) });
  } catch {
    return null;
  }
}

export async function submitCopilotFeedback(answerId, feedback) {
  try {
    return await apiFetch("/copilot/feedback", { method: "POST", body: JSON.stringify({ answerId, feedback }) });
  } catch {
    return null;
  }
}

// ── 14. System Status & Diagnostics ──────────────────────────────────────────
export async function getSystemStatus() {
  return apiFetch("/system/status");
}
