import { useState, useEffect, useCallback } from "react";
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

const MENU_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Students", icon: Users },
  { label: "Batches", icon: BookOpen },
  { label: "Attendance", icon: ClipboardCheck },
  { label: "Fees", icon: Wallet },
  { label: "Schedules", icon: CalendarDays },
  { label: "AI Copilot", icon: Bot },
];

function App() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setApiError("");

    try {
      const data = await getDashboard();

      setDashboard(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Dashboard API error:", error);

      setApiError(
        "Unable to connect to the backend. Make sure your Express server is running on port 5000."
      );
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
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">
            <GraduationCap size={25} />
          </div>

          <div>
            <h2>InstituteOS</h2>
            <span>OPERATIONS PLATFORM</span>
          </div>

          <button
            className="mobile-close"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="workspace">
          <div className="workspace-avatar">I</div>

          <div className="workspace-details">
            <strong>My Institute</strong>
            <span>Administration</span>
          </div>

          <span className="workspace-dot" />
        </div>

        <p className="menu-title">WORKSPACE</p>

        <nav className="navigation">
          {MENU_ITEMS.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`menu-item ${
                activeTab === label ? "active" : ""
              }`}
              onClick={() => navigateTo(label)}
            >
              <Icon size={19} strokeWidth={1.8} />

              <span>{label}</span>

              {label === "AI Copilot" && (
                <span className="ai-menu-badge">AI</span>
              )}

              {label === "Dashboard" && (
                <span className="menu-active-dot" />
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <div className="help-icon">
              <Sparkles size={19} />
            </div>

            <strong>Your AI assistant</strong>

            <p>
              Discover insights and simplify your daily institute operations.
            </p>

            <button onClick={() => navigateTo("AI Copilot")}>
              Open Copilot <ArrowUpRight size={15} />
            </button>
          </div>

          <div className="profile">
            <div className="profile-avatar">AD</div>

            <div className="profile-info">
              <strong>Admin User</strong>
              <span>Administrator</span>
            </div>

            <span className="profile-status" />
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-button"
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={22} />
            </button>

            <div className="breadcrumbs">
              <span>Institute</span>
              <span className="breadcrumb-divider">/</span>
              <strong>{activeTab}</strong>
            </div>
          </div>

          <div className="topbar-right">
            <div className="connection-status">
              {apiError ? (
                <>
                  <WifiOff size={15} />
                  <span>Connection issue</span>
                </>
              ) : (
                <>
                  <span className="online-dot" />
                  <span>System Online</span>
                </>
              )}
            </div>

            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={19} />
              <span className="notification-dot" />
            </button>

            <div className="topbar-avatar">AD</div>
          </div>
        </header>

        <section className="page-content">
          {activeTab === "Dashboard" ? (
            <DashboardPage
              dashboard={dashboard}
              loading={loading}
              apiError={apiError}
              lastUpdated={lastUpdated}
              onRefresh={loadDashboard}
              onNavigate={navigateTo}
            />
          ) : activeTab === "AI Copilot" ? (
            <CopilotPage dashboard={dashboard} />
          ) : (
            <ModulePage
              activeTab={activeTab}
              onNavigate={navigateTo}
            />
          )}
        </section>

        <footer className="app-footer">
          <span>
            <span className="footer-dot" />
            InstituteOS Operations Platform
          </span>

          <span>Built for smarter institute management</span>
        </footer>
      </main>
    </div>
  );
}

/* =========================================================
   DASHBOARD
========================================================= */

function DashboardPage({
  dashboard,
  loading,
  apiError,
  lastUpdated,
  onRefresh,
  onNavigate,
}) {
  const stats = dashboard
    ? [
        {
          title: "Total Students",
          value: Number(dashboard.totalStudents).toLocaleString("en-IN"),
          detail: "Registered students",
          icon: Users,
          className: "purple",
        },
        {
          title: "Active Batches",
          value: dashboard.activeBatches,
          detail: "Across all courses",
          icon: BookOpen,
          className: "blue",
        },
        {
          title: "Today's Attendance",
          value: `${dashboard.attendancePercentage}%`,
          detail: "Institute attendance",
          icon: ClipboardCheck,
          className: "green",
        },
        {
          title: "Pending Fees",
          value: `₹${(Number(dashboard.pendingFees) / 100000).toFixed(2)}L`,
          detail: `${dashboard.overdueInstalments} instalments overdue`,
          icon: Wallet,
          className: "orange",
        },
      ]
    : [];

  return (
    <>
      {/* PAGE HEADING */}
      <div className="welcome">
        <div className="welcome-copy">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            INSTITUTE OVERVIEW
          </div>

          <h1>
            Good afternoon, Admin <span className="wave">👋</span>
          </h1>

          <p className="subtitle">
            Here's what's happening at your institute today.
          </p>

          {lastUpdated && !apiError && (
            <p className="last-updated">
              <CheckCircle2 size={14} />
              Data fetched from your backend ·{" "}
              {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        <div className="welcome-actions">
          <button
            className="secondary-button refresh-button"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? "spin" : ""}
            />
            Refresh
          </button>

          <button
            className="copilot-button"
            onClick={() => onNavigate("AI Copilot")}
          >
            <Sparkles size={17} />
            Ask AI Copilot
            <ArrowUpRight size={15} />
          </button>
        </div>
      </div>

      {/* API ERROR */}
      {apiError && (
        <div className="connection-error" role="alert">
          <div className="error-icon">
            <AlertTriangle size={21} />
          </div>

          <div className="error-content">
            <strong>Unable to load dashboard data</strong>
            <p>{apiError}</p>
          </div>

          <button
            className="secondary-button"
            onClick={onRefresh}
            disabled={loading}
          >
            Try again
          </button>
        </div>
      )}

      {/* STATISTICS */}
      <div className="section-heading">
        <div>
          <h2>Performance overview</h2>
          <p>Your institute at a glance</p>
        </div>

        <span className="live-badge">
          <span className="live-dot" />
          API CONNECTED
        </span>
      </div>

      <div className="stats-grid">
        {loading && !dashboard ? (
          <StatsSkeleton />
        ) : stats.length ? (
          stats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))
        ) : (
          <div className="panel empty-state">
            <AlertTriangle size={25} />
            <strong>No dashboard data available</strong>
            <p>Check your backend connection and try again.</p>
          </div>
        )}
      </div>

      {/* MAIN DASHBOARD PANELS */}
      <div className="content-grid">
        <section className="panel alerts-panel">
          <div className="panel-heading">
            <div>
              <h2>Operational alerts</h2>
              <p>Issues that may need your attention</p>
            </div>

            <span className="alert-count">
              <span className="alert-count-dot" />
              3 alerts
            </span>
          </div>

          <Alert
            icon={AlertTriangle}
            title="Students with low attendance"
            description="12 students have attendance below 75%."
            color="orange"
            tag="Attention"
          />

          <Alert
            icon={CreditCard}
            title="Overdue fee instalments"
            description="18 instalments need payment follow-up."
            color="red"
            tag="Payments"
          />

          <Alert
            icon={CalendarDays}
            title="Trainer schedule review"
            description="Review upcoming trainer assignments."
            color="blue"
            tag="Scheduling"
          />

          <button
            className="text-button"
            onClick={() => onNavigate("Attendance")}
          >
            Review institute operations
            <ArrowUpRight size={16} />
          </button>
        </section>

        <section className="panel copilot-panel">
          <div className="copilot-orb">
            <div className="orb-ring orb-ring-one" />
            <div className="orb-ring orb-ring-two" />
            <div className="orb-center">
              <Sparkles size={27} />
            </div>
          </div>

          <div className="eyebrow">YOUR AI ASSISTANT</div>

          <h2>
            Meet your
            <br />
            <span>Operations Copilot</span>
          </h2>

          <p className="subtitle">
            Explore institute insights, identify operational issues, and
            simplify your daily work.
          </p>

          <button
            className="primary-button copilot-open-button"
            onClick={() => onNavigate("AI Copilot")}
          >
            Open AI Copilot
            <ArrowUpRight size={17} />
          </button>

          <div className="suggestion">
            <Sparkles size={15} />
            <span>Which students need immediate attention?</span>
          </div>

          <div className="copilot-footer">
            <span className="copilot-status-dot" />
            Ready to assist
          </div>
        </section>
      </div>

      {/* QUICK ACTIONS */}
      <div className="section-heading quick-heading">
        <div>
          <h2>Quick actions</h2>
          <p>Jump into your daily workflows</p>
        </div>
      </div>

      <div className="quick-actions">
        <QuickAction
          icon={Users}
          title="Manage students"
          description="View student records"
          onClick={() => onNavigate("Students")}
          color="purple"
        />

        <QuickAction
          icon={ClipboardCheck}
          title="Take attendance"
          description="Review attendance"
          onClick={() => onNavigate("Attendance")}
          color="green"
        />

        <QuickAction
          icon={Wallet}
          title="Track payments"
          description="Review fee instalments"
          onClick={() => onNavigate("Fees")}
          color="orange"
        />

        <QuickAction
          icon={CalendarDays}
          title="View schedules"
          description="Check class timetables"
          onClick={() => onNavigate("Schedules")}
          color="blue"
        />
      </div>

      <div className="data-notice">
        <Clock size={15} />
        <span>
          Dashboard statistics are retrieved from the Express API. Until
          Supabase is connected, the API returns demonstration data.
        </span>
      </div>
    </>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({ title, value, detail, icon: Icon, className }) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <div className={`stat-icon ${className}`}>
          <Icon size={21} strokeWidth={1.8} />
        </div>

        <span className="stat-menu-dot">•••</span>
      </div>

      <p className="stat-label">{title}</p>

      <div className="stat-value-row">
        <h3>{value}</h3>
        <TrendingUp size={16} className="stat-trend" />
      </div>

      <p className="stat-detail">{detail}</p>

      <div className={`stat-bottom-line ${className}`} />
    </article>
  );
}

/* =========================================================
   LOADING SKELETON
========================================================= */

function StatsSkeleton() {
  return Array.from({ length: 4 }).map((_, index) => (
    <div className="stat-card skeleton-card" key={index}>
      <div className="skeleton skeleton-icon" />
      <div className="skeleton skeleton-label" />
      <div className="skeleton skeleton-value" />
      <div className="skeleton skeleton-detail" />
    </div>
  ));
}

/* =========================================================
   ALERT
========================================================= */

function Alert({ icon: Icon, title, description, color, tag }) {
  return (
    <div className="alert-row">
      <div className={`alert-icon ${color}`}>
        <Icon size={19} />
      </div>

      <div className="alert-body">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      <span className={`alert-tag ${color}`}>{tag}</span>
    </div>
  );
}

/* =========================================================
   QUICK ACTION
========================================================= */

function QuickAction({
  icon: Icon,
  title,
  description,
  onClick,
  color,
}) {
  return (
    <button className="quick-action" onClick={onClick}>
      <div className={`quick-action-icon ${color}`}>
        <Icon size={21} />
      </div>

      <div className="quick-action-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>

      <ArrowUpRight size={17} className="quick-action-arrow" />
    </button>
  );
}

/* =========================================================
   AI COPILOT
========================================================= */

function CopilotPage({ dashboard }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hello, Admin! 👋 I'm your Institute Operations Copilot. I can help you interpret the current dashboard figures. What would you like to explore?",
    },
  ]);

  function askCopilot(text) {
    const question = text.trim();

    if (!question) return;

    let response;

    if (!dashboard) {
      response =
        "I couldn't retrieve dashboard data from the backend. Please check that your server is running. Detailed operational insights will be available after the database and AI service are connected.";
    } else if (/attendance|absent|present|student/i.test(question)) {
      response = `Your dashboard currently reports ${dashboard.totalStudents} students and an institute attendance figure of ${dashboard.attendancePercentage}%. This API does not yet provide individual attendance records, so I cannot identify specific students who need attention.`;
    } else if (/fee|payment|instalment|installment|money/i.test(question)) {
      response = `The dashboard reports ₹${Number(dashboard.pendingFees).toLocaleString("en-IN")} in pending fees and ${dashboard.overdueInstalments} overdue instalments. Individual payment records are not yet connected, so please verify the fee ledger before contacting students.`;
    } else if (/batch|course|class/i.test(question)) {
      response = `Your dashboard reports ${dashboard.activeBatches} active batches. Once the batch database is connected, we can add course-level enrolments, trainer assignments, and capacity information.`;
    } else if (/trainer|schedule|timetable|conflict/i.test(question)) {
      response =
        "Trainer schedules are not available through the current dashboard endpoint. Once we connect the scheduling database, we can check trainer availability and detect overlapping classes.";
    } else if (/summary|today|overview|operation/i.test(question)) {
      response = `Here's your current dashboard summary:\n\n• Students: ${dashboard.totalStudents}\n• Active batches: ${dashboard.activeBatches}\n• Attendance: ${dashboard.attendancePercentage}%\n• Pending fees: ₹${Number(dashboard.pendingFees).toLocaleString("en-IN")}\n• Overdue instalments: ${dashboard.overdueInstalments}\n\nThese figures currently come from demonstration data served by your backend.`;
    } else {
      response =
        "I can help interpret your current dashboard figures for students, batches, attendance, and fees. For verified student-level insights and AI-generated analysis, we'll need to connect your database and AI service.";
    }

    setMessages((previous) => [
      ...previous,
      { role: "user", text: question },
      { role: "assistant", text: response },
    ]);

    setInput("");
  }

  const suggestions = [
    "Summarize today's operations",
    "How is attendance?",
    "Show pending fees",
    "Tell me about batches",
  ];

  return (
    <div className="copilot-page">
      <div className="copilot-page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            INTELLIGENT OPERATIONS
          </div>

          <h1>AI Operations Copilot</h1>

          <p className="subtitle">
            Your assistant for understanding institute operations.
          </p>
        </div>

        <div className="ai-availability">
          <span className="live-dot" />
          Demo assistant
        </div>
      </div>

      <section className="panel chat-panel">
        <div className="chat-header">
          <div className="chat-avatar">
            <Bot size={23} />
          </div>

          <div>
            <h2>InstituteOS Copilot</h2>
            <p>
              <span className="copilot-status-dot" />
              Dashboard context {dashboard ? "available" : "unavailable"}
            </p>
          </div>

          <span className="chat-header-badge">DEMO</span>
        </div>

        <div className="chat-messages" aria-live="polite">
          {messages.map((message, index) => (
            <div
              className={`chat-message ${
                message.role === "user" ? "user-message" : ""
              }`}
              key={`${message.role}-${index}`}
            >
              {message.role === "assistant" && (
                <div className="message-avatar">
                  <Sparkles size={17} />
                </div>
              )}

              <div className="message-content">
                <span className="message-role">
                  {message.role === "user" ? "You" : "Copilot"}
                </span>

                <p>{message.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="suggested-questions">
          <p>TRY ASKING</p>

          <div className="suggestion-chips">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => askCopilot(suggestion)}
              >
                <Sparkles size={14} />
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        <form
          className="chat-form"
          onSubmit={(event) => {
            event.preventDefault();
            askCopilot(input);
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about your institute..."
            aria-label="Ask the operations copilot"
          />

          <button
            type="submit"
            className="primary-button send-button"
            disabled={!input.trim()}
          >
            <span>Send</span>
            <Send size={16} />
          </button>
        </form>

        <p className="chat-disclaimer">
          <Sparkles size={13} />
          Demo mode: responses use predefined logic and dashboard figures.
          No AI model is connected yet.
        </p>
      </section>
    </div>
  );
}

/* =========================================================
   PLACEHOLDER MODULES
========================================================= */

function ModulePage({ activeTab, onNavigate }) {
  const moduleDetails = {
    Students: {
      icon: Users,
      description:
        "Manage student profiles, enrolments, and academic progress.",
      features: [
        "Student directory",
        "Enrolment tracking",
        "Student profile management",
      ],
    },
    Batches: {
      icon: BookOpen,
      description:
        "Organize courses, batches, enrolments, and trainer assignments.",
      features: [
        "Batch directory",
        "Course assignments",
        "Batch capacity tracking",
      ],
    },
    Attendance: {
      icon: ClipboardCheck,
      description:
        "Monitor attendance and identify students who may need support.",
      features: [
        "Daily attendance",
        "Attendance percentages",
        "Low-attendance monitoring",
      ],
    },
    Fees: {
      icon: Wallet,
      description:
        "Track fee instalments, payment status, and outstanding balances.",
      features: [
        "Payment ledger",
        "Instalment tracking",
        "Overdue payment follow-up",
      ],
    },
    Schedules: {
      icon: CalendarDays,
      description:
        "Organize classes and coordinate trainer availability.",
      features: [
        "Class timetables",
        "Trainer availability",
        "Schedule conflict detection",
      ],
    },
  };

  const details = moduleDetails[activeTab] || moduleDetails.Students;
  const Icon = details.icon;

  return (
    <div className="module-page">
      <div className="module-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            INSTITUTE MANAGEMENT
          </div>

          <h1>{activeTab}</h1>
          <p className="subtitle">{details.description}</p>
        </div>

        <div className="module-icon">
          <Icon size={27} />
        </div>
      </div>

      <section className="panel module-empty-state">
        <div className="module-empty-icon">
          <Icon size={31} />
        </div>

        <span className="coming-soon-badge">MODULE IN DEVELOPMENT</span>

        <h2>{activeTab} management</h2>

        <p>
          This section is ready for implementation. We'll connect it to
          the database and build the actual management workflows next.
        </p>

        <div className="module-feature-list">
          {details.features.map((feature) => (
            <div key={feature} className="module-feature">
              <CheckCircle2 size={17} />
              <span>{feature}</span>
            </div>
          ))}
        </div>

        <button
          className="primary-button"
          onClick={() => onNavigate("Dashboard")}
        >
          Return to Dashboard
          <ArrowUpRight size={16} />
        </button>
      </section>
    </div>
  );
}

export default App;