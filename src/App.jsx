import { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardCheck,
  Wallet,
  CalendarDays,
  Bot,
  GraduationCap,
  Bell,
  Search,
  RefreshCw,
  ArrowUpRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Wifi,
  WifiOff,
  Menu,
  X,
  Send,
  TrendingUp,
  Clock,
  CreditCard,
} from "lucide-react";

import "./App.css";
import { getDashboard } from "./services/api";
import { AttendancePage, BatchesPage, FeesPage, SchedulesPage } from "./modules.jsx";
import { INITIAL_STUDENTS } from "./data.js";

const MENU_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Students", icon: Users },
  { label: "Batches", icon: BookOpen },
  { label: "Attendance", icon: ClipboardCheck },
  { label: "Fees", icon: Wallet },
  { label: "Schedules", icon: CalendarDays },
  { label: "AI Copilot", icon: Bot },
];



function loadStudents() {
  try {
    const saved = localStorage.getItem("instituteos_students");

    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (error) {
    console.error("Could not load saved students:", error);
  }

  return INITIAL_STUDENTS;
}

function App() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadDashboard = useCallback(async (refresh = false) => {
    if (refresh) {
      setLoading(true);
      setError("");
    }

    try {
      const result = await getDashboard();
      setDashboard(result);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Dashboard request failed:", err);
      setError("Dashboard data could not be loaded from the API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  function navigateTo(tab) {
    setActiveTab(tab);
    setSidebarOpen(false);
  }

  return (
    <div className="app">
      {sidebarOpen && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">
            <GraduationCap size={24} />
          </div>

          <div className="brand-copy">
            <h2>InstituteOS</h2>
            <span>OPERATIONS COPILOT</span>
          </div>

          <button
            className="mobile-close"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="menu-title">WORKSPACE</div>

        <nav className="menu">
          {MENU_ITEMS.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`menu-item ${
                activeTab === label ? "active" : ""
              }`}
              onClick={() => navigateTo(label)}
            >
              <Icon size={18} />
              <span>{label}</span>

              {label === "AI Copilot" && (
                <span className="menu-ai-badge">AI</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <Sparkles size={17} />

            <strong>Work smarter</strong>

            <p>
              Use your AI Copilot to explore institute information.
            </p>

            <button onClick={() => navigateTo("AI Copilot")}>
              Open Copilot <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="sidebar-footer">
            <div className="avatar">AD</div>

            <div>
              <strong>Administrator</strong>
              <small>Institute Manager</small>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-button"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={21} />
            </button>

            <div className="breadcrumb">
              Workspace <span>/</span>{" "}
              <strong>{activeTab}</strong>
            </div>
          </div>

          <div className="topbar-right">
            <div className="connection-status">
              {error ? (
                <>
                  <WifiOff size={14} />
                  <span>API unavailable</span>
                </>
      ) : loading ? (
                <>
                  <Wifi size={14} />
          <span>Connecting…</span>
                </>
      ) : dashboard ? (
        <>
          <Wifi size={14} />
          <span>Live data</span>
        </>
      ) : (
        <>
          <WifiOff size={14} />
          <span>Demo data</span>
        </>
              )}
            </div>

            <button
              className="topbar-icon"
              aria-label="Refresh dashboard"
              onClick={() => loadDashboard(true)}
              title="Refresh dashboard data"
            >
              <RefreshCw
                size={17}
                className={loading ? "spinning" : ""}
              />
            </button>

            <button
              className="topbar-icon notification-button"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={18} />
              <span />
            </button>

            <div className="topbar-admin">
              <div className="topbar-avatar">AD</div>
              <span>Admin</span>
            </div>
          </div>
        </header>

        <div className="page-content">
          {activeTab === "Dashboard" && (
            <DashboardPage
              dashboard={dashboard}
              loading={loading}
              error={error}
              lastUpdated={lastUpdated}
              onRefresh={loadDashboard}
              onNavigate={navigateTo}
            />
          )}

          {activeTab === "Students" && <StudentsPage />}

          {activeTab === "Batches" && <BatchesPage />}

          {activeTab === "Attendance" && <AttendancePage />}

          {activeTab === "Fees" && <FeesPage />}

          {activeTab === "Schedules" && <SchedulesPage />}

          {activeTab === "AI Copilot" && (
            <CopilotPage dashboard={dashboard} />
          )}
        </div>
      </main>
    </div>
  );
}

function DashboardPage({
  dashboard,
  loading,
  error,
  lastUpdated,
  onRefresh,
  onNavigate,
}) {
  const stats = getDashboardStats(dashboard);

  return (
    <>
      <section className="welcome">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            INSTITUTE OVERVIEW
          </div>

          <h1>{getGreeting()}, Admin <span aria-hidden="true">👋</span></h1>

          <p className="subtitle">
            Here's what's happening at your institute today.
          </p>

          {lastUpdated && (
            <p className="updated-label">
              Last refreshed at{" "}
              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>

        <div className="welcome-actions">
          <button className="refresh-button" onClick={onRefresh}>
            <RefreshCw size={15} />
            Refresh
          </button>

          <button
            className="copilot-button"
            onClick={() => onNavigate("AI Copilot")}
          >
            <Sparkles size={16} />
            Ask AI Copilot
          </button>
        </div>
      </section>

      {error && (
        <div className="api-error">
          <AlertTriangle size={18} />
          <div>
            <strong>Unable to refresh dashboard</strong>
            <p>
              The dashboard API is unavailable. Check that your existing
              backend is running.
            </p>
          </div>
        </div>
      )}

      <section className="stats-grid">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} loading={loading} />
        ))}
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Institute Overview</h2>
              <p>Your key operational indicators</p>
            </div>

            <span className="panel-icon">
              <TrendingUp size={19} />
            </span>
          </div>

          <div className="overview-list">
            <OverviewRow
              icon={Users}
              label="Student management"
              value={stats[0].value}
              color="purple"
              onClick={() => onNavigate("Students")}
            />

            <OverviewRow
              icon={BookOpen}
              label="Course and batch management"
              value="Manage batches"
              color="blue"
              onClick={() => onNavigate("Batches")}
            />

            <OverviewRow
              icon={ClipboardCheck}
              label="Attendance monitoring"
              value="View attendance"
              color="green"
              onClick={() => onNavigate("Attendance")}
            />

            <OverviewRow
              icon={CreditCard}
              label="Fee management"
              value="View payments"
              color="orange"
              onClick={() => onNavigate("Fees")}
            />
          </div>

          <div className="panel-footer-note">
            <CheckCircle2 size={15} />
            Select a section to manage institute operations.
          </div>
        </div>

        <div className="panel copilot-panel">
          <div className="ai-icon">
            <Sparkles size={25} />
          </div>

          <div className="eyebrow">YOUR AI ASSISTANT</div>

          <h2>Your institute, at a glance.</h2>

          <p className="subtitle">
            Explore your institute operations and get help with common
            administrative questions.
          </p>

          <div className="suggestion">
            <span>TRY ASKING</span>
            <p>"How many students are currently registered?"</p>
          </div>

          <button
            className="primary-button copilot-wide-button"
            onClick={() => onNavigate("AI Copilot")}
          >
            Open AI Copilot <ArrowUpRight size={16} />
          </button>
        </div>
      </section>

      <DashboardOperations dashboard={dashboard} onNavigate={onNavigate} onRefresh={onRefresh} />
    </>
  );
}

function readLocalList(key, fallback = []) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function DashboardOperations({ dashboard, onNavigate, onRefresh }) {
  const students = readLocalList("instituteos_students", INITIAL_STUDENTS);
  const attendance = readLocalList("instituteos_attendance");
  const schedules = readLocalList("instituteos_schedules");
  const fees = readLocalList("instituteos_fees");
  const [todayDate] = useState(() => new Date());
  const today = new Date(todayDate.getTime() - todayDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const todayAttendance = attendance.filter((entry) => entry.date === today);
  const upcoming = schedules.filter((entry) => entry.date >= today).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)).slice(0, 3);
  const outstanding = fees.reduce((total, item) => total + Math.max(0, Number(item.total) - Number(item.paid)), 0);
  const apiPending = dashboard?.pendingFees ?? dashboard?.pending_fees;
  const apiAttendance = dashboard?.attendanceRate ?? dashboard?.attendance_rate;
  return <section className="dashboard-lower-grid">
    <article className="panel operations-panel"><div className="operations-title"><div><h2>Recent student activity</h2><p>Latest entries in the local directory</p></div><span className="data-source-chip">LOCAL DEMO</span></div>{students.length ? <div className="activity-list">{students.slice(0, 3).map((student) => <div className="activity-row" key={student.id}><span className="student-avatar">{student.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{student.name}</strong><small>{student.course || "Student record"}</small></div><span className={`record-badge ${(student.status || "active").toLowerCase()}`}>{student.status || "Active"}</span></div>)}</div> : <p className="operations-empty">No student records are available yet.</p>}</article>
    <article className="panel operations-panel"><div className="operations-title"><div><h2>Attendance overview</h2><p>{todayDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p></div><ClipboardCheck size={19} className="operations-icon" /></div>{apiAttendance !== undefined ? <><strong className="operations-number">{formatPercentage(apiAttendance)}</strong><p>Reported by the dashboard API</p></> : todayAttendance.length ? <><strong className="operations-number">{Math.round(todayAttendance.filter((entry) => entry.status === "Present" || entry.status === "Late").length / todayAttendance.length * 100)}%</strong><p>{todayAttendance.length} local demo attendance records</p></> : <p className="operations-empty">No attendance marked today. Use Attendance to start a local demo record.</p>}</article>
    <article className="panel operations-panel"><div className="operations-title"><div><h2>Upcoming schedules</h2><p>Next classes</p></div><CalendarDays size={19} className="operations-icon" /></div>{upcoming.length ? <div className="upcoming-list">{upcoming.map((event) => <div className="upcoming-row" key={event.id}><span>{new Date(`${event.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}<small>{event.time}</small></span><div><strong>{event.subject}</strong><small>{event.batch}</small></div></div>)}</div> : <p className="operations-empty">No upcoming class records. Add a local schedule to see it here.</p>}</article>
    <article className="panel operations-panel"><div className="operations-title"><div><h2>Pending fees</h2><p>Outstanding balance</p></div><Wallet size={19} className="operations-icon" /></div><strong className="operations-number">{apiPending !== undefined ? formatCurrency(Number(apiPending)) : fees.length ? formatCurrency(outstanding) : "—"}</strong><p>{apiPending !== undefined ? "Reported by the dashboard API" : fees.length ? `${fees.filter((item) => Number(item.total) > Number(item.paid)).length} local demo fee records need attention` : "Add local demo fee records to see a balance."}</p><button className="text-action" onClick={() => onNavigate("Fees")}>Review fees <ArrowUpRight size={14} /></button></article>
  </section>;
}

function getDashboardStats(dashboard) {
  const data =
    dashboard?.data && typeof dashboard.data === "object"
      ? dashboard.data
      : dashboard || {};
  const localStudents = readLocalList("instituteos_students", INITIAL_STUDENTS);
  const localBatches = readLocalList("instituteos_batches");
  const localAttendance = readLocalList("instituteos_attendance");
  const localFees = readLocalList("instituteos_fees");
  const today = new Date().toISOString().slice(0, 10);
  const markedToday = localAttendance.filter((record) => record.date === today);
  const localAttendanceRate = markedToday.length
    ? Math.round(
        (markedToday.filter((record) => record.status === "Present" || record.status === "Late").length /
          markedToday.length) *
          100
      )
    : null;
  const localPendingFees = localFees.reduce(
    (total, record) => total + Math.max(0, Number(record.total) - Number(record.paid)),
    0
  );

  const pick = (keys, fallback) => {
    for (const key of keys) {
      if (data[key] !== undefined && data[key] !== null) {
        return data[key];
      }
    }

    return fallback;
  };

  return [
    {
      label: "TOTAL STUDENTS",
      value: pick(["totalStudents", "total_students", "students"], localStudents.length),
      icon: Users,
      color: "purple",
      note: "Registered students",
    },
    {
      label: "ACTIVE BATCHES",
      value: pick(
        ["activeBatches", "active_batches", "batches"],
        localBatches.length
          ? localBatches.filter((batch) => batch.status === "Active").length
          : new Set(localStudents.map((student) => student.batch).filter(Boolean)).size
      ),
      icon: BookOpen,
      color: "blue",
      note: "Ongoing batches",
    },
    {
      label: "ATTENDANCE RATE",
      value: formatPercentage(
        pick(["attendanceRate", "attendance_rate"], localAttendanceRate)
      ),
      icon: ClipboardCheck,
      color: "green",
      note: "Attendance overview",
    },
    {
      label: "PENDING FEES",
      value: formatCurrency(
        pick(["pendingFees", "pending_fees"], localFees.length ? localPendingFees : null)
      ),
      icon: Wallet,
      color: "orange",
      note: "Outstanding balance",
    },
  ];
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatPercentage(value) {
  if (value === null || value === undefined || value === "—") {
    return "—";
  }

  if (typeof value === "string" && value.includes("%")) {
    return value;
  }

  return `${value}%`;
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "—") {
    return "—";
  }

  if (typeof value === "string" && /[₹$]/.test(value)) {
    return value;
  }

  if (typeof value === "number") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  }

  return String(value);
}

function StatCard({ label, value, icon: Icon, color, note, loading }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>

        <span className={`stat-icon ${color}`}>
          <Icon size={20} />
        </span>
      </div>

      <h2>{loading ? "..." : value}</h2>

      <p>
        <CheckCircle2 size={13} />
        {note}
      </p>
    </div>
  );
}

function OverviewRow({ icon: Icon, label, value, color, onClick }) {
  return (
    <button className="overview-row" onClick={onClick}>
      <span className={`overview-row-icon ${color}`}>
        <Icon size={19} />
      </span>

      <span className="overview-row-label">{label}</span>

      <span className="overview-row-value">{value}</span>

      <ArrowUpRight size={16} />
    </button>
  );
}

function StudentsPage() {
  const [students, setStudents] = useState(loadStudents);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const emptyForm = {
    name: "",
    email: "",
    phone: "",
    course: "Full Stack Development",
    batch: "Full Stack · Morning",
    status: "Active",
  };

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    try {
      localStorage.setItem(
        "instituteos_students",
        JSON.stringify(students)
      );
    } catch (error) {
      console.error("Could not save students:", error);
    }
  }, [students]);

  const filteredStudents = students.filter((student) => {
    const query = search.toLowerCase().trim();

    const matchesSearch = [
      student.id,
      student.name,
      student.email,
      student.phone,
      student.course,
      student.batch,
    ].some((value) =>
      String(value || "").toLowerCase().includes(query)
    );

    const matchesStatus =
      statusFilter === "All" || student.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  function handleSubmit(event) {
    event.preventDefault();

    const name = form.name.trim();
    const email = form.email.trim();

    if (!name || !email) return;

    if (editingId) {
      setStudents((current) =>
        current.map((student) =>
          student.id === editingId
            ? {
                ...student,
                ...form,
                name,
                email,
                phone: form.phone.trim(),
              }
            : student
        )
      );
    } else {
      const newStudent = {
        ...form,
        id: `STU${Date.now().toString().slice(-7)}`,
        name,
        email,
        phone: form.phone.trim(),
      };

      setStudents((current) => [newStudent, ...current]);
    }

    closeForm();
  }

  function handleEdit(student) {
    setEditingId(student.id);

    setForm({
      name: student.name,
      email: student.email,
      phone: student.phone || "",
      course: student.course,
      batch: student.batch || "Full Stack · Morning",
      status: student.status,
    });

    setShowForm(true);
  }

  function handleDelete(student) {
    const confirmed = window.confirm(
      `Delete ${student.name} from the student directory?`
    );

    if (!confirmed) return;

    setStudents((current) =>
      current.filter((item) => item.id !== student.id)
    );
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  return (
    <div className="module-page students-page">
      <div className="module-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            INSTITUTE MANAGEMENT
          </div>

          <h1>Students</h1>

          <p className="subtitle">
            Manage student profiles, enrolments, and academic progress.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => {
            setForm(emptyForm);
            setEditingId(null);
            setShowForm(true);
          }}
        >
          + Add Student
        </button>
      </div>

      <section className="stats-grid student-stats">
        <StatCard
          label="TOTAL STUDENTS"
          value={students.length}
          icon={Users}
          color="purple"
          note="All registered students"
        />

        <StatCard
          label="ACTIVE STUDENTS"
          value={students.filter((s) => s.status === "Active").length}
          icon={CheckCircle2}
          color="green"
          note="Currently enrolled"
        />

        <StatCard
          label="PENDING"
          value={students.filter((s) => s.status === "Pending").length}
          icon={Clock}
          color="orange"
          note="Awaiting confirmation"
        />

        <StatCard
          label="COURSES"
          value={new Set(students.map((s) => s.course)).size}
          icon={BookOpen}
          color="blue"
          note="Courses represented"
        />
      </section>

      <section className="panel students-panel">
        <div className="students-toolbar">
          <div>
            <h2>Student Directory</h2>
            <p className="subtitle">
              Search and manage your student records.
            </p>
          </div>

          <span className="student-record-count">
            {filteredStudents.length} records
          </span>
        </div>

        <div className="student-filters">
          <div className="student-search">
            <Search size={18} />

            <input
              type="search"
              placeholder="Search name, ID, email, or course..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search students"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter by status"
          >
            <option value="All">All statuses</option>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        {showForm && (
          <form className="student-form" onSubmit={handleSubmit}>
            <div className="student-form-heading">
              <h2>{editingId ? "Edit Student" : "Add New Student"}</h2>

              <button
                type="button"
                className="student-close-button"
                onClick={closeForm}
                aria-label="Close form"
              >
                <X size={19} />
              </button>
            </div>

            <div className="student-form-grid">
              <label>
                Full Name *
                <input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="Enter full name"
                />
              </label>

              <label>
                Email Address *
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  placeholder="student@example.com"
                />
              </label>

              <label>
                Phone Number
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                  placeholder="Enter phone number"
                />
              </label>

              <label>
                Course
                <select
                  value={form.course}
                  onChange={(event) =>
                    setForm({ ...form, course: event.target.value })
                  }
                >
                  <option>Full Stack Development</option>
                  <option>Data Science</option>
                  <option>UI/UX Design</option>
                  <option>Digital Marketing</option>
                  <option>Cloud Computing</option>
                </select>
              </label>

              <label>
                Batch
                <select
                  value={form.batch}
                  onChange={(event) =>
                    setForm({ ...form, batch: event.target.value })
                  }
                >
                  <option>Full Stack · Morning</option>
                  <option>Data Science · Evening</option>
                  <option>Product Design · Weekend</option>
                </select>
              </label>

              <label>
                Enrollment Status
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value })
                  }
                >
                  <option>Active</option>
                  <option>Pending</option>
                  <option>Inactive</option>
                </select>
              </label>
            </div>

            <div className="student-form-actions">
              <button
                type="button"
                className="student-secondary-button"
                onClick={closeForm}
              >
                Cancel
              </button>

              <button type="submit" className="primary-button">
                {editingId ? "Save Changes" : "Add Student"}
              </button>
            </div>
          </form>
        )}

        <div className="student-table-wrapper">
          <table className="student-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Student ID</th>
                <th>Batch / Course</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id}>
                  <td>
                    <div className="student-identity">
                      <div className="student-avatar">
                        {student.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>

                      <div className="student-identity-text">
                        <strong>{student.name}</strong>
                        <span>{student.email}</span>
                      </div>
                    </div>
                  </td>

                  <td>
                    <span className="student-id">{student.id}</span>
                  </td>

                  <td>{student.batch || student.course}<small className="cell-subtitle">{student.course}</small></td>
                  <td>{student.phone || "—"}</td>

                  <td>
                    <span
                      className={`student-status ${student.status.toLowerCase()}`}
                    >
                      <span />
                      {student.status}
                    </span>
                  </td>

                  <td>
                    <div className="student-actions">
                      <button
                        type="button"
                        onClick={() => handleEdit(student)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="student-delete"
                        onClick={() => handleDelete(student)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan="6" className="student-no-results">
                    <Users size={30} />
                    <strong>No students found</strong>
                    <span>
                      Try another search or change the status filter.
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="student-storage-note">
        <CheckCircle2 size={15} />
        Changes are saved locally in this browser.
      </p>
    </div>
  );
}

function CopilotPage({ dashboard }) {
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const [today] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  });
  const replyTimer = useRef(null);
  const [messages, setMessages] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("instituteos_copilot") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("instituteos_copilot", JSON.stringify(messages));
    } catch (storageError) {
      console.error("Could not save Copilot history:", storageError);
    }
  }, [messages]);

  useEffect(() => () => window.clearTimeout(replyTimer.current), []);

  const suggestions = [
    "How many students are registered?",
    "What is the current attendance rate?",
    "Which fees are pending?",
    "What classes are scheduled today?",
    "Give me an institute overview.",
  ];

  function answerQuestion(rawQuestion) {
    const text = rawQuestion.trim();
    if (!text) return;

    const q = text.toLowerCase();

    const data =
      dashboard?.data && typeof dashboard.data === "object"
        ? dashboard.data
        : dashboard || {};

    let answer =
      "I can answer questions about your dashboard and the demo records stored in this browser. Try asking about students, attendance, pending fees, or today's classes.";

    if (q.includes("student")) {
      let count = data.totalStudents ?? data.total_students ?? data.students;
      if (count === undefined) {
        try {
          const savedStudents = JSON.parse(localStorage.getItem("instituteos_students") || "[]");
          count = Array.isArray(savedStudents) ? savedStudents.length : 0;
        } catch {
          count = 0;
        }
      }

      answer = `There are ${count} student${Number(count) === 1 ? "" : "s"} in the ${data.totalStudents !== undefined || data.total_students !== undefined || data.students !== undefined ? "dashboard data" : "local demo directory"}. You can search and manage the local directory in Students.`;
    } else if (q.includes("attendance")) {
      const rate = data.attendanceRate ?? data.attendance_rate;
      answer = rate !== undefined
        ? `The dashboard reports an attendance rate of ${formatPercentage(rate)}.`
        : "Attendance records are saved locally by batch and date. Open Attendance to mark Present, Absent, or Late and see the current day's percentage.";
    } else if (
      q.includes("fee") ||
      q.includes("payment") ||
      q.includes("balance")
    ) {
      let due = data.pendingFees ?? data.pending_fees;
      if (due === undefined) {
        try {
          const feeRecords = JSON.parse(localStorage.getItem("instituteos_fees") || "[]");
          if (Array.isArray(feeRecords) && feeRecords.length) {
            due = feeRecords.reduce((total, fee) => total + Math.max(0, Number(fee.total) - Number(fee.paid)), 0);
          }
        } catch {
          due = undefined;
        }
      }
      answer = due !== undefined
        ? `The currently available pending balance is ${formatCurrency(Number(due))}. Fee records are demo data stored locally.`
        : "No fee totals are available yet. Add fee records in Fees to track paid amounts and outstanding balances locally.";
    } else if (q.includes("batch") || q.includes("course")) {
      answer = "Batches lets you create and edit class groups, assign instructors, track capacity, and search by course or schedule. Changes are stored locally in this browser.";
    } else if (
      q.includes("schedule") ||
      q.includes("timetable") ||
      q.includes("class")
    ) {
      try {
        const events = JSON.parse(localStorage.getItem("instituteos_schedules") || "[]");
        const todayEvents = Array.isArray(events) ? events.filter((event) => event.date === today) : [];
        answer = todayEvents.length
          ? `There ${todayEvents.length === 1 ? "is" : "are"} ${todayEvents.length} class${todayEvents.length === 1 ? "" : "es"} scheduled today: ${todayEvents.map((event) => `${event.time} ${event.subject} (${event.batch})`).join("; ")}.`
          : "There are no classes listed for today in the local schedule. Open Schedules to add or review upcoming classes.";
      } catch {
        answer = "Schedule data is not available yet. Open Schedules to manage local class entries.";
      }
    } else if (q.includes("overview")) {
      const totalStudents = data.totalStudents ?? data.total_students ?? data.students;
      const batches = data.activeBatches ?? data.active_batches ?? data.batches;
      const attendance = data.attendanceRate ?? data.attendance_rate;
      answer = `Institute overview: ${totalStudents ?? "Dashboard student count unavailable"} students, ${batches ?? "batch count unavailable"} active batches${attendance !== undefined ? `, and ${formatPercentage(attendance)} attendance` : ""}. Other modules use local demo records in this browser.`;
    } else if (q.includes("help") || q.includes("what can")) {
      answer =
        "I can provide guidance about the InstituteOS modules. The current assistant uses local response rules and does not connect to an external AI service.";
    }

    window.clearTimeout(replyTimer.current);
    setMessages((current) => [...current, { role: "user", text }]);
    setQuestion("");
    setThinking(true);
    replyTimer.current = window.setTimeout(() => {
      setMessages((current) => [...current, { role: "assistant", text: answer }]);
      setThinking(false);
    }, 280);
  }

  return (
    <div className="module-page">
      <div className="module-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            INTELLIGENT ASSISTANCE
          </div>

          <h1>AI Copilot</h1>

          <p className="subtitle">
            Your local assistant for common institute management questions.
          </p>
        </div>

        <div className="module-icon">
          <Bot size={27} />
        </div>
      </div>

      <section className="panel chat-panel">
        <div className="ai-icon">
          <Sparkles size={25} />
        </div>

          <div className="chat-heading-row"><div><h2>How can I help you today?</h2><p className="subtitle">Ask a question or choose one of the suggestions below.</p></div><button className="student-secondary-button" onClick={() => { window.clearTimeout(replyTimer.current); setThinking(false); setMessages([]); }} disabled={messages.length === 0}>Clear conversation</button></div>

        <div className="suggested-questions">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              disabled={thinking}
              onClick={() => answerQuestion(suggestion)}
            >
              <Sparkles size={15} />
              {suggestion}
            </button>
          ))}
        </div>

        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-empty">Your conversation will appear here. Responses use local demo data and stay in this browser.</div>
          )}
          {messages.map((message, index) => (
            <div
              key={`${index}-${message.role}`}
              className={`chat-message ${message.role}`}
            >
              <strong>
                {message.role === "user" ? "You" : "InstituteOS Copilot"}
              </strong>
              <p>{message.text}</p>
            </div>
          ))}
          {thinking && <div className="chat-message assistant chat-thinking" role="status">InstituteOS Copilot is thinking…</div>}
        </div>

        <form
          className="chat-form"
          onSubmit={(event) => {
            event.preventDefault();
            answerQuestion(question);
          }}
        >
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about your institute..."
            aria-label="Ask AI Copilot"
          />

          <button type="submit" className="primary-button" disabled={!question.trim() || thinking}>
            <Send size={16} />
            Send
          </button>
        </form>

        <p className="copilot-disclaimer">
          This assistant uses local demo responses, not a live AI model.
        </p>
      </section>
    </div>
  );
}

export default App;
