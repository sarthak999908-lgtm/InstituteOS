import { useState, useEffect, useCallback, lazy, Suspense, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles, Bot } from "lucide-react";
import Lenis from "lenis";

import "./App.css";
import "./app-shell.css";
import { getDashboard } from "./services/api";
import { useSessionStore } from "./state/session.js";
import { useTheme } from "./app/providers.jsx";
import { sound } from "./lib/sound.js";
import { pageVariants, springs } from "./lib/motion.js";
import {
  supabaseEnabled,
  onAuthStateChange,
  signOut as supabaseSignOut,
  getUserProfile,
  getSession,
} from "./services/supabase.js";


// Layout & Common Components
import MeshBackground from "./components/layout/MeshBackground.jsx";
import Sidebar from "./components/layout/Sidebar.jsx";
import Topbar from "./components/layout/Topbar.jsx";
import CommandPalette from "./components/common/CommandPalette.jsx";
import FpsMeter from "./components/common/FpsMeter.jsx";
import { ToastContainer, toast } from "./components/common/Toast.jsx";
import StudentDrawer from "./components/common/Drawer.jsx";
import BootSequence from "./components/common/BootSequence.jsx";
import Orb from "./components/common/Orb.jsx";
import Skeleton from "./components/common/Skeleton.jsx";
import LoginPage from "./features/auth/LoginPage.jsx";
import KeyboardShortcutsModal from "./components/common/KeyboardShortcutsModal.jsx";

// Page Views
import DashboardBento from "./pages/DashboardBento.jsx";
import StudentsPage from "./pages/StudentsPage.jsx";
import UiDesignSystemPage from "./pages/UiDesignSystemPage.jsx";

const { BatchesPage, FeesPage } = {
  BatchesPage: lazy(() => import("./modules.jsx").then((m) => ({ default: m.BatchesPage }))),
  FeesPage: lazy(() => import("./modules.jsx").then((m) => ({ default: m.FeesPage }))),
};
const AttendancePage = lazy(() => import("./features/attendance/AttendancePage.jsx"));
const CopilotWorkspace = lazy(() => import("./features/copilot/CopilotPage.jsx"));
const ReportsPage = lazy(() => import("./features/admin/AdminPages.jsx").then((m) => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import("./features/admin/AdminPages.jsx").then((m) => ({ default: m.SettingsPage })));
const SchedulesPage = lazy(() => import("./features/schedules/SchedulesPage.jsx"));

function hasDemoSession() {
  try {
    return localStorage.getItem("instituteos_demo_session") === "true";
  } catch {
    return false;
  }
}

export default function App() {
  const { role, userId, userName, setRole } = useSessionStore();
  const { calmMode } = useTheme();
  const prefersReducedMotion = useReducedMotion();

  // Start signed-in only from localStorage demo flag; Supabase session is
  // checked asynchronously below via onAuthStateChange / getSession.
  const [signedIn, setSignedIn] = useState(hasDemoSession);

  const [activeTab, setActiveTab] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        const hash = window.location.hash.toLowerCase();
        const path = window.location.pathname.toLowerCase();
        if (hash === "#ui" || path.includes("/ui")) return "UI System";
      }
    } catch {}
    return "Dashboard";
  });

  const [bootCompleted, setBootCompleted] = useState(() => {
    try {
      return sessionStorage.getItem("instituteos_boot_shown") === "true";
    } catch {
      return false;
    }
  });

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [copilotInitialPrompt, setCopilotInitialPrompt] = useState("");

  const [drawerStudent, setDrawerStudent] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Initialize Lenis smooth scroll
  useEffect(() => {
    if (calmMode || prefersReducedMotion) return;

    let lenis;
    try {
      lenis = new Lenis({
        duration: 1.1,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });

      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      const reqId = requestAnimationFrame(raf);

      return () => {
        cancelAnimationFrame(reqId);
        lenis.destroy();
      };
    } catch (e) {
      console.warn("Lenis initialization skipped:", e);
    }
  }, [calmMode, prefersReducedMotion]);

  // ── Auth session restore ───────────────────────────────────────────────────
  useEffect(() => {
    // Check for an existing session on mount (handles page refresh)
    getSession().then(async (session) => {
      if (session?.user) {
        const profile = await getUserProfile(session.user.id);
        const userRole = profile?.role || session.user.role || session.user.app_metadata?.role || "owner";
        setRole(userRole);
        setSignedIn(true);
      }
    });

    if (!supabaseEnabled) return;

    // Subscribe to future auth events
    const unsub = onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const profile = await getUserProfile(session.user.id);
        const userRole = profile?.role || session.user.role || session.user.app_metadata?.role || "counselor";
        setRole(userRole);
        setSignedIn(true);
      }
      if (event === "SIGNED_OUT") {
        try { localStorage.removeItem("instituteos_demo_session"); } catch {}
        try { localStorage.removeItem("instituteos_session"); } catch {}
        setSignedIn(false);
        setActiveTab("Dashboard");
      }
    });

    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Load dashboard telemetry data
  const loadDashboardData = useCallback(async (refresh = false) => {
    if (refresh) {
      setLoading(true);
      setError("");
    }
    try {
      const res = await getDashboard();
      setDashboard(res);
      setLastUpdated(new Date());
    } catch (err) {
      console.warn("Live API connection unavailable, falling back to local SQLite telemetry.", err);
      setError("Dashboard live telemetry unavailable. Displaying local data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (signedIn) loadDashboardData();
  }, [loadDashboardData, signedIn]);

  // Global listeners for command palette and student drawer
  useEffect(() => {
    const handleOpenPalette = () => setCommandPaletteOpen(true);
    const handleOpenDrawerEvent = (e) => {
      if (e.detail) {
        setDrawerStudent(e.detail);
        setDrawerOpen(true);
      }
    };

    window.addEventListener("open-command-palette", handleOpenPalette);
    window.addEventListener("open-student-drawer", handleOpenDrawerEvent);

    return () => {
      window.removeEventListener("open-command-palette", handleOpenPalette);
      window.removeEventListener("open-student-drawer", handleOpenDrawerEvent);
    };
  }, []);

  // Global keyboard shortcuts (1-9 to switch tabs, ? to open cheat-sheet)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }

      const tabsOrder = [
        "Dashboard",
        "Students",
        "Batches",
        "Attendance",
        "Fees",
        "Schedules",
        "AI Copilot",
        "Reports",
        "Settings",
      ];
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= tabsOrder.length) {
        const targetTab = tabsOrder[num - 1];
        if (targetTab === "Fees" && (role === "trainer" || role === "counselor")) return;
        if (targetTab === "Settings" && (role === "trainer" || role === "counselor")) return;
        e.preventDefault();
        navigateTo(targetTab);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [role]);

  const navigateTo = (tab) => {
    sound.tick();
    setActiveTab(tab);
    setMobileSidebarOpen(false);
    if (tab === "UI System") {
      window.location.hash = "ui";
    } else {
      if (window.location.hash === "#ui") {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  };

  const changeRole = (nextRole) => {
    setRole(nextRole);
    if ((nextRole === "trainer" || nextRole === "counselor") && (activeTab === "Fees" || activeTab === "Settings")) {
      setActiveTab("Dashboard");
    }
  };

  const handleCopilotPrompt = (prompt) => {
    setCopilotInitialPrompt(prompt);
    setActiveTab("AI Copilot");
  };

  const handleSelectStudentForDrawer = (student) => {
    setDrawerStudent(student);
    setDrawerOpen(true);
  };

  const signIn = (user) => {
    try {
      // Only set demo flag when no real Supabase user is provided
      if (!user) localStorage.setItem("instituteos_demo_session", "true");
    } catch {}
    setSignedIn(true);
    toast.success("Welcome back!", `Signed in as ${userName} (${role.toUpperCase()})`);
  };

  const signOut = async () => {
    try { localStorage.removeItem("instituteos_demo_session"); } catch {}
    try { localStorage.removeItem("instituteos_session"); } catch {}
    await supabaseSignOut();
    setSignedIn(false);
    setActiveTab("Dashboard");
  };


  // 1. First-Load Boot Sequence (1.6s on a clean white canvas)
  if (!bootCompleted) {
    return (
      <BootSequence
        onComplete={() => {
          try {
            sessionStorage.setItem("instituteos_boot_shown", "true");
          } catch {}
          setBootCompleted(true);
        }}
      />
    );
  }

  // 2. Authentication View (4 3D-tilting glass cards)
  if (!signedIn) {
    return <LoginPage role={role} onRoleChange={changeRole} onLogin={signIn} />;
  }

  return (
    <div className="app-shell" style={{ position: "relative", minHeight: "100vh", display: "flex", overflowX: "hidden" }}>
      {/* Living Theme-Aware Background */}
      <MeshBackground />

      {/* Primary Sidebar Rail (Collapsible, role-scoped, mobile-responsive) */}
      <Sidebar
        activeTab={activeTab}
        onNavigate={navigateTo}
        role={role}
        userName={userName}
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Viewport Container */}
      <div
        className="app-main-viewport"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          marginLeft: 72,
          transition: "margin-left 0.25s ease",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Sticky Topbar */}
        <Topbar
          activeTab={activeTab}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onRefresh={loadDashboardData}
          loading={loading}
          error={error}
          dashboard={dashboard}
          role={role}
          onRoleChange={changeRole}
          onOpenMobileMenu={() => setMobileSidebarOpen(true)}
        />

        {/* Page Content Body */}
        <main
          className="app-page-viewport"
          style={{
            flex: 1,
            padding: "24px 28px 80px",
            maxWidth: 1680,
            width: "100%",
            margin: "0 auto",
            boxSizing: "border-box",
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{ width: "100%" }}
            >
              <Suspense
                fallback={
                  <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "20px 0" }}>
                    <Skeleton width="35%" height="32px" />
                    <Skeleton width="100%" height="180px" />
                    <Skeleton width="100%" height="320px" />
                  </div>
                }
              >
                {activeTab === "Dashboard" && (
                  <DashboardBento
                    dashboard={dashboard}
                    loading={loading}
                    error={error}
                    lastUpdated={lastUpdated}
                    onRefresh={loadDashboardData}
                    onNavigate={navigateTo}
                    onSelectStudent={handleSelectStudentForDrawer}
                    role={role}
                  />
                )}

                {activeTab === "Students" && (
                  <StudentsPage
                    role={role}
                    onSelectStudent={handleSelectStudentForDrawer}
                  />
                )}

                {activeTab === "Batches" && <BatchesPage role={role} />}

                {activeTab === "Attendance" && (
                  <AttendancePage key={userId} role={role} userId={userId} />
                )}

                {activeTab === "Fees" && (role === "owner" || role === "accounts") && (
                  <FeesPage role={role} userId={userId} />
                )}

                {activeTab === "Schedules" && <SchedulesPage role={role} />}

                {activeTab === "AI Copilot" && (
                  <CopilotWorkspace
                    key={userId}
                    role={role}
                    userId={userId}
                    initialPrompt={copilotInitialPrompt}
                  />
                )}

                {activeTab === "Reports" && (
                  <ReportsPage role={role} userId={userId} />
                )}

                {activeTab === "Settings" && (
                  <SettingsPage
                    role={role}
                    userId={userId}
                    userName={userName}
                    onRoleChange={changeRole}
                  />
                )}

                {activeTab === "UI System" && <UiDesignSystemPage />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Floating Copilot Orb FAB (lives on other pages, shrinks/expands with shared layoutId) */}
      {activeTab !== "AI Copilot" && (
        <motion.div
          className="floating-copilot-orb-fab"
          layoutId="copilot-orb-presence"
          onClick={() => {
            sound.shimmer();
            navigateTo("AI Copilot");
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={springs.layout}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-card-hover)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            zIndex: 45,
          }}
          title="Ask AI Copilot"
          aria-label="Open AI Copilot"
        >
          <Orb size={46} state="idle" />
        </motion.div>
      )}

      {/* Global Slide-In Student Drawer */}
      <StudentDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        student={drawerStudent}
        role={role}
      />

      {/* Global Command Palette (Cmd/Ctrl + K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={navigateTo}
        onCopilotPrompt={handleCopilotPrompt}
        role={role}
      />

      {/* Real-time FPS & Frame-time Overlay (Shift+F) */}
      <FpsMeter />

      {/* Keyboard Shortcuts Cheat-sheet Modal (?) */}
      <KeyboardShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {/* Spring Physics Toast Container */}
      <ToastContainer />
    </div>
  );
}
