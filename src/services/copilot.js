import { auditCopilotEvent, streamCopilotBackend } from "./api.js";
import { getAuthenticatedInstituteContext, supabaseEnabled } from "./supabase.js";
import { localDemoMode } from "../lib/localDemo.js";
import { addAuditEntry, createApproval, runRoleQuery } from "../lib/database.js";
import { dateWindow, detectAction, extractBatch, extractThreshold, isFinanceQuestion, planIntent } from "../features/copilot/planner.js";

function localSqlFor(question, role, context = {}) {
  const intent = planIntent(question, context);
  const batch = intent.batch || extractBatch(question, context.batch);
  const threshold = intent.threshold || extractThreshold(question, 3);
  const batchFilter = batch ? " AND LOWER(b.name) = LOWER(?)" : "";
  const batchParams = batch ? [batch] : [];

  if (intent.intent === "missed_classes") {
    return {
      intent,
      sql: `SELECT s.id AS student_id, s.name, COUNT(a.id) AS missed_classes
        FROM students s JOIN attendance a ON a.student_id = s.id
        JOIN sessions se ON se.id = a.session_id JOIN batches b ON b.id = se.batch_id
        WHERE LOWER(a.status) = ?${batchFilter}
        GROUP BY s.id, s.name HAVING COUNT(a.id) >= ?
        ORDER BY missed_classes DESC LIMIT 200`,
      params: ["absent", ...batchParams, threshold],
    };
  }
  if (intent.intent === "missed_emis") {
    if (!((role === "owner") || role === "accounts")) return { intent, unsupported: "Your role can access finance summaries, but cannot link fee details to individual student names through the available views." };
    const window = dateWindow("week");
    return {
      intent,
      sql: `WITH missed AS (
          SELECT s.id AS student_id, s.name, COUNT(a.id) AS missed_classes
          FROM students s JOIN attendance a ON a.student_id = s.id
          JOIN sessions se ON se.id = a.session_id JOIN batches b ON b.id = se.batch_id
          WHERE LOWER(a.status) = ?${batchFilter}
          GROUP BY s.id, s.name HAVING COUNT(a.id) >= ?
        ), due AS (
          SELECT i.student_id, COUNT(i.id) AS emi_due_count, MIN(i.due_date) AS next_due_date,
            SUM(i.amount - i.paid_amount) AS amount_due
          FROM instalments i WHERE LOWER(i.status) = ? AND i.due_date BETWEEN ? AND ?
          GROUP BY i.student_id
        )
        SELECT missed.student_id, missed.name, missed.missed_classes, due.emi_due_count,
          due.next_due_date, due.amount_due
        FROM missed JOIN due ON due.student_id = missed.student_id
        ORDER BY missed.missed_classes DESC LIMIT 200`,
      params: ["absent", ...batchParams, threshold, "pending", window.start, window.end],
    };
  }
  if (intent.intent === "system_author") {
    return {
      intent,
      sql: "SELECT 'TechSummit' as author, 'InstituteOS' as system, 'Production' as tier",
      params: [],
    };
  }
  if (intent.intent === "system_help") {
    return {
      intent,
      sql: "SELECT (SELECT COUNT(id) FROM students) as student_count, (SELECT COUNT(id) FROM batches) as batch_count",
      params: [],
    };
  }
  if (intent.intent === "system_greeting") {
    return {
      intent,
      sql: "SELECT id, name, role FROM users LIMIT 1",
      params: [],
    };
  }
  if (intent.intent === "list_courses") {
    return {
      intent,
      sql: "SELECT id, name, duration_weeks FROM courses ORDER BY name",
      params: [],
    };
  }
  if (intent.intent === "list_trainers") {
    return {
      intent,
      sql: "SELECT id, name, skills, weekly_hours_max FROM trainers ORDER BY name",
      params: [],
    };
  }
  if (intent.intent === "list_students") {
    return {
      intent,
      sql: "SELECT id, name, batch_name, status FROM students ORDER BY name LIMIT 50",
      params: [],
    };
  }
  if (intent.intent === "user_identity") {
    return {
      intent,
      sql: "SELECT id, name, role, email FROM users WHERE id = ? OR role = ? LIMIT 1",
      params: [context?.userId || "USR-OWNER", role || "owner"],
    };
  }
  if (intent.intent === "emi_due") {
    if (role === "counselor") {
      return {
        intent,
        sql: "SELECT course_name, status, due_date, instalment_count, amount_due FROM fee_summary ORDER BY due_date LIMIT 200",
        params: [],
      };
    }
    if (!["owner", "accounts"].includes(role)) return { intent, unsupported: "Fee and instalment details are unavailable for your role." };
    return {
      intent,
      sql: `SELECT s.id AS student_id, s.name, i.due_date, (i.amount - i.paid_amount) AS amount_due, i.status
        FROM students s JOIN instalments i ON i.student_id = s.id
        WHERE (i.amount - i.paid_amount) > 0
        ORDER BY i.due_date LIMIT 200`,
      params: [],
    };
  }
  if (intent.intent === "absent_today") {
    const window = dateWindow("today");
    return {
      intent,
      sql: `SELECT s.id AS student_id, s.name, b.name AS batch_name, se.date
        FROM students s JOIN attendance a ON a.student_id = s.id
        JOIN sessions se ON se.id = a.session_id JOIN batches b ON b.id = se.batch_id
        WHERE LOWER(a.status) = ? AND se.date = ? ORDER BY b.name, s.name LIMIT 200`,
      params: ["absent", window.start],
    };
  }
  if (intent.intent === "overview" || intent.intent === "fill_rate") {
    return {
      intent,
      sql: `SELECT b.id AS batch_id, b.name AS batch_name, COUNT(s.id) AS student_count
        FROM batches b LEFT JOIN students s ON s.batch_id = b.id
        GROUP BY b.id, b.name ORDER BY student_count DESC LIMIT 200`,
      params: [],
    };
  }
  return {
    intent,
    sql: "SELECT (SELECT COUNT(id) FROM students) as students, (SELECT COUNT(id) FROM batches) as batches, (SELECT COUNT(id) FROM courses) as courses",
    params: [],
  };
}

function answerForLocalResult(question, plan, rows) {
  if (plan.unsupported) return plan.unsupported;

  if (plan.intent.intent === "system_author") {
    return "**InstituteOS** was engineered by the **TechSummit** engineering team as a unified academic operating system designed for institutes and coaching centers to manage students, timetables, attendance, and fees.";
  }
  if (plan.intent.intent === "system_help") {
    return `I am **Cosmic Copilot**, your academic AI assistant! Here is what I can do for you:\n\n• 👤 **Identity**: Ask *"who i am"*, *"who is author"*\n• 💳 **Fees & EMIs**: Ask *"fee"*, *"overdue fees"*, *"pending instalments"*\n• 👥 **Students**: Ask *"show students"*, *"who is absent today"*\n• 📚 **Batches**: Ask *"list batches"*, *"show courses"*, *"trainers"*\n• ⚡ **Reminders**: Say *"send WhatsApp reminder for missed EMIs"*`;
  }
  if (plan.intent.intent === "system_greeting") {
    return "Hello! 👋 I'm Cosmic Copilot, your institute operations assistant. How can I help you today? You can ask about student attendance, overdue fees, upcoming batch timetables, or staff load.";
  }
  if (plan.intent.intent === "list_courses") {
    return `I found ${rows.length} course${rows.length === 1 ? "" : "s"} in the curriculum catalog.`;
  }
  if (plan.intent.intent === "list_trainers") {
    return `I found ${rows.length} faculty trainer${rows.length === 1 ? "" : "s"} on the staff roster.`;
  }
  if (plan.intent.intent === "list_students") {
    return `I found ${rows.length} student records in the active academic registry.`;
  }
  if (plan.intent.intent === "user_identity") {
    const user = rows[0];
    if (user) return `You are currently authenticated as **${user.name}** with the role of **${user.role?.toUpperCase()}** (${user.email}).`;
    return `You are operating with active role **${(plan.intent.role || "owner").toUpperCase()}**.`;
  }
  if (plan.intent.intent === "general_inquiry") {
    const summary = rows[0];
    return `I checked the institute registry for **"${question}"**. The system currently monitors **${summary?.students ?? 52} students** across **${summary?.batches ?? 12} batches** and **${summary?.courses ?? 5} courses**. Try asking *"fee"*, *"who is absent today"*, *"who i am"*, or *"list batches"*!`;
  }

  if (!rows.length) return "I found no matching rows for the selected filters.";
  if (plan.intent.intent === "missed_classes") return `I found ${rows.length} student${rows.length === 1 ? "" : "s"} with at least ${plan.intent.threshold} recorded absences${plan.intent.batch ? ` in the ${plan.intent.batch} batch` : ""}.`;
  if (plan.intent.intent === "missed_emis") return `I found ${rows.length} student${rows.length === 1 ? "" : "s"} matching the missed-class and EMI-due filters for this week${plan.intent.batch ? ` in the ${plan.intent.batch} batch` : ""}.`;
  if (plan.intent.intent === "emi_due") return `I found ${rows.length} due fee / EMI record${rows.length === 1 ? "" : "s"} requiring settlement.`;
  if (plan.intent.intent === "absent_today") return `I found ${rows.length} absent attendance record${rows.length === 1 ? "" : "s"} for today.`;
  return `I found ${rows.length} batch${rows.length === 1 ? "" : "es"} in the institute registry.`;
}

async function hashText(value) {
  if (!globalThis.crypto?.subtle) return "";
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function runLocalFallback({ question, role, userId, context, unavailableReason }) {
  let verifiedRole = role || "owner";
  let verifiedUserId = userId || "USR-OWNER";
  if (supabaseEnabled && !localDemoMode) {
    try {
      const membership = await getAuthenticatedInstituteContext();
      if (membership?.role && membership?.user_id) {
        verifiedRole = membership.role;
        verifiedUserId = membership.user_id;
      }
    } catch {
      // Graceful fallback to current UI session identity
    }
  }
  if (verifiedRole === "trainer" && isFinanceQuestion(question)) {
    return { mode: "local", refusal: true, answer: "I can’t show fee, EMI, payment, or outstanding-balance information for a Trainer account. You can ask about attendance, batches, assignments, or recordings instead.", unavailableReason };
  }
  const plan = localSqlFor(question, verifiedRole, context);
  if (plan.unsupported) return { mode: "local", answer: plan.unsupported, refusal: true, unavailableReason, context: plan.intent };
  const result = await runRoleQuery({ role: verifiedRole, userId: verifiedUserId, sql: plan.sql, params: plan.params });
  if (supabaseEnabled && !localDemoMode) {
    auditCopilotEvent("copilot.local_query", { sql: result.sql, rowCount: result.rows.length }).catch(() => {});
  }
  let actionPreview = null;
  if (detectAction(question) === "whatsapp_reminder" && plan.intent.intent === "missed_emis" && verifiedRole === "owner" && result.rows.length) {
    const ids = result.rows.map((row) => row.student_id).filter(Boolean);
    const contactResult = await runRoleQuery({
      role: verifiedRole,
      userId: verifiedUserId,
      sql: `SELECT id, name, phone FROM students WHERE id IN (${ids.map(() => "?").join(",")}) LIMIT 200`,
      params: ids,
    });
    const contacts = new Map(contactResult.rows.map((row) => [row.id, row]));
    const recipients = result.rows.map((row) => {
      const contact = contacts.get(row.student_id);
      const firstName = String(contact?.name || row.name || "there").split(/\s+/)[0];
      return {
        studentId: row.student_id,
        name: contact?.name || row.name,
        phone: contact?.phone || "",
        message: `Hi ${firstName}, our records show you missed ${row.missed_classes} classes and have an instalment due this week. Please contact ${verifiedRole === "owner" ? "the institute team" : "us"} if you need help. Thank you.`,
      };
    });
    const approval = await createApproval({
      role: verifiedRole,
      userId: verifiedUserId,
      kind: "whatsapp_reminders",
      payload: { recipients },
      preview: `Draft ${recipients.length} WhatsApp reminder${recipients.length === 1 ? "" : "s"}. Nothing will be sent until an authorized human approves it.`,
    });
    actionPreview = { approvalId: approval.id, kind: "whatsapp_reminders", preview: approval.preview, recipients };
  }
  const answer = answerForLocalResult(question, plan, result.rows);
  if (supabaseEnabled && !localDemoMode) {
    hashText(question).then((promptHash) => {
      auditCopilotEvent("copilot.local_answer", { promptHash, mode: "local" }).catch(() => {});
    }).catch(() => {});
  }
  return {
    mode: "local",
    dataMode: supabaseEnabled && !localDemoMode ? "live" : "local",
    unavailableReason,
    answer,
    refusal: false,
    sql: result.sql,
    columns: result.columns,
    rows: result.rows,
    actionPreview,
    followups: plan.intent.batch ? [`And in the ${plan.intent.batch} batch?`, "Show today's attendance"] : ["Show today's attendance", "Show overdue EMIs"],
    context: { batch: plan.intent.batch || context?.batch, threshold: plan.intent.threshold || context?.threshold },
  };
}

export async function runCopilotMessage({ question, role, userId, context, signal, onStage, onText }) {
  let response;
  try {
    response = await streamCopilotBackend(question, { signal, onStage, onText });
  } catch (backendError) {
    console.warn("Backend stream unavailable, falling back to local Copilot planner:", backendError.message);
    response = { fallbackAvailable: true, unavailableReason: "backend-offline" };
  }

  if (response.fallbackAvailable) {
    const local = await runLocalFallback({ question, role, userId, context, unavailableReason: response.unavailableReason });
    return { ...local, answerId: globalThis.crypto?.randomUUID?.() || `answer-${Date.now()}` };
  }
  return {
    ...response,
    answerId: response.answerId || globalThis.crypto?.randomUUID?.() || `answer-${Date.now()}`,
  };
}
