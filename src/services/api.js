import { getSession } from "./supabase.js";

const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const API_BASE = env.VITE_API_URL || "http://localhost:5000/api";

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
  } catch (err) {
    console.debug("Could not resolve session for API header:", err);
  }
  return headers;
}

/**
 * Universal fetch wrapper with automatic JWT injection and structured error handling
 */
async function apiFetch(endpoint, options = {}) {
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
  const query = new URLSearchParams(filters).toString();
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
  const query = new URLSearchParams(filters).toString();
  return apiFetch(`/sessions${query ? `?${query}` : ""}`);
}

export async function createSession(sessionData) {
  return apiFetch("/sessions", {
    method: "POST",
    body: JSON.stringify(sessionData),
  });
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

export async function decideApproval(id, status) {
  return apiFetch(`/approvals/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
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