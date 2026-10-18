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
  getSession,
  getAuthenticatedInstituteContext,
  clearLocalAuthState,
  supabaseConfigStatus,
} from "./services/supabase.js";
import { getSessionRefreshErrorMessage } from "./features/auth/authErrors.js";
import { appHrefWithoutLocalDemo, localDemoMode, localDemoUser } from "./lib/localDemo.js";
import {
  AuthResolvingScreen,
  MembershipCheckErrorScreen,
  SupabaseConfigurationScreen,
  UnlinkedInstituteScreen,
} from "./features/auth/AuthStateScreens.jsx";


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

export default function App() {
  const { role, userId, userName, setRole, clearSession } = useSessionStore();
  const { calmMode } = useTheme();
  const prefersReducedMotion = useReducedMotion();

  const [signedIn, setSignedIn] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [membershipError, setMembershipError] = useState(false);
  const [unlinkedAccount, setUnlinkedAccount] = useState(null);
  const [authNotice, setAuthNotice] = useState("");
  const authAttemptRef = useRef(0);
  const authorizedSessionRef = useRef(false);
  const signOutInProgressRef = useRef(false);
  const signedInRef = useRef(signedIn);
  signedInRef.current = signedIn;

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

  const [bootCompleted, setBootCompleted] = useState(false);

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

  const verifySessionMembership = useCallback(async (session) => {
    const attempt = ++authAttemptRef.current;
    if (!session?.user) {
      authorizedSessionRef.current = false;
      setSignedIn(false);
      setUnlinkedAccount(null);
      setMembershipLoading(false);
      setAuthResolved(true);
      return null;
    }

    setMembershipLoading(true);
    setMembershipError(false);
    setAuthNotice("");
    try {
      const context = await getAuthenticatedInstituteContext();
      if (attempt !== authAttemptRef.current) return null;
      if (!context?.role || !context?.user_id || !context?.institute_id) {
        authorizedSessionRef.current = false;
        clearSession();
        setSignedIn(false);
        setUnlinkedAccount({ email: session.user.email || "", userId: session.user.id || "" });
        return null;
      }
      authorizedSessionRef.current = true;
      setUnlinkedAccount(null);
      setRole(context.role, { ...session.user, instituteUserId: context.user_id });
      setSignedIn(true);
      return context;
    } catch {
      if (attempt !== authAttemptRef.current) return null;
      authorizedSessionRef.current = false;
      clearSession();
      setSignedIn(false);
      setUnlinkedAccount(null);
      setMembershipError(true);
      return null;
    } finally {
      if (attempt === authAttemptRef.current) {
        setMembershipLoading(false);
        setAuthResolved(true);
      }
    }
  }, [clearSession, setRole]);

  // ── Auth session restore and expiry handling ────────────────────────────────
  useEffect(() => {
    let active = true;
    if (localDemoMode) {
      authorizedSessionRef.current = false;
      clearSession();
      setRole("owner", localDemoUser);
      setSignedIn(true);
      setAuthResolved(true);
      setMembershipLoading(false);
      return () => { active = false; };
    }

    getSession()
      .then((session) => {
        if (!active) return;
        if (session?.user) void verifySessionMembership(session);
        else {
          setSignedIn(false);
          setAuthResolved(true);
        }
      })
      .catch(() => {
        if (!active) return;
        clearSession();
        setSignedIn(false);
        setAuthNotice(getSessionRefreshErrorMessage());
        setAuthResolved(true);
      });

    if (!supabaseEnabled) return () => { active = false; };

    const unsub = onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" && session?.user) {
        authorizedSessionRef.current = authorizedSessionRef.current || signedInRef.current;
      }
      if ((event === "TOKEN_REFRESHED" && !session) || event === "SIGNED_OUT") {
        const unexpectedSignOut = authorizedSessionRef.current && !signOutInProgressRef.current;
        authorizedSessionRef.current = false;
        authAttemptRef.current += 1;
        clearSession();
        setSignedIn(false);
        setUnlinkedAccount(null);
        setMembershipError(false);
        setMembershipLoading(false);
        setAuthResolved(true);
        setActiveTab("Dashboard");
        setAuthNotice(unexpectedSignOut ? "Your session expired. Please sign in again." : "");
        void clearLocalAuthState();
      }
    });

    return () => {
      active = false;
      unsub();
    };
  }, [clearLocalAuthState, clearSession, setRole, verifySessionMembership]);


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
      console.warn("Live dashboard request failed.", err);
      setDashboard(null);
      setError("Dashboard data is unavailable. Retry when the backend connection is restored.");
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
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      }
    }
  };

  const changeRole = (nextRole, user = null) => {
    // The role is accepted only alongside the authenticated Supabase user.
    // Local role switching in the settings UI is not an authorization source.
    if (!user) return;
    if (!["owner", "counselor", "trainer", "accounts"].includes(nextRole)) return;
    setRole(nextRole, user);
  };

  const handleCopilotPrompt = (prompt) => {
    setCopilotInitialPrompt(prompt);
    setActiveTab("AI Copilot");
  };

  const handleSelectStudentForDrawer = (student) => {
    setDrawerStudent(student);
    setDrawerOpen(true);
  };

  const signIn = (user, authorizedRole, context) => {
    if (!user || !context?.user_id || !["owner", "counselor", "trainer", "accounts"].includes(authorizedRole)) {
      setSignedIn(false);
      return;
    }
    authAttemptRef.current += 1;
    authorizedSessionRef.current = true;
    setAuthNotice("");
    setMembershipError(false);
    setUnlinkedAccount(null);
    setRole(authorizedRole, { ...user, instituteUserId: context.user_id });
    setSignedIn(true);
    toast.success("Welcome back!", `Signed in as ${user?.user_metadata?.name || user?.email || "user"} (${authorizedRole.toUpperCase()})`);
  };

  const showUnlinkedAccount = (account) => {
    authAttemptRef.current += 1;
    authorizedSessionRef.current = false;
    clearSession();
    setSignedIn(false);
    setMembershipError(false);
    setMembershipLoading(false);
    setAuthResolved(true);
    setAuthNotice("");
    setUnlinkedAccount({ email: account?.email || "", userId: account?.userId || "" });
  };

  const retryMembershipCheck = async () => {
    setMembershipError(false);
    setMembershipLoading(true);
    try {
      const session = await getSession();
      if (!session?.user) {
        setMembershipLoading(false);
        setMembershipError(true);
        return;
      }
      await verifySessionMembership(session);
    } catch {
      setMembershipLoading(false);
      setMembershipError(true);
    }
  };

  const signOut = async () => {
    if (localDemoMode) {
      window.location.assign(appHrefWithoutLocalDemo());
      return;
    }
    signOutInProgressRef.current = true;
    authorizedSessionRef.current = false;
    authAttemptRef.current += 1;
    try {
      await supabaseSignOut();
    } finally {
      signOutInProgressRef.current = false;
      clearSession();
      setSignedIn(false);
      setUnlinkedAccount(null);
      setMembershipError(false);
      setMembershipLoading(false);
      setAuthResolved(true);
      setAuthNotice("");
      setActiveTab("Dashboard");
    }
  };


  if (!supabaseConfigStatus.configured && !localDemoMode) {
    return <SupabaseConfigurationScreen variables={supabaseConfigStatus.issues} />;
  }

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

  if (!authResolved || (membershipLoading && !signedIn)) {
    return <AuthResolvingScreen message="Checking your sign-in and institute access…" />;
  }

  if (unlinkedAccount) {
    return <UnlinkedInstituteScreen email={unlinkedAccount.email} userId={unlinkedAccount.userId} onSignOut={signOut} />;
  }

  if (membershipError && !signedIn) {
    return <MembershipCheckErrorScreen onRetry={retryMembershipCheck} onSignOut={signOut} />;
  }

  // 2. Authentication View (4 3D-tilting glass cards)
  if (!signedIn) {
    return (
      <LoginPage
        role={role}
        onRoleChange={changeRole}
        onLogin={signIn}
        onUnlinkedAccount={showUnlinkedAccount}
        authNotice={authNotice}
      />
    );
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
          onNavigate={navigateTo}
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
                    localDemoMode={localDemoMode}
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
