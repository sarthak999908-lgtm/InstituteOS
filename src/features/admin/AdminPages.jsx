import { useEffect, useState } from "react";
import { Download, FileText, Printer, RefreshCw, RotateCcw, ShieldCheck, Sun, Moon, Laptop, Palette, Feather } from "lucide-react";
import { users } from "../../data/mockData.js";
import { listAuditLog, resetLocalDatabase, runRoleQuery } from "../../lib/database.js";
import { useTheme } from "../../app/providers.jsx";
import "./admin.css";

function PageHeading({ eyebrow, title, description, icon: Icon }) {
  return <div className="module-heading"><div><div className="eyebrow"><span className="eyebrow-line" />{eyebrow}</div><h1>{title}</h1><p className="subtitle">{description}</p></div><span className="module-icon"><Icon size={23} /></span></div>;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

export function ReportsPage({ role, userId }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [certificate, setCertificate] = useState(null);

  useEffect(() => {
    let active = true;
    const sql = "SELECT s.id AS student_id, s.name, b.name AS batch, (SELECT COUNT(DISTINCT a.session_id) FROM attendance a WHERE a.student_id = s.id AND a.status = ?) AS missed_classes FROM students s JOIN batches b ON b.id = s.batch_id ORDER BY missed_classes DESC, s.name LIMIT 200";
    runRoleQuery({ role, userId, sql, params: ["absent"] }).then((result) => {
      if (active) setRows(result.rows.filter((student) => Number(student.missed_classes) >= 3));
    }).catch((reason) => {
      if (active) setError(reason.message);
    }).finally(() => {
      if (active) setBusy(false);
    });
    return () => { active = false; };
  }, [role, userId]);

  return <div className="module-page"><PageHeading eyebrow="ACADEMIC INSIGHTS" title="Reports" description="Review attendance risk and prepare completion certificates." icon={FileText} />
    <section className="panel report-panel"><div className="record-toolbar"><div><h2>Attendance risk</h2><p>Students with three or more missed sessions in their scoped records.</p></div><span className="data-source-chip">{rows.length} AT RISK</span></div>
      {busy && <p className="report-status">Loading role-scoped report…</p>}{error && <p className="report-status error">{error}</p>}
      {!busy && !error && <div className="record-table-wrap"><table className="record-table"><thead><tr><th>Student</th><th>Batch</th><th>Missed classes</th><th>Risk</th><th>Certificate</th></tr></thead><tbody>{rows.length ? rows.map((student) => <tr key={student.student_id}><td><strong>{student.name}</strong><small className="cell-subtitle">{student.student_id}</small></td><td>{student.batch}</td><td>{student.missed_classes}</td><td><span className="record-badge overdue">Review</span></td><td><button className="record-icon-button" type="button" aria-label={`Preview certificate for ${student.name}`} title="Preview printable certificate" onClick={() => setCertificate(student)}><Printer size={15} /></button></td></tr>) : <tr><td colSpan="5" className="record-empty">No students currently meet the attendance-risk threshold.</td></tr>}</tbody></table></div>}
      {role === "trainer" && <p className="student-storage-note"><ShieldCheck size={15} /> Report rows are restricted to your assigned batches.</p>}
    </section>
    {certificate && <div className="certificate-overlay" role="presentation"><section className="certificate-preview" role="dialog" aria-modal="true" aria-labelledby="certificate-title"><div className="certificate-actions"><button className="student-secondary-button" type="button" onClick={() => setCertificate(null)}>Close</button><button className="primary-button" type="button" onClick={() => window.print()}><Printer size={15} />Print certificate</button></div><article className="certificate-paper" id="certificate-print"><span>TECHSUMMITTRAINERS</span><h2 id="certificate-title">Certificate of Completion</h2><p>This certifies that</p><strong>{certificate.name}</strong><p>has successfully completed the {certificate.batch} training programme.</p><small>Issued on {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</small></article></section></div>}
      <style>{`@media print { body * { visibility: hidden !important; } #certificate-print, #certificate-print * { visibility: visible !important; } #certificate-print { position: fixed; inset: 0; width: 100vw; height: 100vh; } .certificate-overlay, .certificate-preview { position: static !important; display: block !important; padding: 0 !important; background: white !important; } .certificate-actions { display: none !important; } }`}</style>
    </div>;
}

export function SettingsPage({ role, userId, userName, onRoleChange }) {
  const { theme, setTheme, accent, setAccent, calmMode, setCalmMode } = useTheme();
  const [audit, setAudit] = useState([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [eventFilter, setEventFilter] = useState("All events");
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem("instituteos_reduced_motion") === "true");
  const [status, setStatus] = useState("");

  async function refreshAudit() { setAudit(await listAuditLog()); }
  useEffect(() => { refreshAudit(); }, []);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reducedMotion);
    localStorage.setItem("instituteos_reduced_motion", String(reducedMotion));
  }, [reducedMotion]);

  const filteredAudit = audit.filter((entry) => {
    const text = `${entry.event} ${entry.detail} ${entry.user_id}`.toLowerCase();
    return text.includes(query.trim().toLowerCase()) && (roleFilter === "All roles" || entry.role === roleFilter) && (eventFilter === "All events" || entry.event === eventFilter);
  });
  const events = ["All events", ...new Set(audit.map((entry) => entry.event))];

  function exportCsv() {
    const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const body = [["at", "role", "user_id", "event", "detail"], ...filteredAudit.map((entry) => [entry.at, entry.role, entry.user_id, entry.event, entry.detail])].map((row) => row.map(quote).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "instituteos-audit-log.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function resetData() {
    if (!window.confirm("Reset all local demo records and reseed the institute database?")) return;
    await resetLocalDatabase();
    for (const key of ["instituteos_students", "instituteos_batches", "instituteos_attendance", "instituteos_fees", "instituteos_schedules", "instituteos_payments"]) localStorage.removeItem(key);
    setAudit([]);
    setStatus("Local demo data has been reseeded.");
  }

  return <div className="module-page"><PageHeading eyebrow="WORKSPACE CONFIGURATION" title="Settings" description="Manage Clear Sky appearance, demo roles, audit history, and local data." icon={RefreshCw} />
    {/* Theme & Accent System */}
    <section className="panel settings-section">
      <div className="record-toolbar">
        <div>
          <h2>Appearance & Theme System</h2>
          <p>Clear Sky light-first interface with first-class Dark theme, accent presets, and calm mode.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 12 }}>
        {/* Theme mode */}
        <div style={{ padding: 14, background: "var(--surface-2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
          <strong style={{ fontSize: "13px", color: "var(--text-primary)", display: "block", marginBottom: 4 }}>Interface Theme</strong>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 10px" }}>Switch between Light (default), Dark, or sync with System.</p>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { id: "light", label: "Light", icon: Sun },
              { id: "dark", label: "Dark", icon: Moon },
              { id: "system", label: "System", icon: Laptop },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={(e) => setTheme(id, e)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: `1px solid ${theme === id ? "var(--accent-primary)" : "var(--border)"}`,
                  background: theme === id ? "var(--surface)" : "transparent",
                  color: theme === id ? "var(--accent-primary)" : "var(--text-secondary)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Accent preset */}
        <div style={{ padding: 14, background: "var(--surface-2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
          <strong style={{ fontSize: "13px", color: "var(--text-primary)", display: "block", marginBottom: 4 }}>Accent Palette</strong>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 10px" }}>Pick from Ocean (default blue/teal), Emerald, or Sunset.</p>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { id: "ocean", label: "Ocean", dot: "#2563EB" },
              { id: "emerald", label: "Emerald", dot: "#059669" },
              { id: "sunset", label: "Sunset", dot: "#EA580C" },
            ].map(({ id, label, dot }) => (
              <button
                key={id}
                type="button"
                onClick={() => setAccent(id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: `1px solid ${accent === id ? "var(--accent-primary)" : "var(--border)"}`,
                  background: accent === id ? "var(--surface)" : "transparent",
                  color: accent === id ? "var(--accent-primary)" : "var(--text-secondary)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot }} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Calm Mode */}
        <div style={{ padding: 14, background: "var(--surface-2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
          <strong style={{ fontSize: "13px", color: "var(--text-primary)", display: "block", marginBottom: 4 }}>Calm Mode</strong>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 10px" }}>Disable parallax, background mesh loops, and particle effects.</p>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "13px", color: "var(--text-primary)", fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={calmMode}
              onChange={(e) => setCalmMode(e.target.checked)}
            />
            <span>Enable Calm Mode (Fades only)</span>
          </label>
        </div>
      </div>
    </section>

    <section className="panel settings-section"><div className="record-toolbar"><div><h2>Users and roles</h2><p>Role switching is a local demo feature. Data access is rebuilt from the selected role schema.</p></div></div><div className="role-directory">{users.map((user) => <article key={user.id} className={`role-user ${role === user.role ? "selected" : ""}`}><div className="avatar">{user.name.split(" ").map((part) => part[0]).join("")}</div><div><strong>{user.name}</strong><small>{user.email}</small></div><span className="record-badge">{user.role}</span><button className="student-secondary-button" type="button" disabled={user.role === role} onClick={() => onRoleChange(user.role)}>Switch role</button></article>)}</div><p className="current-user-line">Signed in as {userName} · {role} · {userId}</p></section>
    <section className="panel settings-section"><div className="record-toolbar"><div><h2>Accessibility</h2><p>Reduce non-essential animation across the workspace.</p></div><label className="motion-toggle"><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /><span>Reduced motion</span></label></div></section>
    <section className="panel settings-section"><div className="record-toolbar"><div><h2>Audit log</h2><p>Copilot queries, permission refusals, previews, and approval decisions.</p></div><div className="record-toolbar-controls"><button className="student-secondary-button" type="button" onClick={refreshAudit}><RefreshCw size={14} />Refresh</button><button className="student-secondary-button" type="button" onClick={exportCsv}><Download size={14} />Export CSV</button></div></div><div className="audit-filters"><input className="audit-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search audit entries" aria-label="Search audit log" /><select className="record-filter" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter audit role"><option>All roles</option>{users.map((user) => <option key={user.role}>{user.role}</option>)}</select><select className="record-filter" value={eventFilter} onChange={(event) => setEventFilter(event.target.value)} aria-label="Filter audit event">{events.map((event) => <option key={event}>{event}</option>)}</select></div><div className="record-table-wrap"><table className="record-table"><thead><tr><th>Time</th><th>Role</th><th>Event</th><th>Detail</th></tr></thead><tbody>{filteredAudit.length ? filteredAudit.map((entry) => <tr key={entry.id}><td>{new Date(entry.at).toLocaleString()}</td><td>{entry.role}</td><td>{entry.event}</td><td className="audit-detail">{entry.detail}</td></tr>) : <tr><td colSpan="4" className="record-empty">No audit events match these filters.</td></tr>}</tbody></table></div></section>
    <section className="panel settings-section danger-zone"><div><h2>Local demo data</h2><p>Reset the browser database to its deterministic seeded state.</p></div><button className="student-secondary-button" type="button" onClick={resetData}><RotateCcw size={15} />Reset and reseed</button>{status && <span role="status">{status}</span>}</section>
  </div>;
}

export { escapeHtml };