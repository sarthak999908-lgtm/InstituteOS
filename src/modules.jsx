import { useEffect, useState } from "react";
import {
  BookOpen, CalendarDays, Check, CheckCircle2, ClipboardCheck,
  Pencil, Plus, Search, Trash2, Users, Wallet, X, Printer,
} from "lucide-react";
import { INITIAL_STUDENTS } from "./data.js";
import { batches as instituteBatches, courses, feePlans, instalments, rooms, students as instituteStudents, trainerIdByUserId, trainers } from "./data/mockData.js";
import ReconciliationPanel from "./features/fees/ReconciliationPanel.jsx";
import FeeReceiptModal from "./features/fees/FeeReceiptModal.jsx";
import { recordFeePayment, createBatch } from "./services/api.js";
import { appStorageKey } from "./lib/localDemo.js";


const seedBatches = instituteBatches.map((batch) => ({
  id: batch.id,
  name: batch.name,
  course: batch.course_name,
  instructor: batch.trainer_name,
  students: batch.student_count,
  capacity: rooms.find((room) => room.id === batch.room_id)?.capacity || 30,
  schedule: `${batch.slot_days} · ${batch.slot_start}-${batch.slot_end}`,
  status: "Active",
}));
const seedFees = instituteStudents.map((student) => {
  const plan = feePlans.find((item) => item.student_id === student.id);
  const studentInstalments = instalments.filter((item) => item.student_id === student.id);
  return {
    id: `FEE-${student.id}`,
    student: student.name,
    studentId: student.id,
    total: plan?.total || 0,
    paid: studentInstalments.reduce((total, item) => total + Number(item.paid_amount || 0), 0),
    dueDate: studentInstalments.find((item) => item.status !== "paid")?.due_date || localDateString(),
  };
});
const seedSchedules = [
  { id: "SCH-301", date: "2026-10-17", time: "09:00", subject: "React fundamentals", batch: "Full Stack · Morning", instructor: "Neha Kapoor", classroom: "Lab 2" },
  { id: "SCH-302", date: "2026-10-17", time: "17:30", subject: "Python for analytics", batch: "Data Science · Evening", instructor: "Arjun Mehta", classroom: "Room 4" },
  { id: "SCH-303", date: "2026-10-19", time: "10:00", subject: "Design systems", batch: "Product Design · Weekend", instructor: "Mira Shah", classroom: "Studio 1" },
];

function localDateString(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function makePaymentEntry(record, amount) {
  return { id: `PAY-${Date.now()}`, feeId: record.id, student: record.student, studentId: record.studentId, amount, recordedAt: new Date().toISOString() };
}

function useLocalRecords(key, initialValue) {
  const scopedKey = appStorageKey(key);
  const [records, setRecords] = useState(() => {
    try {
      const saved = localStorage.getItem(scopedKey);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (error) { console.error(`Could not read ${key}:`, error); }
    return initialValue;
  });
  useEffect(() => {
    try { localStorage.setItem(scopedKey, JSON.stringify(records)); }
    catch (error) { console.error(`Could not save ${key}:`, error); }
  }, [scopedKey, key, records]);
  return [records, setRecords];
}

function PageTitle({ icon: Icon, title, description, action }) {
  return <div className="module-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> INSTITUTE MANAGEMENT</div><h1>{title}</h1><p className="subtitle">{description}</p></div><div className="module-heading-action">{action}<span className="module-icon"><Icon size={23} /></span></div></div>;
}

function RecordTable({ columns, rows, onEdit, onDelete, onExtra, extraLabel, emptyText = "No records yet. Add one to get started." }) {
  return <div className="record-table-wrap"><table className="record-table"><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}<th>Actions</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.id}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}<td><div className="record-actions">{onExtra && <button aria-label={`${extraLabel} for ${row.student}`} title={extraLabel} onClick={() => onExtra(row)}><Wallet size={14} /></button>}<button aria-label={`Edit ${row.name || row.student || row.subject || "record"}`} title="Edit" onClick={() => onEdit(row)}><Pencil size={15} /></button><button className="danger-action" aria-label={`Delete ${row.name || row.student || row.subject || "record"}`} title="Delete" onClick={() => onDelete(row)}><Trash2 size={15} /></button></div></td></tr>) : <tr><td colSpan={columns.length + 1} className="record-empty"><span>{emptyText}</span></td></tr>}</tbody></table></div>;
}

function RecordForm({ title, fields, initial, onSave, onCancel, error }) {
  const [values, setValues] = useState(initial);
  function submit(event) {
    event.preventDefault();
    const cleaned = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]));
    onSave(cleaned);
  }
  return <form className="record-form" onSubmit={submit}><div className="record-form-head"><h2>{title}</h2><button type="button" className="student-close-button" aria-label="Close form" onClick={onCancel}><X size={18} /></button></div><div className="record-form-grid">{fields.map((field) => <label key={field.key}>{field.label}{field.options ? <select required={field.required !== false} value={values[field.key] ?? ""} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input required={field.required !== false} type={field.type || "text"} min={field.min} max={field.max} step={field.step} value={values[field.key] ?? ""} placeholder={field.placeholder || ""} onChange={(event) => setValues({ ...values, [field.key]: field.type === "number" ? Number(event.target.value) : event.target.value })} />}</label>)}</div>{error && <p className="record-form-error" role="alert">{error}</p>}<div className="record-form-actions"><button type="button" className="student-secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" type="submit">Save record</button></div></form>;
}

function CrudPage({ title, description, icon, storageKey, initial, fields, columns, searchable, singular, summary, filters, matchesFilter, onExtra }) {
  const [records, setRecords] = useLocalRecords(storageKey, initial);
  const [query, setQuery] = useState("");
  const [filterValue, setFilterValue] = useState("All");
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const filtered = records.filter((record) => searchable.some((key) => String(record[key] ?? "").toLowerCase().includes(query.trim().toLowerCase())) && (!matchesFilter || filterValue === "All" || matchesFilter(record, filterValue)));
  const empty = Object.fromEntries(fields.map((field) => [field.key, field.defaultValue ?? ""]));
  function save(values) {
    const today = localDateString();
    if (fields.some((field) => field.key === "date") && values.date < today) {
      setFormError("Choose today or a future date for this schedule.");
      return;
    }
    if (fields.some((field) => field.key === "date") && values.time && records.some((record) => record.id !== editing?.id && record.date === values.date && record.time === values.time && record.batch === values.batch)) {
      setFormError("This batch already has a class at that date and time.");
      return;
    }
    setFormError("");
    if (editing) {
      setRecords((current) => current.map((record) => record.id === editing.id ? { ...record, ...values } : record));
    } else {
      const newId = `${singular.slice(0, 3).toUpperCase()}-${Date.now()}`;
      setRecords((current) => [{ ...values, id: newId }, ...current]);
      if (storageKey === "instituteos_batches") {
        createBatch({
          id: newId,
          name: values.name,
          course_name: values.course,
          trainer_name: values.instructor,
          start_date: localDateString(),
        }).catch((err) => console.debug("API createBatch fallback:", err.message));
      }
    }
    setShowForm(false); setEditing(null);
  }

  function remove(record) { if (window.confirm(`Delete this ${singular.toLowerCase()}?`)) setRecords((current) => current.filter((item) => item.id !== record.id)); }
  return <div className="module-page"><PageTitle icon={icon} title={title} description={description} action={<button className="primary-button" onClick={() => { setEditing(null); setFormError(""); setShowForm(true); }}><Plus size={16} /> Add {singular}</button>} />{summary?.(records)}<section className="panel record-panel"><div className="record-toolbar"><div><h2>{title} directory</h2><p>Changes are stored locally in this browser.</p></div><div className="record-toolbar-controls"><label className="record-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${title.toLowerCase()}…`} aria-label={`Search ${title}`} /></label>{filters && <select className="record-filter" value={filterValue} onChange={(event) => setFilterValue(event.target.value)} aria-label={`Filter ${title}`}>{filters.map((filter) => <option key={filter}>{filter}</option>)}</select>}</div></div>{showForm && <RecordForm title={`${editing ? "Edit" : "Add"} ${singular}`} fields={fields} initial={editing || empty} onSave={save} error={formError} onCancel={() => { setEditing(null); setFormError(""); setShowForm(false); }} />}<RecordTable columns={columns} rows={filtered} onEdit={(record) => { setEditing(record); setFormError(""); setShowForm(true); }} onDelete={remove} onExtra={onExtra ? (record) => onExtra(record, setRecords) : undefined} extraLabel={onExtra?.label} emptyText={query || filterValue !== "All" ? "No matching records. Try another search or filter." : `No ${title.toLowerCase()} yet. Add one to get started.`} /></section><p className="student-storage-note"><CheckCircle2 size={15} /> Demo records and changes are saved locally in this browser.</p></div>;
}

export function BatchesPage() {
  const fields = [
    { key: "name", label: "Batch name" }, { key: "course", label: "Course / subject" }, { key: "instructor", label: "Instructor" },
    { key: "students", label: "Students", type: "number", min: 0, defaultValue: 0 }, { key: "capacity", label: "Capacity", type: "number", min: 1, defaultValue: 30 },
    { key: "schedule", label: "Schedule" }, { key: "status", label: "Status", options: ["Active", "Upcoming", "Completed"] },
  ];
  return <CrudPage title="Batches" description="Organize courses, class groups, and instructor assignments." icon={BookOpen} storageKey="instituteos_batches" initial={seedBatches} fields={fields} searchable={["id", "name", "course", "instructor", "schedule"]} singular="Batch" filters={["All", "Active", "Upcoming", "Completed"]} matchesFilter={(record, filter) => record.status === filter} columns={[{ key: "name", label: "Batch", render: (r) => <><strong>{r.name}</strong><small className="cell-subtitle">{r.id}</small></> }, { key: "course", label: "Course" }, { key: "instructor", label: "Instructor" }, { key: "capacity", label: "Students", render: (r) => `${r.students} / ${r.capacity}` }, { key: "schedule", label: "Schedule" }, { key: "status", label: "Status", render: (r) => <span className={`record-badge ${r.status.toLowerCase()}`}>{r.status}</span> }]} />;
}

function loadStudentList() {
  try {
    const saved = localStorage.getItem(appStorageKey("instituteos_students"));
    if (saved === null) return INITIAL_STUDENTS;
    const data = JSON.parse(saved);
    if (Array.isArray(data)) return data;
  }
  catch (error) { console.error("Could not read students for attendance:", error); }
  return [];
}

export function AttendancePage({ role = "owner", userId = "USR-OWNER" }) {
  const [allStudents] = useState(loadStudentList);
  const [batches] = useLocalRecords("instituteos_batches", seedBatches);
  const [records, setRecords] = useLocalRecords("instituteos_attendance", []);
  const trainerId = trainerIdByUserId[userId];
  const allowedBatchIds = new Set(instituteBatches.filter((batch) => batch.trainer_id === trainerId).map((batch) => batch.id));
  const visibleBatches = role === "trainer" ? batches.filter((batch) => allowedBatchIds.has(batch.id)) : batches;
  const students = role === "trainer"
    ? allStudents.filter((student) => allowedBatchIds.has(instituteBatches.find((batch) => batch.name === student.batch)?.id))
    : allStudents;
  const [batchId, setBatchId] = useState(visibleBatches[0]?.id || "");
  const [date, setDate] = useState(localDateString());
  const batch = visibleBatches.find((item) => item.id === batchId);
  const batchStudents = students.filter((student) => !batch || !student.course || student.course === batch.course);
  const attendance = (studentId) => records.find((item) => item.studentId === studentId && item.batchId === batchId && item.date === date)?.status || "Unmarked";
  function mark(student, status) {
    const existing = records.some((item) => item.studentId === student.id && item.batchId === batchId && item.date === date);
    setRecords((current) => existing ? current.map((item) => item.studentId === student.id && item.batchId === batchId && item.date === date ? { ...item, status } : item) : [...current, { id: `${date}-${batchId}-${student.id}`, studentId: student.id, student: student.name, batchId, date, status }]);
  }
  const totals = batchStudents.reduce((sum, student) => { const status = attendance(student.id); if (status === "Present") sum.present++; if (status === "Absent") sum.absent++; if (status === "Late") sum.late++; return sum; }, { present: 0, absent: 0, late: 0 });
  const pct = totals.present + totals.absent + totals.late ? Math.round((totals.present + totals.late) / (totals.present + totals.absent + totals.late) * 100) : 0;
  return <div className="module-page"><PageTitle icon={ClipboardCheck} title="Attendance" description="Record daily attendance by batch. Entries are stored on this device." /><section className="stats-grid compact-stats">{[["Present", totals.present, "green"], ["Absent", totals.absent, "red"], ["Late", totals.late, "orange"], ["Attendance", `${pct}%`, "blue"]].map(([label, value, color]) => <div className="mini-stat panel" key={label}><span>{label}</span><strong className={color}>{value}</strong></div>)}</section><section className="panel record-panel"><div className="attendance-filters"><label>Batch<select value={batchId} onChange={(event) => setBatchId(event.target.value)}>{batches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><span className="local-data-label">Local attendance</span></div>{batchStudents.length ? <div className="attendance-list">{batchStudents.map((student) => <div className="attendance-row" key={student.id}><div className="student-identity"><div className="student-avatar">{student.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div className="student-identity-text"><strong>{student.name}</strong><span>{student.id} · {student.course || "Unassigned course"}</span></div></div><div className="attendance-options">{["Present", "Absent", "Late"].map((status) => <button key={status} className={`attendance-choice ${status.toLowerCase()} ${attendance(student.id) === status ? "selected" : ""}`} onClick={() => mark(student, status)} aria-pressed={attendance(student.id) === status}>{attendance(student.id) === status && <Check size={14} />}{status}</button>)}</div></div>)}</div> : <div className="record-empty attendance-empty"><Users size={26} /><strong>No students available</strong><span>Add student records first to take attendance.</span></div>}</section><p className="student-storage-note"><CheckCircle2 size={15} /> Attendance entries are demo data stored locally; they are not sent to the backend.</p></div>;
}

export function FeesPage({ role = "owner", userId = "USR-OWNER" }) {
  const [payment, setPayment] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [receiptRecord, setReceiptRecord] = useState(null);
  const fields = [{ key: "student", label: "Student name" }, { key: "studentId", label: "Student ID" }, { key: "total", label: "Total fees (₹)", type: "number", min: 0, defaultValue: 0 }, { key: "paid", label: "Amount paid (₹)", type: "number", min: 0, defaultValue: 0 }, { key: "dueDate", label: "Due date", type: "date" }];
  const columns = [
    { key: "student", label: "Student", render: (r) => <><strong>{r.student}</strong><small className="cell-subtitle">{r.studentId}</small></> },
    { key: "total", label: "Total", render: (r) => money(r.total) },
    { key: "paid", label: "Paid", render: (r) => money(r.paid) },
    { key: "balance", label: "Balance", render: (r) => money(Math.max(0, Number(r.total) - Number(r.paid))) },
    { key: "dueDate", label: "Due date" },
    { key: "status", label: "Status", render: (r) => { const status = Number(r.paid) >= Number(r.total) ? "Paid" : r.dueDate < localDateString() ? "Overdue" : "Pending"; return <span className={`record-badge ${status.toLowerCase()}`}>{status}</span>; } },
    { key: "receipt", label: "Receipt", render: (r) => (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setReceiptRecord(r); }}
        className="receipt-btn"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 8px",
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--accent-primary)",
          fontSize: "11px",
          fontWeight: 600,
          cursor: "pointer",
        }}
        title="View printable receipt"
      >
        <Printer size={12} />
        Receipt
      </button>
    )},
  ];
  const summary = (records) => {
    const totals = records.reduce((sum, record) => {
      const balance = Math.max(0, Number(record.total) - Number(record.paid));
      sum.paid += Math.min(Number(record.total) || 0, Number(record.paid) || 0);
      sum.pending += balance;
      if (balance && record.dueDate < localDateString()) sum.overdue += balance;
      return sum;
    }, { paid: 0, pending: 0, overdue: 0 });
    return <section className="stats-grid compact-stats fee-summary">{[["Paid", totals.paid, "green"], ["Pending", totals.pending, "orange"], ["Overdue", totals.overdue, "red"]].map(([label, value, color]) => <div className="mini-stat panel" key={label}><span>{label}</span><strong className={color}>{money(value)}</strong></div>)}</section>;
  };
  const statusFor = (record) => Number(record.paid) >= Number(record.total) ? "Paid" : record.dueDate < localDateString() ? "Overdue" : "Pending";
  const recordPayment = (record, update) => {
    const balance = Math.max(0, Number(record.total) - Number(record.paid));
    if (!balance) return;
    setPayment({ record, update });
    setPaymentAmount(String(balance));
    setPaymentError("");
  };
  function submitPayment(event) {
    event.preventDefault();
    if (!payment) return;
    const amount = Number(paymentAmount);
    const balance = Math.max(0, Number(payment.record.total) - Number(payment.record.paid));
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) {
      setPaymentError(`Enter an amount greater than zero and no more than ${money(balance)}.`);
      return;
    }
    payment.update((current) => current.map((item) => item.id === payment.record.id ? { ...item, paid: Number(item.paid) + amount } : item));
    recordFeePayment({
      studentId: payment.record.studentId,
      instalmentId: payment.record.id,
      // Preserve the entered decimal string for the numeric database RPC;
      // local optimistic totals still use the parsed amount above.
      amount: paymentAmount.trim(),
      method: "bank_transfer",
    }).catch((err) => console.debug("API recordFeePayment fallback:", err.message));
    try {
      const paymentsKey = appStorageKey("instituteos_payments");
      const payments = JSON.parse(localStorage.getItem(paymentsKey) || "[]");
      localStorage.setItem(paymentsKey, JSON.stringify([...(Array.isArray(payments) ? payments : []), makePaymentEntry(payment.record, amount)]));
    } catch (error) {
      console.error("Could not save local payment history:", error);
    }
    setPayment(null);
  };

  recordPayment.label = "Record payment";
  return (
    <>
      <CrudPage
        title="Fees"
        description="Track fee balances and payment records. No payment processing is performed."
        icon={Wallet}
        storageKey="instituteos_fees"
        initial={seedFees}
        fields={fields}
        searchable={["id", "student", "studentId", "dueDate"]}
        singular="Fee record"
        filters={["All", "Paid", "Pending", "Overdue"]}
        matchesFilter={(record, filter) => statusFor(record) === filter}
        columns={columns}
        summary={summary}
        onExtra={recordPayment}
      />
      {(role === "owner" || role === "accounts") && <ReconciliationPanel role={role} userId={userId} />}
      {payment && (
        <div className="send-list-backdrop" role="presentation">
          <form className="send-list-modal payment-entry-form" role="dialog" aria-modal="true" aria-labelledby="payment-entry-title" onSubmit={submitPayment}>
            <div className="student-form-heading">
              <div>
                <span className="eyebrow">FEE LEDGER</span>
                <h2 id="payment-entry-title">Record payment</h2>
              </div>
              <button type="button" className="student-close-button" aria-label="Close payment form" onClick={() => setPayment(null)}>
                <X size={18} />
              </button>
            </div>
            <p>{payment.record.student} · remaining balance {money(Math.max(0, Number(payment.record.total) - Number(payment.record.paid)))}</p>
            <label>
              Amount received (₹)
              <input autoFocus required type="number" min="0.01" max={Math.max(0, Number(payment.record.total) - Number(payment.record.paid))} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} />
            </label>
            {paymentError && <p className="record-form-error" role="alert">{paymentError}</p>}
            <div className="record-form-actions">
              <button type="button" className="student-secondary-button" onClick={() => setPayment(null)}>Cancel</button>
              <button type="submit" className="primary-button">Save payment</button>
            </div>
          </form>
        </div>
      )}
      {receiptRecord && (
        <FeeReceiptModal
          record={receiptRecord}
          onClose={() => setReceiptRecord(null)}
        />
      )}
    </>
  );
}

function money(amount) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount) || 0); }

export function SchedulesPage() {
  const fields = [{ key: "subject", label: "Subject / class" }, { key: "date", label: "Date", type: "date", min: localDateString() }, { key: "time", label: "Start time", type: "time" }, { key: "batch", label: "Batch" }, { key: "instructor", label: "Instructor" }, { key: "classroom", label: "Classroom" }];
  const today = localDateString();
  return <CrudPage title="Schedules" description="Plan classes and coordinate instructors and rooms." icon={CalendarDays} storageKey="instituteos_schedules" initial={seedSchedules} fields={fields} searchable={["id", "subject", "batch", "instructor", "classroom", "date"]} singular="Schedule" filters={["All", "Today", "Upcoming"]} matchesFilter={(record, filter) => filter === "Today" ? record.date === today : record.date >= today} columns={[{ key: "date", label: "Date", render: (r) => <><strong>{new Date(`${r.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</strong><small className="cell-subtitle">{r.date === today ? "Today" : new Date(`${r.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" })}</small></> }, { key: "time", label: "Time" }, { key: "subject", label: "Class" }, { key: "batch", label: "Batch" }, { key: "instructor", label: "Instructor" }, { key: "classroom", label: "Room" }]} />;
}
