import { createClient } from "@supabase/supabase-js";
import { createSupabaseAuth } from "./supabaseAuth.js";
import { inspectSupabaseConfig, supabaseEnvironmentConfig } from "./supabaseConfig.js";
import { localDemoMode } from "../lib/localDemo.js";

export let supabaseConfigStatus = inspectSupabaseConfig(supabaseEnvironmentConfig);
export let supabaseEnabled = supabaseConfigStatus.configured && !localDemoMode;

let client = null;
if (supabaseEnabled) {
  try {
    client = createClient(supabaseEnvironmentConfig.url, supabaseEnvironmentConfig.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  } catch {
    // Keep diagnostics limited to variable names; never expose environment values.
    supabaseConfigStatus = Object.freeze({
      configured: false,
      missingVariables: Object.freeze([]),
      invalidVariables: Object.freeze(["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]),
      issues: Object.freeze(["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]),
    });
    supabaseEnabled = false;
  }
}

export const supabaseClient = client;
const supabaseAuth = createSupabaseAuth(supabaseClient);

/** Resolve the active staff role from the database membership, never user-editable metadata. */
export async function getAuthenticatedInstituteContext() {
  return supabaseAuth.getAuthenticatedInstituteContext();
}

/**
 * Fetch initial data from Supabase for role-scoped database cache
 */
export async function fetchSupabaseSeed(schema, role) {
  if (!supabaseClient) return null;
  const entries = Object.entries(schema);
  const views = {
    owner: { students: "student_profiles", courses: "course_catalog" },
    counselor: { students: "student_profiles", courses: "course_catalog", fee_summary: "counselor_fee_summary" },
    trainer: { students: "trainer_students", courses: "course_catalog" },
    accounts: { students: "account_students", courses: "course_catalog" },
  };

  const responses = await Promise.all(
    entries.map(async ([table, columns]) => {
      if (table === "fee_summary" && role !== "counselor") return [table, []];
      if (table === "courses" && ["owner", "accounts"].includes(role)) {
        try {
          const [catalog, finance] = await Promise.all([
            supabaseClient.from("course_catalog").select("id,name,duration_weeks,created_at"),
            supabaseClient.from("course_finance").select("id,fee_total"),
          ]);
          if (catalog.error || finance.error) throw new Error("Scoped course access was denied.");
          const financeById = new Map((finance.data || []).map((row) => [row.id, row.fee_total]));
          return [table, (catalog.data || []).map((row) => ({ ...row, fee_total: financeById.get(row.id) ?? 0 }))];
        } catch {
          throw new Error("Supabase could not load the scoped course views.");
        }
      }
      const relation = views[role]?.[table] || table;
      try {
        const { data, error } = await supabaseClient.from(relation).select(columns.join(","));
        if (error) throw new Error(`Supabase could not load ${relation}.`);
        return [table, data || []];
      } catch {
        throw new Error(`Supabase could not load ${relation}.`);
      }
    })
  );
  return Object.fromEntries(responses);
}

/**
 * Fetch live dashboard telemetry via Supabase RPC or table aggregations
 */
export async function getSupabaseDashboardTelemetry() {
  if (!supabaseClient) throw new Error("Supabase is not configured.");
  const [students, batches] = await Promise.all([
    supabaseClient.from("students").select("id", { count: "exact", head: true }),
    supabaseClient.from("batches").select("id", { count: "exact", head: true }),
  ]);
  if (students.error || batches.error) throw new Error("Supabase dashboard metrics are unavailable.");
  return { totalStudents: students.count || 0, activeBatches: batches.count || 0 };
}

/**
 * Insert or update a student record in Supabase
 */
export async function upsertSupabaseStudent(student) {
  if (!supabaseClient) return null;
  const payload = {
    id: student.id,
    name: student.name,
    phone: student.phone || "",
    email: student.email || "",
    batch_id: student.batch_id || null,
    status: student.status || "Active",
    course_id: student.course_id || null,
    batch_name: student.batch || student.batch_name || "",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseClient.from("students").upsert(payload)
    .select("id,name,batch_id,status,joined_on,course_id,batch_name").single();
  if (error) throw new Error(`Supabase student upsert failed: ${error.message}`);
  return data;
}

/**
 * Delete a student record from Supabase
 */
export async function deleteSupabaseStudent(studentId) {
  if (!supabaseClient) return false;
  const { error } = await supabaseClient.from("students").delete().eq("id", studentId);
  if (error) throw new Error(`Supabase student delete failed: ${error.message}`);
  return true;
}

/**
 * Insert a row into an arbitrary table
 */
export async function insertSupabaseRow(table, row) {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.from(table).insert(row);
  if (error) throw new Error(`Supabase insert failed for ${table}: ${error.message}`);
}

/**
 * Subscribe to realtime table updates (WebSockets)
 */
export function subscribeToSupabaseTable(table, callback) {
  if (!supabaseClient) return () => {};

  const channel = supabaseClient
    .channel(`realtime_${table}_${Date.now()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      (payload) => {
        callback?.(payload);
      }
    )
    .subscribe();

  return () => {
    supabaseClient.removeChannel(channel);
  };
}

// ─── Auth Helpers ────────────────────────────────────────────────────────────

export const signInWithEmail = (...args) => supabaseAuth.signInWithEmail(...args);
export const sendMagicLink = (...args) => supabaseAuth.sendMagicLink(...args);
export const verifyEmailOtp = (...args) => supabaseAuth.verifyEmailOtp(...args);
export const signUpWithEmail = (...args) => supabaseAuth.signUpWithEmail(...args);

/** Clear app-owned identity and audit caches without printing credential values. */
let localAuthCleanup;
export function clearLocalAuthState() {
  if (localAuthCleanup) return localAuthCleanup;
  localAuthCleanup = (async () => {
    try { localStorage.removeItem("instituteos_session"); } catch {}
    try { localStorage.removeItem("instituteos_demo_session"); } catch {}
    try {
      const database = await import("../lib/database.js");
      await database.clearLocalAuditLog();
    } catch {
      // Privacy takes precedence if the local SQL.js cache cannot be opened.
      try { localStorage.removeItem("instituteos_sqlite_v1"); } catch {}
    }
  })().finally(() => { localAuthCleanup = null; });
  return localAuthCleanup;
}

/** Sign out and clear all app-owned cached identity/audit state. */
export async function signOut() {
  let error = null;
  if (supabaseClient) {
    try {
      const result = await supabaseClient.auth.signOut();
      error = result?.error || null;
    } catch (caught) {
      error = caught;
    }
  }
  await clearLocalAuthState();
  return { error };
}

/** Return the currently authenticated user, or null. */
export async function getCurrentUser() {
  const session = await getSession();
  return session?.user || null;
}

/** Return the current active session (contains JWT), or null. */
export async function getSession() {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  return data?.session || null;
}

/**
 * Subscribe to auth state changes (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED…)
 * Returns an unsubscribe cleanup function.
 */
export function onAuthStateChange(callback) {
  if (!supabaseClient) return () => {};
  const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return () => subscription.unsubscribe();
}

/**
 * Fetch the user_profiles row for a given userId.
 * Falls back gracefully when table is missing or offline.
 */
export async function getUserProfile(userId) {
  if (!supabaseClient || !userId) return null;
  try {
    const { data, error } = await supabaseClient
      .from("user_profiles")
      .select("id, role, name, avatar_url")
      .eq("id", userId)
      .single();
    if (!error && data) return data;
  } catch (err) {
    console.warn("getUserProfile fallback:", err);
  }
  return null;
}
