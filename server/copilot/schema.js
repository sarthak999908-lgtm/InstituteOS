// The Copilot schema is deliberately narrower than table grants. PostgreSQL
// RLS remains the final tenant and row boundary for every executed query.
const sharedRelations = {
  course_catalog: ["id", "name", "duration_weeks", "created_at"],
  batches: ["id", "course_id", "trainer_id", "name", "mode", "start_date", "slot_days", "slot_start", "slot_end", "room_id", "online_seat_limit", "student_count", "course_name", "trainer_name", "created_at"],
  sessions: ["id", "batch_id", "date", "start", "end", "created_at"],
  attendance: ["id", "student_id", "session_id", "mode", "checkin_at", "join_at", "leave_at", "status", "created_at"],
  assignments: ["id", "batch_id", "title", "due", "created_at"],
  submissions: ["id", "assignment_id", "student_id", "submitted_at", "score"],
  recordings: ["id", "session_id", "url", "duration_min", "created_at"],
  trainers: ["id", "name", "skills", "weekly_hours_max", "created_at"],
  trainer_availability: ["trainer_id", "weekday", "start", "end", "created_at"],
  rooms: ["id", "name", "capacity", "created_at"],
};

const studentRelations = {
  owner: { student_profiles: ["id", "name", "batch_id", "status", "joined_on", "course_id", "course_name", "batch_name"] },
  counselor: { student_profiles: ["id", "name", "batch_id", "status", "joined_on", "course_id", "course_name", "batch_name"] },
  trainer: { trainer_students: ["id", "name", "batch_id", "status", "batch_name"] },
  accounts: { account_students: ["id", "name"] },
};

const financeRelations = {
  owner: {
    course_finance: ["id", "name", "fee_total"],
    fee_plans: ["id", "student_id", "total", "plan_type", "created_at"],
    instalments: ["id", "student_id", "due_date", "amount", "paid_amount", "paid_on", "status", "created_at"],
    payments: ["id", "student_id", "instalment_id", "amount", "method", "received_on", "created_at"],
  },
  counselor: { counselor_fee_summary: ["course_name", "status", "due_date", "instalment_count", "amount_due"] },
  accounts: {
    course_finance: ["id", "name", "fee_total"],
    fee_plans: ["id", "student_id", "total", "plan_type", "created_at"],
    instalments: ["id", "student_id", "due_date", "amount", "paid_amount", "paid_on", "status", "created_at"],
    payments: ["id", "student_id", "instalment_id", "amount", "method", "received_on", "created_at"],
  },
};

export function getAllowedSchema(role) {
  if (!Object.hasOwn(studentRelations, role)) throw new Error("Verified role is not supported.");
  return Object.freeze({
    tables: Object.freeze({
      ...sharedRelations,
      ...studentRelations[role],
      ...(role === "owner" || role === "accounts" ? { courses: ["id", "name", "duration_weeks", "created_at"] } : {}),
      ...(financeRelations[role] || {}),
    }),
  });
}

export function formatScopedSchema(role) {
  const schema = getAllowedSchema(role).tables;
  return Object.entries(schema).map(([relation, columns]) => `${relation}(${columns.join(", ")})`).join("\n");
}

export function isFinanceSensitiveRole(role) {
  return role === "trainer";
}
