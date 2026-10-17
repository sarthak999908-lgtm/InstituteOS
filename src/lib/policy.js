const allTables = {
  users: ["id", "name", "role", "email"],
  courses: ["id", "name", "duration_weeks"],
  trainers: ["id", "name", "skills", "weekly_hours_max"],
  trainer_availability: ["trainer_id", "weekday", "start", "end"],
  rooms: ["id", "name", "capacity"],
  batches: ["id", "course_id", "trainer_id", "name", "mode", "start_date", "slot_days", "slot_start", "slot_end", "room_id", "online_seat_limit", "student_count", "course_name", "trainer_name"],
  students: ["id", "name", "phone", "email", "batch_id", "status", "joined_on", "course_id", "batch_name"],
  attendance: ["id", "student_id", "session_id", "mode", "checkin_at", "join_at", "leave_at", "status"],
  sessions: ["id", "batch_id", "date", "start", "end"],
  assignments: ["id", "batch_id", "title", "due"],
  submissions: ["id", "assignment_id", "student_id", "submitted_at", "score"],
  fee_plans: ["id", "student_id", "total", "plan_type"],
  instalments: ["id", "student_id", "due_date", "amount", "paid_amount", "paid_on", "status"],
  payments: ["id", "student_id", "instalment_id", "amount", "method", "utr", "received_on"],
  recordings: ["id", "session_id", "url", "duration_min"],
  approvals: ["id", "kind", "payload", "preview", "status", "requested_by", "decided_by", "created_at", "decided_at"],
  audit_log: ["id", "at", "user_id", "role", "event", "detail"],
  fee_summary: ["course_name", "status", "due_date", "instalment_count", "amount_due"],
};

const operationalTables = [
  "users", "courses", "trainers", "trainer_availability", "rooms", "batches",
  "students", "attendance", "sessions", "assignments", "submissions", "recordings",
  "approvals", "audit_log",
];
const financeTables = ["fee_plans", "instalments", "payments"];

const policies = {
  owner: Object.fromEntries(Object.entries(allTables).map(([table, columns]) => [table, columns])),
  counselor: {
    ...Object.fromEntries(operationalTables.map((table) => [table, allTables[table]])),
    fee_summary: allTables.fee_summary,
  },
  trainer: {
    users: ["id", "name", "role"],
    courses: ["id", "name", "duration_weeks"],
    trainers: ["id", "name", "skills", "weekly_hours_max"],
    trainer_availability: allTables.trainer_availability,
    rooms: allTables.rooms,
    batches: allTables.batches,
    students: ["id", "name", "batch_id", "status", "batch_name"],
    attendance: allTables.attendance,
    sessions: allTables.sessions,
    assignments: allTables.assignments,
    submissions: allTables.submissions,
    recordings: allTables.recordings,
    approvals: allTables.approvals,
    audit_log: allTables.audit_log,
  },
  accounts: {
    users: ["id", "name", "role"],
    courses: ["id", "name", "fee_total", "duration_weeks"],
    trainers: ["id", "name"],
    rooms: ["id", "name"],
    batches: ["id", "course_id", "name", "course_name"],
    students: ["id", "name"],
    ...Object.fromEntries(financeTables.map((table) => [table, allTables[table]])),
    attendance: allTables.attendance,
    sessions: allTables.sessions,
    approvals: allTables.approvals,
    audit_log: allTables.audit_log,
  },
};

export function getPolicy(role = "owner", userId = "USR-OWNER") {
  if (!policies[role]) throw new Error(`Unknown role: ${role}`);
  return { role, userId, tables: structuredClone(policies[role]) };
}

export function getFullSchema() {
  return structuredClone(allTables);
}

export function canAccessTable(role, table) {
  return Boolean(policies[role]?.[table]);
}

export function canAccessColumn(role, table, column) {
  return Boolean(policies[role]?.[table]?.includes(column));
}
