import { addAuditEntry, createApproval, runRoleQuery } from "../lib/database.js";
import { canAccessTable, getPolicy } from "../lib/policy.js";
import {
  dateWindow,
  extractBatch,
  isFinanceQuestion,
  isIdentityFinanceQuestion,
  planIntent,
} from "../features/copilot/planner.js";

const env = import.meta.env || {};
const dateToday = () => new Date().toISOString().slice(0, 10);

function missingTables(role, tables) {
  return tables.filter((table) => !canAccessTable(role, table));
}

function weekWindow(now = new Date()) {
  return dateWindow("week", now);
}

function makeQuery(intent, role, question) {
  const batch = intent.batch ? `%${intent.batch.toLowerCase()}%` : "%";
  if (intent.intent === "missed_emis") {
    const { start, end } = weekWindow();
    return {
      sql: `SELECT s.id AS student_id, s.name, s.phone, b.name AS batch,
        (SELECT COUNT(DISTINCT a.session_id) FROM attendance a WHERE a.student_id = s.id AND a.status = ?) AS missed_classes,
        (SELECT SUM(i.amount - i.paid_amount) FROM instalments i WHERE i.student_id = s.id AND i.status != ? AND i.due_date >= ? AND i.due_date <= ?) AS amount_due,
        (SELECT MIN(i.due_date) FROM instalments i WHERE i.student_id = s.id AND i.status != ? AND i.due_date >= ? AND i.due_date <= ?) AS due_date
        FROM students s JOIN batches b ON b.id = s.batch_id
        WHERE (LOWER(b.name) LIKE ? OR LOWER(b.course_name) LIKE ?)
          AND (SELECT COUNT(DISTINCT a.session_id) FROM attendance a WHERE a.student_id = s.id AND a.status = ?) >= ?
          AND EXISTS (SELECT 1 FROM instalments i WHERE i.student_id = s.id AND i.status != ? AND i.due_date >= ? AND i.due_date <= ?)
        ORDER BY missed_classes DESC, s.name LIMIT 200`,
      params: ["absent", "paid", start, end, "paid", start, end, batch, batch, "absent", intent.threshold, "paid", start, end],
      answer: "Students matching the attendance threshold and this week's EMI window.",
      tables: ["students", "batches", "attendance", "instalments"],
    };
  }

  if (intent.intent === "missed_classes" || intent.intent === "dropout_risk") {
    return {
      sql: `SELECT s.id AS student_id, s.name, b.name AS batch,
        (SELECT COUNT(DISTINCT a.session_id) FROM attendance a WHERE a.student_id = s.id AND a.status = ?) AS missed_classes
        FROM students s JOIN batches b ON b.id = s.batch_id
        WHERE (LOWER(b.name) LIKE ? OR LOWER(b.course_name) LIKE ?)
          AND (SELECT COUNT(DISTINCT a.session_id) FROM attendance a WHERE a.student_id = s.id AND a.status = ?) >= ?
        ORDER BY missed_classes DESC, s.name LIMIT 200`,
      params: ["absent", batch, batch, "absent", intent.threshold],
      answer: "Students with repeated missed sessions, ranked by absence count.",
      tables: ["students", "batches", "attendance"],
    };
  }

  if (intent.intent === "emi_due" && role === "counselor") {
    const { start, end } = dateWindow(intent.period);
    return {
      sql: "SELECT course_name, status, due_date, instalment_count, amount_due FROM fee_summary WHERE due_date >= ? AND due_date <= ? ORDER BY due_date LIMIT 200",
      params: [start, end],
      answer: "Fee summary by course and due date. Student-level fee details are restricted for counselors.",
      tables: ["fee_summary"],
    };
  }

  if (intent.intent === "emi_due") {
    const { start, end } = dateWindow(intent.period);
    return {
      sql: `SELECT s.id AS student_id, s.name, b.course_name, i.amount - i.paid_amount AS amount_due, i.due_date, i.status
        FROM instalments i JOIN students s ON s.id = i.student_id JOIN batches b ON b.id = s.batch_id
        WHERE i.status != ? AND i.amount > i.paid_amount AND i.due_date >= ? AND i.due_date <= ?
        ORDER BY i.due_date, s.name LIMIT 200`,
      params: ["paid", start, end],
      answer: "Students with an unpaid instalment in the selected date window.",
      tables: ["instalments", "students", "batches"],
    };
  }

  if (intent.intent === "fees_collected" && role === "counselor") {
    return {
      sql: "SELECT course_name, status, SUM(amount_due) AS amount_collected FROM fee_summary WHERE status = ? GROUP BY course_name, status ORDER BY amount_collected DESC LIMIT 200",
      params: ["paid"],
      answer: "Paid fee totals by course. Collection dates and student-level payment records are restricted for counselors.",
      tables: ["fee_summary"],
    };
  }

  if (intent.intent === "fees_collected") {
    const { start, end } = dateWindow(intent.period);
    return {
      sql: `SELECT c.name AS course, SUM(p.amount) AS amount_collected, COUNT(p.id) AS payment_count
        FROM payments p JOIN students s ON s.id = p.student_id JOIN courses c ON c.id = s.course_id
        WHERE p.received_on >= ? AND p.received_on <= ? GROUP BY c.name ORDER BY amount_collected DESC LIMIT 200`,
      params: [`${start}T00:00:00`, `${end}T23:59:59`],
      answer: "Payment collections for the selected period, grouped by course.",
      tables: ["payments", "students", "courses"],
    };
  }

  if (intent.intent === "trainer_load") {
    return {
      sql: "SELECT t.name AS trainer, COUNT(DISTINCT b.id) AS active_batches, SUM(CAST(SUBSTR(b.slot_end, 1, 2) AS INTEGER) - CAST(SUBSTR(b.slot_start, 1, 2) AS INTEGER)) AS scheduled_hours, t.weekly_hours_max FROM trainers t LEFT JOIN batches b ON b.trainer_id = t.id GROUP BY t.id, t.name, t.weekly_hours_max ORDER BY scheduled_hours DESC LIMIT 200",
      params: [],
      answer: "Trainer load based on the scheduled weekly batch slots.",
      tables: ["trainers", "batches"],
    };
  }

  if (intent.intent === "free_rooms") {
    return {
      sql: "SELECT r.name, r.capacity FROM rooms r ORDER BY r.capacity LIMIT 200",
      params: [],
      answer: "Available rooms in the institute inventory. Select a day and time to check slot conflicts on Schedules.",
      tables: ["rooms"],
    };
  }

  if (intent.intent === "absent_today") {
    return {
      sql: "SELECT DISTINCT s.name, b.name AS batch, se.date, se.start FROM attendance a JOIN students s ON s.id = a.student_id JOIN sessions se ON se.id = a.session_id JOIN batches b ON b.id = se.batch_id WHERE a.status = ? AND se.date = ? ORDER BY b.name, s.name LIMIT 200",
      params: ["absent", dateToday()],
      answer: "Students marked absent in today's sessions.",
      tables: ["attendance", "students", "sessions", "batches"],
    };
  }

  if (intent.intent === "recordings") {
    return {
      sql: "SELECT b.name AS batch, se.date, se.start, r.url, r.duration_min FROM recordings r JOIN sessions se ON se.id = r.session_id JOIN batches b ON b.id = se.batch_id WHERE LOWER(b.name) LIKE ? ORDER BY se.date DESC LIMIT 200",
      params: [batch],
      answer: "Recordings available for the selected batch.",
      tables: ["recordings", "sessions", "batches"],
    };
  }

  if (intent.intent === "fill_rate") {
    return {
      sql: "SELECT b.name AS batch, b.course_name AS course, b.student_count, r.capacity, ROUND(100.0 * b.student_count / r.capacity, 1) AS fill_rate_percent, b.mode FROM batches b JOIN rooms r ON r.id = b.room_id WHERE LOWER(b.name) LIKE ? OR LOWER(b.course_name) LIKE ? ORDER BY fill_rate_percent DESC LIMIT 200",
      params: [batch, batch],
      answer: "Batch occupancy compared with assigned room capacity.",
      tables: ["batches", "rooms"],
    };
  }

  if (intent.intent === "unpaid_by_course" && role === "counselor") {
    return {
      sql: "SELECT course_name, SUM(amount_due) AS amount_due, SUM(instalment_count) AS instalments FROM fee_summary WHERE status != ? GROUP BY course_name ORDER BY amount_due DESC LIMIT 200",
      params: ["paid"],
      answer: "Unpaid instalment totals grouped by course, without student identities.",
      tables: ["fee_summary"],
    };
  }

  if (intent.intent === "unpaid_by_course") {
    return {
      sql: "SELECT c.name AS course, COUNT(DISTINCT s.id) AS unpaid_students, SUM(i.amount - i.paid_amount) AS amount_due FROM instalments i JOIN students s ON s.id = i.student_id JOIN courses c ON c.id = s.course_id WHERE i.status != ? AND i.amount > i.paid_amount GROUP BY c.name ORDER BY amount_due DESC LIMIT 200",
      params: ["paid"],
      answer: "Unpaid student counts and outstanding balances by course.",
      tables: ["instalments", "students", "courses"],
    };
  }

  return {
    sql: "SELECT (SELECT COUNT(*) FROM students) AS students, (SELECT COUNT(*) FROM batches) AS batches, (SELECT COUNT(*) FROM courses) AS courses LIMIT 200",
    params: [],
    answer: "Current institute counts from the role-scoped database.",
    tables: ["students", "batches", "courses"],
  };
}

async function requestLlmSql(question, role) {
  const endpoint = env.VITE_COPILOT_ENDPOINT;
  if (env.VITE_COPILOT_MODE !== "llm" || !endpoint) return null;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, schema: getPolicy(role).tables }),
  });
  if (!response.ok) throw new Error(`Copilot endpoint returned ${response.status}.`);
  const result = await response.json();
  if (typeof result.sql !== "string") throw new Error("Copilot endpoint did not return SQL.");
  return { sql: result.sql, params: Array.isArray(result.params) ? result.params : [], answer: result.answer || "Here is the result from your institute data." };
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "the upcoming due date";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function makeActionPreview(action, rows, question) {
  if (action !== "whatsapp_reminder") return null;
  const recipients = rows.filter((row) => row.phone).map((row) => ({
    studentId: row.student_id,
    name: row.name,
    phone: row.phone,
    message: `Hello ${row.name}, we noticed ${row.missed_classes} missed classes. Your EMI of ${formatMoney(row.amount_due)} is due on ${formatDate(row.due_date)}. Please reply if you need any help. Thank you, TechSummitTrainers.`,
  }));
  return {
    kind: "whatsapp_reminder",
    question,
    recipients,
    preview: `Draft ${recipients.length} WhatsApp reminder${recipients.length === 1 ? "" : "s"}. Nothing is sent until you approve and open each link.`,
  };
}

export async function runCopilotMessage({ question, role = "owner", userId = "USR-OWNER", context = {} }) {
  const intent = planIntent(question, context);
  const restrictedFinance = isFinanceQuestion(question) && !canAccessTable(role, "instalments");
  const restrictedIdentity = role === "counselor" && isFinanceQuestion(question) && isIdentityFinanceQuestion(question);
  if (restrictedFinance || restrictedIdentity) {
    const message = restrictedFinance
      ? "I can't access fee or EMI details for this role. Fee data is available to the owner and accounts roles."
      : "I can show fee summaries, but student-level fee identity and contact details require the owner or accounts role.";
    await addAuditEntry({ role, userId, event: "permission_refusal", detail: question });
    return { intent: intent.intent, answer: message, refusal: true, rows: [], columns: [], sql: null, actionPreview: null, followups: ["Show my batch attendance", "What sessions are scheduled?"] };
  }

  const required = intent.intent === "missed_emis"
    ? ["students", "batches", "attendance", "instalments"]
    : intent.intent === "emi_due" && role === "counselor"
      ? ["fee_summary"]
      : makeQuery(intent, role, question).tables;
  const missing = missingTables(role, required);
  if (missing.length) {
    const message = `This role does not have access to ${missing.join(", ")}. Switch to an authorized role to run that query.`;
    await addAuditEntry({ role, userId, event: "permission_refusal", detail: question });
    return { intent: intent.intent, answer: message, refusal: true, rows: [], columns: [], sql: null, actionPreview: null, followups: [] };
  }

  let descriptor;
  try {
    descriptor = await requestLlmSql(question, role);
  } catch (error) {
    console.warn("Copilot LLM plan failed; using the local query planner.", error);
  }
  const localPlan = makeQuery(intent, role, question);
  const plan = descriptor || localPlan;
  if (descriptor && plan.tables && missingTables(role, plan.tables).length) {
    await addAuditEntry({ role, userId, event: "permission_refusal", detail: question });
    return { intent: intent.intent, answer: "The requested query needs data outside this role's permissions.", refusal: true, rows: [], columns: [], sql: null, actionPreview: null, followups: [] };
  }

  try {
    const result = await runRoleQuery({ role, userId, sql: plan.sql, params: plan.params || [] });
    let actionPreview = makeActionPreview(intent.action, result.rows, question);
    if (actionPreview) {
      const approval = await createApproval({ role, userId, kind: actionPreview.kind, payload: actionPreview.recipients, preview: actionPreview.preview });
      actionPreview = { ...actionPreview, approvalId: approval.id };
    }
    const answer = result.rows.length ? plan.answer : "No matching records were found in the role-scoped data.";
    return {
      intent: intent.intent,
      answer,
      sql: result.sql,
      columns: result.columns,
      rows: result.rows,
      actionPreview,
      followups: followupsFor(intent),
      context: { batch: extractBatch(question, context.batch), intent: intent.intent, threshold: intent.threshold },
    };
  } catch (error) {
    await addAuditEntry({ role, userId, event: "query_error", detail: `${question}: ${error.message}` });
    return { intent: intent.intent, answer: `I couldn't safely run that query: ${error.message}`, sql: null, columns: [], rows: [], actionPreview: null, followups: [] };
  }
}

function followupsFor(intent) {
  if (intent.intent === "missed_emis") return ["Show only overdue EMIs", "Draft a counselor follow-up", "Compare another batch"];
  if (intent.intent === "emi_due") return ["Show overdue EMIs", "Break this down by course", "Who has the highest balance?"];
  if (intent.intent === "missed_classes") return ["Show dropout risk", "Compare another batch", "Draft a WhatsApp reminder"];
  return ["Show today's absences", "Check batch fill rates", "Show fees due this week"];
}