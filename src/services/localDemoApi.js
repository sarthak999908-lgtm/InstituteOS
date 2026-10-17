import { dataSeed, courses, students } from "../data/mockData.js";
import { localDemoUser } from "../lib/localDemo.js";

const studentById = new Map(students.map((student) => [student.id, student]));

function dashboardSummary() {
  const attendance = dataSeed.attendance;
  const attended = attendance.filter((item) => item.status === "present" || item.status === "late").length;
  const pendingFees = dataSeed.instalments.reduce(
    (total, item) => total + Math.max(0, Number(item.amount || 0) - Number(item.paid_amount || 0)),
    0,
  );
  return {
    totalStudents: dataSeed.students.length,
    activeBatches: dataSeed.batches.length,
    attendancePercentage: attendance.length ? Math.round((attended / attendance.length) * 100) : 0,
    pendingFees,
    overdueInstalments: dataSeed.instalments.filter((item) => item.status === "overdue").length,
    alerts: [],
    cashFlowData: [],
    source: "fictional-local-demo",
  };
}

export function localDemoApiResponse(endpoint, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const url = new URL(endpoint, "http://local-demo.invalid");
  const path = url.pathname.replace(/^\/api(?=\/)/, "");

  if (path === "/copilot/query" && method === "POST") {
    return { answer: "Copilot is disabled in local demo mode. No backend request was sent." };
  }
  if (method !== "GET") {
    let payload = {};
    try { payload = options.body ? JSON.parse(options.body) : {}; } catch {}
    if (path === "/approvals" && method === "POST") {
      return { ...payload, id: `LOCAL-APPROVAL-${Date.now()}`, status: "pending", source: "fictional-local-demo" };
    }
    const approvalMatch = path.match(/^\/approvals\/([^/]+)$/);
    if (approvalMatch && method === "PATCH") {
      return { id: decodeURIComponent(approvalMatch[1]), ...payload, source: "fictional-local-demo" };
    }
    return { ...payload, id: payload.id || `LOCAL-${Date.now()}`, source: "fictional-local-demo" };
  }

  switch (path) {
    case "/health":
      return { status: "local-demo", supabaseConfigured: false };
    case "/dashboard":
      return dashboardSummary();
    case "/students":
      return dataSeed.students.map((student) => ({
        ...student,
        course_name: courses.find((course) => course.id === student.course_id)?.name || "Demo course",
      }));
    case "/batches":
      return dataSeed.batches;
    case "/fees":
      return dataSeed.instalments.map((item) => ({ ...item, students: studentById.get(item.student_id) || null }));
    case "/attendance": {
      const sessionId = url.searchParams.get("session_id");
      const studentId = url.searchParams.get("student_id");
      return dataSeed.attendance.filter((item) =>
        (!sessionId || item.session_id === sessionId) && (!studentId || item.student_id === studentId));
    }
    case "/trainers":
      return dataSeed.trainers;
    case "/courses":
      return dataSeed.courses;
    case "/rooms":
      return dataSeed.rooms;
    case "/sessions": {
      const batchId = url.searchParams.get("batch_id");
      return dataSeed.sessions.filter((item) => !batchId || item.batch_id === batchId);
    }
    case "/approvals":
    case "/audit-log":
      return [];
    case "/profile":
      return localDemoUser;
    case "/assignments": {
      const batchId = url.searchParams.get("batch_id");
      return dataSeed.assignments.filter((item) => !batchId || item.batch_id === batchId);
    }
    case "/submissions":
      return dataSeed.submissions;
    case "/recordings": {
      const sessionId = url.searchParams.get("session_id");
      return dataSeed.recordings.filter((item) => !sessionId || item.session_id === sessionId);
    }
    case "/system/status":
      return {
        server: "local-demo",
        database: "browser SQLite demo fixture",
        supabase: "disabled",
        tables: Object.fromEntries(Object.entries(dataSeed).map(([table, rows]) => [table, rows.length])),
      };
    default:
      throw new Error("This resource is not available in local demo mode.");
  }
}
