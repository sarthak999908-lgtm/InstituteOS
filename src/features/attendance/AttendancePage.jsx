import { useState } from "react";
import { ClipboardCheck, Download, Users } from "lucide-react";
import { attendance as seedAttendance, batches, sessions, students, trainers, users } from "../../data/mockData.js";
import { createApproval } from "../../lib/database.js";
import "./attendance.css";

function initialRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem("instituteos_attendance") || "null");
    if (Array.isArray(saved)) return saved;
  } catch (error) {
    console.error("Could not load attendance:", error);
  }
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  const studentsById = new Map(students.map((student) => [student.id, student]));
  const batchesById = new Map(batches.map((batch) => [batch.id, batch]));
  return seedAttendance.map((record) => {
    const session = sessionsById.get(record.session_id);
    const student = studentsById.get(record.student_id);
    return {
      id: record.id,
      studentId: record.student_id,
      student: student?.name || "Student",
      batchId: session?.batch_id,
      sessionId: record.session_id,
      date: session?.date,
      mode: record.mode,
      status: record.status === "present" ? "Present" : record.status === "late" ? "Late" : "Absent",
    };
  });
}

function downloadCsv(rows, session) {
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [["student", "batch", "session_date", "mode", "status"], ...rows.map((row) => [row.student, row.batch, session.date, row.mode, row.status])].map((row) => row.map(quote).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `attendance-${session.date}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AttendancePage({ role, userId }) {
  const [records, setRecords] = useState(initialRecords);
  const [sessionId, setSessionId] = useState(sessions[0]?.id || "");
  const [notice, setNotice] = useState("");
  const session = sessions.find((item) => item.id === sessionId) || sessions[0];
  const batch = batches.find((item) => item.id === session?.batch_id);
  const activeUser = users.find((item) => item.id === userId);
  const trainer = trainers.find((item) => item.name === activeUser?.name);
  const trainerBatchIds = new Set(batches.filter((item) => item.trainer_id === trainer?.id).map((item) => item.id));
  const hasAccess = role !== "trainer" || trainerBatchIds.has(batch?.id);
  const roster = students.filter((student) => student.batch_id === batch?.id && hasAccess);
  const attendanceFor = (studentId) => records.find((row) => row.sessionId === sessionId && row.studentId === studentId)?.status || "Unmarked";
  const rows = roster.map((student, index) => ({
    student: student.name,
    studentId: student.id,
    batch: batch?.name,
    mode: index % 2 ? "classroom" : "online",
    status: attendanceFor(student.id),
  }));
  const classroomRows = rows.filter((row) => row.mode === "classroom");
  const onlineRows = rows.filter((row) => row.mode === "online");
  const totals = rows.reduce((total, row) => {
    if (row.status === "Present") total.present += 1;
    if (row.status === "Absent") total.absent += 1;
    if (row.status === "Late") total.late += 1;
    return total;
  }, { present: 0, absent: 0, late: 0 });
  const marked = totals.present + totals.absent + totals.late;
  const rate = marked ? Math.round((totals.present + totals.late) / marked * 100) : 0;

  function saveRecord(student, status) {
    const record = { id: `${sessionId}-${student.id}`, studentId: student.id, student: student.name, batchId: batch.id, sessionId, date: session.date, mode: student.mode, status };
    setRecords((current) => {
      const next = [...current.filter((item) => !(item.sessionId === sessionId && item.studentId === student.id)), record];
      localStorage.setItem("instituteos_attendance", JSON.stringify(next));
      return next;
    });
    setNotice(`${student.name} marked ${status.toLowerCase()}.`);
  }

  async function mark(student, status) {
    if (role === "owner") {
      saveRecord(student, status);
      return;
    }
    if (role === "trainer") {
      await createApproval({ role, userId, kind: "attendance_mark", payload: { sessionId, studentId: student.id, status }, preview: `Request to mark ${student.name} ${status.toLowerCase()} for ${batch.name}.` });
      window.dispatchEvent(new CustomEvent("instituteos-approvals-changed"));
      setNotice(`Attendance change for ${student.name} sent for owner approval.`);
    }
  }

  async function bulkMark(status) {
    if (!roster.length) return;
    await createApproval({ role, userId, kind: "attendance_bulk_mark", payload: { sessionId, batchId: batch.id, status, studentIds: roster.map((student) => student.id) }, preview: `Bulk mark ${roster.length} ${batch.name} students ${status.toLowerCase()} for ${session.date}.` });
    window.dispatchEvent(new CustomEvent("instituteos-approvals-changed"));
    setNotice(`Bulk ${status.toLowerCase()} request is waiting for approval.`);
  }

  return <div className="module-page"><div className="module-heading"><div><div className="eyebrow"><span className="eyebrow-line" />DAILY OPERATIONS</div><h1>Attendance</h1><p className="subtitle">Classroom check-ins and online join logs by session.</p></div><span className="module-icon"><ClipboardCheck size={23} /></span></div>
    <section className="stats-grid compact-stats">{[["Present", totals.present, "green"], ["Absent", totals.absent, "red"], ["Late", totals.late, "orange"], ["Attendance", `${rate}%`, "blue"]].map(([label, value, color]) => <article className="mini-stat panel" key={label}><span>{label}</span><strong className={color}>{value}</strong></article>)}</section>
    <section className="panel record-panel attendance-session-panel"><div className="attendance-session-controls"><label>Session<select value={sessionId} onChange={(event) => setSessionId(event.target.value)}>{sessions.filter((item) => role !== "trainer" || trainerBatchIds.has(item.batch_id)).map((item) => { const itemBatch = batches.find((entry) => entry.id === item.batch_id); return <option key={item.id} value={item.id}>{item.date} · {item.start} · {itemBatch?.name}</option>; })}</select></label><span className="local-data-label">{batch?.name} · {session?.date}</span><button className="student-secondary-button" type="button" onClick={() => downloadCsv(rows, session)} disabled={!rows.length}><Download size={14} />Export CSV</button></div>
      {notice && <p className="attendance-notice" role="status">{notice}</p>}
      {!hasAccess ? <div className="record-empty attendance-empty"><Users size={24} /><strong>No assigned session</strong><span>This session is outside your assigned batches.</span></div> : <div className="attendance-columns">{[["Classroom check-in", classroomRows], ["Online join log", onlineRows]].map(([title, group]) => <section className="attendance-mode-panel" key={title}><header><div><h2>{title}</h2><p>{group.length} students</p></div><span className="mode-indicator">{title.startsWith("Online") ? "ONLINE" : "IN PERSON"}</span></header>{group.map((row) => { const student = roster.find((entry) => entry.id === row.studentId); return <div className="attendance-detail-row" key={row.studentId}><div><strong>{row.student}</strong><small>{role === "trainer" || role === "accounts" ? batch?.name : `${row.studentId} · ${batch?.name}`}</small></div><span className={`record-badge ${row.status.toLowerCase()}`}>{row.status}</span>{(role === "owner" || role === "trainer") && <div className="attendance-mark-actions">{["Present", "Absent", "Late"].map((status) => <button className={row.status === status ? "selected" : ""} type="button" key={status} onClick={() => mark({ ...student, mode: row.mode }, status)}>{role === "trainer" ? `Request ${status}` : status}</button>)}</div>}</div>; })}</section>)}</div>}
      {(role === "owner" || role === "trainer") && <div className="attendance-bulk-actions"><span>{role === "trainer" ? "Trainer updates require owner approval." : "Bulk marking is approval-gated."}</span><button className="student-secondary-button" type="button" onClick={() => bulkMark("Present")}>Request bulk present</button><button className="student-secondary-button" type="button" onClick={() => bulkMark("Absent")}>Request bulk absent</button></div>}
    </section>
  </div>;
}