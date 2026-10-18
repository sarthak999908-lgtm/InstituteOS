import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Search, RefreshCw, Volume2, VolumeX, Menu, ChevronRight,
  Wifi, WifiOff, Sparkles, ShieldCheck
} from "lucide-react";
import { sound } from "../../lib/sound.js";
import { toast } from "../common/Toast.jsx";
import ThemeToggle from "../common/ThemeToggle.jsx";
import AccentPicker from "../common/AccentPicker.jsx";

const ROLE_COLORS = {
  owner: { bg: "rgba(37, 99, 235, 0.12)", text: "#2563EB", border: "rgba(37, 99, 235, 0.25)" },
  counselor: { bg: "rgba(13, 148, 136, 0.12)", text: "#0D9488", border: "rgba(13, 148, 136, 0.25)" },
  trainer: { bg: "rgba(22, 163, 74, 0.12)", text: "#16A34A", border: "rgba(22, 163, 74, 0.25)" },
  accounts: { bg: "rgba(249, 115, 22, 0.12)", text: "#EA580C", border: "rgba(249, 115, 22, 0.25)" },
};

export default function Topbar({
  activeTab,
  onNavigate,
  onOpenCommandPalette,
  onRefresh,
  loading = false,
  error = "",
  dashboard,
  role = "owner",
  onRoleChange,
  onOpenMobileMenu,
}) {
  const [soundEnabled, setSoundEnabled] = useState(() => sound.isEnabled());
  const [notifOpen, setNotifOpen] = useState(false);
  const [hasNewAlerts, setHasNewAlerts] = useState(true);
  const [roleRipple, setRoleRipple] = useState(false);

  const toggleSound = () => {
    const next = !soundEnabled;
    sound.setEnabled(next);
    setSoundEnabled(next);
    if (next) sound.shimmer();
  };

  const handleRoleChangeInternal = (nextRole) => {
    sound.shimmer();
    setRoleRipple(true);
    setTimeout(() => setRoleRipple(false), 800);

    onRoleChange(nextRole);

    const roleAccessNotes = {
      owner: "Full institute access: operational governance, financial oversight & copilot approval authority.",
      counselor: "Admissions view: student onboarding, batch summaries & contact inquiry logs.",
      trainer: "Academic view: assigned timetables & attendance registers; financial data hidden.",
      accounts: "Financial view: fee instalments, statement reconciliation & payment matching.",
    };

    toast.info(`Switched role to ${nextRole.toUpperCase()}`, roleAccessNotes[nextRole] || "");
  };

  const roleStyle = ROLE_COLORS[role] || ROLE_COLORS.owner;

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        height: 60,
        background: "var(--surface-frosted)",
        backdropFilter: "blur(16px) saturate(140%)",
        WebkitBackdropFilter: "blur(16px) saturate(140%)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "0 22px",
        zIndex: 40,
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
      }}
    >
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="mobile-menu-trigger"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            padding: 4,
            display: "none",
          }}
          aria-label="Open sidebar"
        >
          <Menu size={19} />
        </button>

        {/* Breadcrumb with animated separator */}
        <nav
          aria-label="Breadcrumb"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: "13px",
            fontFamily: "'Inter', sans-serif",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Workspace</span>
          <motion.span
            animate={{ x: [0, 2, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            style={{ color: "var(--accent-primary)", display: "grid", placeItems: "center" }}
          >
            <ChevronRight size={14} />
          </motion.span>
          <motion.strong
            key={activeTab}
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ color: "var(--text-primary)", fontWeight: 600, letterSpacing: "-0.01em" }}
          >
            {activeTab}
          </motion.strong>
        </nav>
      </div>

      {/* Center: Clean Command Palette Search Bar */}
      <div
        className="topbar-search-container"
        style={{
          flex: 1,
          maxWidth: 460,
          minWidth: 160,
          margin: "0 12px",
        }}
      >
        <button
          type="button"
          onClick={onOpenCommandPalette}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "7px 14px",
            color: "var(--text-secondary)",
            fontSize: "12px",
            cursor: "pointer",
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
            transition: "all 0.2s ease",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--border-hover)";
            e.currentTarget.style.background = "var(--surface-2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.background = "var(--surface)";
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, overflow: "hidden" }}>
            <Search size={14} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Search commands, students, batches...
            </span>
          </div>
          <kbd
            style={{
              flexShrink: 0,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "1px 5px",
              fontSize: "10px",
              fontFamily: "'JetBrains Mono', monospace",
              color: "var(--text-muted)",
            }}
          >
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Controls: Only Essential Items */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {/* Theme Toggle (Light / Dark) */}
        <ThemeToggle />

        {/* Notification Bell with Wiggle */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => {
              sound.tick();
              setNotifOpen((prev) => !prev);
              setHasNewAlerts(false);
            }}
            style={{
              background: notifOpen ? "var(--accent-badge-bg)" : "var(--surface-2)",
              border: `1px solid ${notifOpen ? "var(--accent-primary)" : "var(--border)"}`,
              borderRadius: "var(--radius-sm)",
              width: 34,
              height: 34,
              display: "grid",
              placeItems: "center",
              color: notifOpen ? "var(--accent-primary)" : "var(--text-secondary)",
              cursor: "pointer",
              position: "relative",
            }}
            aria-label="Open notifications"
          >
            <motion.span
              animate={hasNewAlerts ? { rotate: [0, -14, 14, -10, 10, 0] } : {}}
              transition={{ repeat: Infinity, repeatDelay: 6, duration: 0.6 }}
            >
              <Bell size={15} />
            </motion.span>
            {hasNewAlerts && (
              <span
                style={{
                  position: "absolute",
                  top: 7,
                  right: 7,
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--danger)",
                }}
              />
            )}
          </button>

          {/* Stacked Notifications Popover */}
          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.96 }}
                transition={{ duration: 0.18 }}
                style={{
                  position: "absolute",
                  top: 42,
                  right: 0,
                  width: 320,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-popover)",
                  padding: 14,
                  zIndex: 100,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>Activity Radar</span>
                  <span style={{ fontSize: "10px", color: "var(--accent-primary)", fontWeight: 600 }}>3 updates</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ padding: "8px 10px", background: "var(--surface-2)", borderRadius: 6, borderLeft: "3px solid var(--warning)" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-primary)", fontWeight: 600 }}>EMI Overdue Alert</div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>2 learners have pending instalments due this week.</div>
                  </div>
                  <div style={{ padding: "8px 10px", background: "var(--surface-2)", borderRadius: 6, borderLeft: "3px solid var(--accent-primary)" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-primary)", fontWeight: 600 }}>Timetable Solved</div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Weekly clash-free room schedule is ready.</div>
                  </div>
                  <div style={{ padding: "8px 10px", background: "var(--surface-2)", borderRadius: 6, borderLeft: "3px solid var(--success)" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-primary)", fontWeight: 600 }}>Copilot Ready</div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Role-scoped SQLite policy engine verified.</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Role Switcher Pill with Avatar Ring Ripple */}
        <div style={{ position: "relative" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: roleStyle.bg,
              border: `1px solid ${roleStyle.border}`,
              borderRadius: "var(--radius-sm)",
              padding: "4px 8px 4px 10px",
              cursor: "pointer",
            }}
          >
            {roleRipple && (
              <span
                style={{
                  position: "absolute",
                  inset: -4,
                  borderRadius: "inherit",
                  border: `2px solid ${roleStyle.text}`,
                  animation: "ripple-anim 0.6s cubic-bezier(0, 0.2, 0.8, 1) forwards",
                  pointerEvents: "none",
                }}
              />
            )}
            <ShieldCheck size={13} color={roleStyle.text} />
            <select
              value={role}
              onChange={(e) => handleRoleChangeInternal(e.target.value)}
              aria-label="Switch demo role"
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: roleStyle.text,
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "capitalize",
                cursor: "pointer",
              }}
            >
              <option value="owner" style={{ background: "var(--surface)", color: "var(--text-primary)" }}>Owner</option>
              <option value="counselor" style={{ background: "var(--surface)", color: "var(--text-primary)" }}>Counselor</option>
              <option value="trainer" style={{ background: "var(--surface)", color: "var(--text-primary)" }}>Trainer</option>
              <option value="accounts" style={{ background: "var(--surface)", color: "var(--text-primary)" }}>Accounts</option>
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}
