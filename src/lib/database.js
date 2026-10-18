import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { dataSeed, trainerIdByUserId } from "../data/mockData.js";
import { getFullSchema, getPolicy } from "./policy.js";
import { guardSql } from "./sqlGuard.js";
import { appStorageKey } from "./localDemo.js";
import { fetchSupabaseSeed, getAuthenticatedInstituteContext, supabaseEnabled } from "../services/supabase.js";
import { createApproval as createRemoteApproval, decideApproval as decideRemoteApproval } from "../services/api.js";

const STORAGE_KEY = appStorageKey("instituteos_sqlite_v1");
const numberColumns = new Set([
  "fee_total", "duration_weeks", "weekly_hours_max", "weekday", "capacity",
  "online_seat_limit", "student_count", "score", "duration_min", "total",
  "amount", "paid_amount", "instalment_count", "amount_due",
]);

let SQL;
let master;
let masterSeed = dataSeed;
const scopedConnections = new Map();

function base64FromBytes(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function bytesFromBase64(encoded) {
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getSql() {
  if (!SQL) {
    const localWasmPath = decodeURIComponent(
      new URL("../../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url).pathname
    ).replace(/^\/([A-Z]:)/i, "$1");
    SQL = await initSqlJs({ locateFile: () => typeof window === "undefined" ? localWasmPath : wasmUrl });
  }
  return SQL;
}

function createTable(db, table, columns) {
  const definitions = columns.map((column) => `${column} ${numberColumns.has(column) ? "NUMERIC" : "TEXT"}`);
  db.run(`CREATE TABLE IF NOT EXISTS ${table} (${definitions.join(", ")})`);
}

function rowsFromTable(db, table) {
  const result = db.exec(`SELECT * FROM ${table}`)[0];
  if (!result) return [];
  return result.values.map((values) => Object.fromEntries(result.columns.map((column, index) => [column, values[index]])));
}

function insertRows(db, table, columns, rows) {
  if (!rows.length) return;
  const statement = db.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`);
  try {
    for (const row of rows) {
      statement.run(columns.map((column) => row[column] ?? null));
    }
  } finally {
    statement.free();
  }
}

function makeFeeSummary(seed) {
  const studentsById = new Map(seed.students.map((student) => [student.id, student]));
  const coursesById = new Map(seed.courses.map((course) => [course.id, course]));
  const groups = new Map();
  for (const instalment of seed.instalments) {
    const student = studentsById.get(instalment.student_id);
    const course = coursesById.get(student?.course_id);
    if (!student || !course) continue;
    const key = `${course.name}|${instalment.status}|${instalment.due_date}`;
    const group = groups.get(key) || {
      course_name: course.name,
      status: instalment.status,
      due_date: instalment.due_date,
      instalment_count: 0,
      amount_due: 0,
    };
    group.instalment_count += 1;
    group.amount_due += Math.max(0, instalment.amount - instalment.paid_amount);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function persistMaster() {
  if (!master) return;
  localStorage.setItem(STORAGE_KEY, base64FromBytes(master.export()));
}

async function getMaster() {
  if (master) return master;
  const Sql = await getSql();
  const schema = getFullSchema();
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      master = new Sql.Database(bytesFromBase64(saved));
      masterSeed = Object.fromEntries(Object.keys(schema).map((table) => [table, rowsFromTable(master, table)]));
      return master;
    } catch (error) {
      console.warn("Saved local institute database could not be restored; reseeding.", error);
    }
  }

  masterSeed ||= dataSeed;
  master = new Sql.Database();
  for (const [table, columns] of Object.entries(schema)) createTable(master, table, columns);
  for (const [table, columns] of Object.entries(schema)) {
    const rows = table === "fee_summary" ? makeFeeSummary(masterSeed) : masterSeed[table] || [];
    insertRows(master, table, columns, rows);
  }
  persistMaster();
  return master;
}

function filterRowsForRole(role, userId, table, rows, seed) {
  if (role !== "trainer") return rows;
  const trainerId = trainerIdByUserId[userId];
  if (!trainerId) return [];
  const ownBatchIds = new Set(seed.batches.filter((batch) => batch.trainer_id === trainerId).map((batch) => batch.id));
  const ownStudentIds = new Set(seed.students.filter((student) => ownBatchIds.has(student.batch_id)).map((student) => student.id));
  const ownSessionIds = new Set(seed.sessions.filter((session) => ownBatchIds.has(session.batch_id)).map((session) => session.id));
  const ownAssignmentIds = new Set(seed.assignments.filter((assignment) => ownBatchIds.has(assignment.batch_id)).map((assignment) => assignment.id));
  const rules = {
    batches: (row) => ownBatchIds.has(row.id),
    trainer_availability: (row) => row.trainer_id === trainerId,
    students: (row) => ownStudentIds.has(row.id),
    sessions: (row) => ownSessionIds.has(row.id),
    attendance: (row) => ownSessionIds.has(seed.sessions.find((session) => session.id === row.session_id)?.id),
    assignments: (row) => ownBatchIds.has(row.batch_id),
    submissions: (row) => ownStudentIds.has(row.student_id) && ownAssignmentIds.has(row.assignment_id),
    recordings: (row) => ownSessionIds.has(row.session_id),
    users: (row) => row.id === userId,
    trainers: (row) => row.id === trainerId,
    audit_log: (row) => row.user_id === userId,
  };
  return rules[table] ? rows.filter(rules[table]) : rows;
}

export async function getRoleDatabase(role = "owner", userId = "USR-OWNER") {
  const key = `${role}:${userId}`;
  if (scopedConnections.has(key)) return scopedConnections.get(key);
  const Sql = await getSql();
  const policy = getPolicy(role, userId);
  const scoped = new Sql.Database();
  const schema = policy.tables;
  for (const [table, columns] of Object.entries(schema)) createTable(scoped, table, columns);

  if (supabaseEnabled) {
    try {
      const remoteRows = await fetchSupabaseSeed(schema, role);
      const hasAnyData = remoteRows && Object.values(remoteRows).some((r) => Array.isArray(r) && r.length > 0);
      if (hasAnyData) {
        for (const [table, columns] of Object.entries(schema)) {
          const rows = remoteRows[table] || [];
          insertRows(scoped, table, columns, rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column] ?? null]))));
        }
        scopedConnections.set(key, scoped);
        return scoped;
      }
    } catch (err) {
      console.warn("fetchSupabaseSeed fallback to master seed:", err.message);
    }
  }

  const source = await getMaster();

  for (const [table, columns] of Object.entries(schema)) {
    let rows = table === "fee_summary" ? makeFeeSummary(masterSeed) : rowsFromTable(source, table);
    rows = filterRowsForRole(role, userId, table, rows, masterSeed);
    insertRows(scoped, table, columns, rows.map((row) =>
      Object.fromEntries(columns.map((column) => [column, row[column] ?? null]))
    ));
  }
  scopedConnections.set(key, scoped);
  return scoped;
}

export async function runRoleQuery({ role = "owner", userId = "USR-OWNER", sql, params = [] }) {
  const guarded = guardSql(sql, role, params);
  const db = await getRoleDatabase(role, userId);
  const statement = db.prepare(guarded.sql);
  const rows = [];
  try {
    if (params.length) statement.bind(params);
    while (statement.step()) rows.push(statement.getAsObject());
  } finally {
    statement.free();
  }
  await addAuditEntry({ role, userId, event: "query", detail: guarded.sql });
  return { sql: guarded.sql, columns: Object.keys(rows[0] || {}), rows };
}

function insertMasterRecord(table, row) {
  const schema = getFullSchema();
  if (!schema[table]) throw new Error(`Unknown data table: ${table}`);
  const columns = schema[table];
  const safeRow = Object.fromEntries(columns.map((column) => [column, row[column] ?? null]));
  insertRows(master, table, columns, [safeRow]);
  scopedConnections.clear();
  persistMaster();
}

export async function addAuditEntry({ role, userId, event, detail }) {
  await getMaster();
  const entry = {
    id: `AUD-${crypto.randomUUID()}`,
    at: new Date().toISOString(),
    user_id: userId,
    role,
    event,
    detail: typeof detail === "string" ? detail : JSON.stringify(detail),
  };
  // This helper records local browser/SQLite activity only. Remote audit writes
  // must go through a trusted server-side operation; direct client inserts are
  // intentionally disabled by the Supabase policies.
  insertMasterRecord("audit_log", entry);
  return entry;
}

export async function createApproval({ role, userId, kind, payload, preview }) {
  const allowedRequest = role === "owner" || role === "counselor" || (role === "trainer" && kind.startsWith("attendance_")) || (role === "accounts" && ["fee_reconciliation", "fee_action"].includes(kind));
  if (!allowedRequest) throw new Error(`The ${role} role cannot request this action.`);
  await getMaster();
  const instituteContext = supabaseEnabled ? await getAuthenticatedInstituteContext() : null;
  if (supabaseEnabled && !instituteContext) throw new Error("A verified InstituteOS membership is required.");
  const approval = {
    id: `APR-${crypto.randomUUID()}`,
    kind,
    payload: JSON.stringify(payload),
    preview,
    status: "pending",
    requested_by: instituteContext?.user_id || userId,
    decided_by: null,
    created_at: new Date().toISOString(),
    decided_at: null,
  };
  if (supabaseEnabled) {
    const remote = await createRemoteApproval({
      id: approval.id,
      kind: approval.kind,
      payload: payload ?? {},
      preview: approval.preview,
    });
    if (remote?.id) approval.id = remote.id;
    approval.created_at = remote?.created_at || approval.created_at;
  }
  insertMasterRecord("approvals", approval);
  await addAuditEntry({ role, userId, event: "action_preview", detail: `${kind}: ${preview}` });
  return approval;
}

function applyApprovedAction(approval, payload) {
  if (approval.kind === "attendance_mark") {
    const item = payload;
    const session = dataSeed.sessions.find((row) => row.id === item.sessionId);
    const student = dataSeed.students.find((row) => row.id === item.studentId);
    if (!session || !student) throw new Error("Attendance approval refers to an unknown session or student.");
    const existing = rowsFromTable(master, "attendance").find((row) => row.session_id === item.sessionId && row.student_id === item.studentId);
    const record = {
      id: existing?.id || `ATT-${item.sessionId}-${item.studentId}`,
      student_id: item.studentId,
      session_id: item.sessionId,
      mode: existing?.mode || "classroom",
      checkin_at: item.status === "Present" || item.status === "Late" ? new Date().toISOString() : null,
      join_at: null,
      leave_at: null,
      status: item.status.toLowerCase(),
    };
    if (existing) master.run("UPDATE attendance SET status = ?, checkin_at = ? WHERE id = ?", [record.status, record.checkin_at, existing.id]);
    else insertRows(master, "attendance", getFullSchema().attendance, [record]);
    return;
  }

  if (approval.kind === "attendance_bulk_mark") {
    for (const studentId of payload.studentIds || []) applyApprovedAction({ kind: "attendance_mark" }, { sessionId: payload.sessionId, studentId, status: payload.status });
    return;
  }

  if (approval.kind === "schedule_replan") {
    const proposed = payload.grid || [];
    for (const batch of dataSeed.batches) {
      const slots = proposed.filter((slot) => slot.batch_id === batch.id);
      if (!slots.length) continue;
      const scheduledDays = [...new Set(slots.map((slot) => slot.weekday))].sort((first, second) => first - second);
      const first = [...slots].sort((left, right) => left.start.localeCompare(right.start))[0];
      const room = dataSeed.rooms.find((item) => item.name === first.room_name);
      master.run("UPDATE batches SET slot_days = ?, slot_start = ?, slot_end = ?, room_id = ? WHERE id = ?", [JSON.stringify(scheduledDays), first.start, first.end, room?.id || null, batch.id]);
    }
    return;
  }

  if (approval.kind === "fee_reconciliation") {
    for (const match of payload || []) {
      const source = match.source;
      const payment = match.payment;
      if (!source || !payment || !source.amount) continue;
      const duplicate = rowsFromTable(master, "payments").some((row) => row.utr && row.utr === source.utr);
      if (duplicate) continue;
      const paymentRow = {
        id: `PAY-REC-${crypto.randomUUID()}`,
        student_id: payment.student_id,
        instalment_id: payment.instalment_id,
        amount: source.amount,
        method: "Bank reconciliation",
        utr: source.utr,
        received_on: source.date || new Date().toISOString().slice(0, 10),
      };
      insertRows(master, "payments", getFullSchema().payments, [paymentRow]);
      if (payment.instalment_id) {
        master.run("UPDATE instalments SET paid_amount = MIN(amount, paid_amount + ?), status = CASE WHEN paid_amount + ? >= amount THEN 'paid' ELSE status END, paid_on = ? WHERE id = ?", [source.amount, source.amount, paymentRow.received_on, payment.instalment_id]);
      }
    }
  }
}

export async function decideApproval({ approvalId, role, userId, decision, payload }) {
  if (!new Set(["approve", "reject"]).has(decision)) throw new Error("Decision must be approve or reject.");
  await getMaster();
  const instituteContext = supabaseEnabled ? await getAuthenticatedInstituteContext() : null;
  if (supabaseEnabled && !instituteContext) throw new Error("A verified InstituteOS membership is required.");
  const existing = rowsFromTable(master, "approvals").find((item) => item.id === approvalId);
  if (!existing || existing.status !== "pending") throw new Error("This approval is no longer pending.");
  const mayApprove = role === "owner" || (role === "accounts" && ["fee_reconciliation", "fee_action"].includes(existing.kind));
  const mayReject = supabaseEnabled
    ? mayApprove
    : mayApprove || existing.requested_by === userId;
  if (decision === "approve" && !mayApprove) throw new Error("This role cannot approve the requested action.");
  if (decision === "reject" && !mayReject) throw new Error("This role cannot reject the requested action.");
  const savedPayload = payload === undefined ? existing.payload : JSON.stringify(payload);
  const decidedBy = instituteContext?.user_id || userId;
  const updates = { status: decision === "approve" ? "approved" : "rejected", decided_by: decidedBy, decided_at: new Date().toISOString(), payload: savedPayload };
  if (supabaseEnabled) {
    const editedReminderRecipients = decision === "approve" && existing.kind === "whatsapp_reminders" ? payload : undefined;
    await decideRemoteApproval(approvalId, updates.status, editedReminderRecipients);
  }
  master.run("BEGIN");
  try {
    if (decision === "approve") applyApprovedAction(existing, payload === undefined ? JSON.parse(existing.payload || "null") : payload);
    master.run("UPDATE approvals SET status = ?, decided_by = ?, decided_at = ?, payload = ? WHERE id = ?", [updates.status, updates.decided_by, updates.decided_at, updates.payload, approvalId]);
    master.run("COMMIT");
  } catch (error) {
    master.run("ROLLBACK");
    throw error;
  }
  scopedConnections.clear();
  persistMaster();
  await addAuditEntry({ role, userId, event: decision === "approve" ? "approval_approved" : "approval_rejected", detail: `${existing.kind}: ${existing.preview}` });
  return { ...existing, ...updates };
}

export async function listApprovals(status = "pending", role = "owner", userId = "USR-OWNER") {
  const db = await getMaster();
  let approvals = rowsFromTable(db, "approvals").filter((item) => item.status === status);
  if (role === "accounts") approvals = approvals.filter((item) => ["fee_reconciliation", "fee_action"].includes(item.kind));
  else if (role !== "owner") approvals = approvals.filter((item) => item.requested_by === userId);
  return approvals
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((item) => role === "owner" ? item : { ...item, payload: null });
}

export async function listAuditLog() {
  const db = await getMaster();
  return rowsFromTable(db, "audit_log").sort((a, b) => b.at.localeCompare(a.at));
}

export async function resetLocalDatabase() {
  master?.close();
  for (const db of scopedConnections.values()) db.close();
  master = null;
  scopedConnections.clear();
  localStorage.removeItem(STORAGE_KEY);
  return getMaster();
}

/** Remove cached audit events and role-scoped database connections on sign-out. */
export async function clearLocalAuditLog() {
  try {
    const db = await getMaster();
    db.run("DELETE FROM audit_log");
    masterSeed = { ...masterSeed, audit_log: [] };
    for (const scoped of scopedConnections.values()) scoped.close();
    scopedConnections.clear();
    persistMaster();
  } catch {
    try { master?.close(); } catch {}
    master = null;
    scopedConnections.clear();
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }
}
