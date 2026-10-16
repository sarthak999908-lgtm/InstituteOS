import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, BookOpen, ClipboardCheck, Wallet,
  CalendarDays, Bot, FileText, Settings, Sparkles, GraduationCap, X
} from "lucide-react";
import { springs } from "../../lib/motion.js";
import { sound } from "../../lib/sound.js";
import Orb from "../common/Orb.jsx";

export const ALL_MENU_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Students", icon: Users },
  { label: "Batches", icon: BookOpen },
  { label: "Attendance", icon: ClipboardCheck },
  { label: "Fees", icon: Wallet },
  { label: "Schedules", icon: CalendarDays },
  { label: "AI Copilot", icon: Bot, isAi: true },
  { label: "Reports", icon: FileText },
  { label: "Settings", icon: Settings },
  { label: "UI System", icon: Sparkles },
];

export default function Sidebar({
  activeTab,
  onNavigate,
  role = "owner",
  userName = "Admin",
  isOpenMobile = false,
  onCloseMobile,
}) {
  const [isHovered, setIsHovered] = useState(false);

  // Filter items by role permissions
  const visibleItems = ALL_MENU_ITEMS.filter(({ label }) => {
    if ((role === "trainer" || role === "counselor") && label === "Fees") return false;
    if ((role === "trainer" || role === "counselor") && label === "Settings") return false;
    return true;
  });

  const isExpanded = isHovered || isOpenMobile;

  const handleItemClick = (label) => {
    sound.tick(1100);
    onNavigate(label);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(8px)",
            zIndex: 49,
          }}
          aria-hidden="true"
        />
      )}

      {/* Desktop & Tablet Sidebar */}
      <motion.aside
        className={`cosmic-sidebar ${isOpenMobile ? "mobile-open" : ""}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        initial={false}
        animate={{
          width: isExpanded ? 230 : 72,
        }}
        transition={springs.layout}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          boxShadow: "1px 0 3px rgba(15, 23, 42, 0.04)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          padding: "18px 10px",
          overflowX: "hidden",
          userSelect: "none",
          transition: "background 0.25s ease, border-color 0.25s ease",
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 8px 20px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "var(--radius-sm)",
              background: "var(--brand-gradient)",
              boxShadow: "0 4px 12px var(--brand-glow)",
              display: "grid",
              placeItems: "center",
              color: "#ffffff",
              flexShrink: 0,
            }}
          >
            <GraduationCap size={20} />
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                style={{ overflow: "hidden", whiteSpace: "nowrap" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 700,
                      fontSize: "15px",
                      color: "var(--text-primary)",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    InstituteOS
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    color: "var(--accent-primary)",
                    textTransform: "uppercase",
                  }}
                >
                  TechSummitTrainers
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isOpenMobile && (
            <button
              onClick={onCloseMobile}
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Section Label */}
        <div style={{ height: 26, display: "flex", alignItems: "center", padding: "8px 10px 0" }}>
          {isExpanded && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
                textTransform: "uppercase",
              }}
            >
              Workspace
            </span>
          )}
        </div>

        {/* Navigation Items */}
        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 3,
            marginTop: 4,
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {visibleItems.map(({ label, icon: Icon, isAi }) => {
            const isActive = activeTab === label;
            return (
              <button
                key={label}
                type="button"
                onClick={() => handleItemClick(label)}
                title={!isExpanded ? label : undefined}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  height: 40,
                  padding: "0 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: "transparent",
                  color: isActive ? "var(--accent-primary)" : "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: isActive ? 600 : 500,
                  fontFamily: "'Inter', sans-serif",
                  transition: "color 0.15s ease",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                {/* Active Sliding Pill in Tinted Accent */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-pill"
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "inherit",
                      background: "var(--accent-badge-bg)",
                      border: "1px solid var(--accent-primary)",
                      boxShadow: "0 1px 3px rgba(37, 99, 235, 0.08)",
                      zIndex: 1,
                    }}
                    transition={springs.layout}
                  />
                )}

                <span
                  style={{
                    position: "relative",
                    zIndex: 2,
                    display: "grid",
                    placeItems: "center",
                    color: isActive ? "var(--accent-primary)" : "inherit",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} />
                </span>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        position: "relative",
                        zIndex: 2,
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {isExpanded && isAi && (
                  <span
                    style={{
                      position: "relative",
                      zIndex: 2,
                      marginLeft: "auto",
                      background: "var(--brand-gradient)",
                      color: "#ffffff",
                      fontSize: "9px",
                      fontWeight: 800,
                      padding: "1px 5px",
                      borderRadius: 4,
                    }}
                  >
                    AI
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom User Chip & Sponsor Badge */}
        <div
          style={{
            marginTop: "auto",
            paddingTop: 12,
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              position: "relative",
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              display: "grid",
              placeItems: "center",
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--text-primary)",
              flexShrink: 0,
            }}
          >
            {userName
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")}
            {/* Live Status Dot */}
            <span
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--success)",
                border: "2px solid var(--surface)",
              }}
            />
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ overflow: "hidden", whiteSpace: "nowrap" }}
              >
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                  {userName}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--accent-primary)",
                      textTransform: "capitalize",
                      fontWeight: 600,
                    }}
                  >
                    {role}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>

      {/* Floating Bottom Dock on Mobile / Small Screens */}
      <div className="mobile-bottom-dock" aria-label="Mobile navigation dock">
        {visibleItems.slice(0, 2).map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            className={`dock-btn ${activeTab === label ? "active" : ""}`}
            onClick={() => handleItemClick(label)}
          >
            <Icon size={19} />
            <span>{label}</span>
          </button>
        ))}

        {/* Center Copilot Orb Button */}
        <div className="dock-orb-wrapper" onClick={() => handleItemClick("AI Copilot")}>
          <Orb size={44} state={activeTab === "AI Copilot" ? "listening" : "idle"} layoutId="mobile-dock-orb" />
        </div>

        {visibleItems.slice(2, 4).map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            className={`dock-btn ${activeTab === label ? "active" : ""}`}
            onClick={() => handleItemClick(label)}
          >
            <Icon size={19} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
