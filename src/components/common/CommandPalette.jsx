import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, LayoutDashboard, Users, BookOpen, ClipboardCheck, Wallet,
  CalendarDays, Bot, FileText, Settings, Sparkles, ArrowRight, CornerDownLeft
} from "lucide-react";
import { modalBackdrop, modalDialog } from "../../lib/motion.js";
import { sound } from "../../lib/sound.js";
import { INITIAL_STUDENTS } from "../../data.js";
import { batches } from "../../data/mockData.js";

export default function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  onCopilotPrompt,
  role = "owner",
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  // Focus on open
  useEffect(() => {
    if (isOpen) {
      sound.shimmer();
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (isOpen) onClose();
        else window.dispatchEvent(new CustomEvent("open-command-palette"));
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Build searchable items
  const allItems = useMemo(() => {
    const pages = [
      { id: "p-dash", type: "page", title: "Dashboard", category: "Workspace", icon: LayoutDashboard, tab: "Dashboard", description: "Institute overview, live metrics and bento operational view" },
      { id: "p-stu", type: "page", title: "Students", category: "Workspace", icon: Users, tab: "Students", description: "Enrolled learners, contact profiles and status directory" },
      { id: "p-bat", type: "page", title: "Batches", category: "Workspace", icon: BookOpen, tab: "Batches", description: "Active cohorts, room allocations and trainer assignments" },
      { id: "p-att", type: "page", title: "Attendance", category: "Workspace", icon: ClipboardCheck, tab: "Attendance", description: "Daily marked registers, classroom & online mode monitoring" },
      ...(role !== "trainer" && role !== "counselor" ? [{ id: "p-fee", type: "page", title: "Fees", category: "Workspace", icon: Wallet, tab: "Fees", description: "Instalment collection, overdue balances and bank statement reconciliation" }] : []),
      { id: "p-sch", type: "page", title: "Schedules", category: "Workspace", icon: CalendarDays, tab: "Schedules", description: "Constraint-based weekly solver, rooms and clash-free timetable" },
      { id: "p-cop", type: "page", title: "AI Copilot", category: "Copilot", icon: Bot, tab: "AI Copilot", description: "Operations intelligence, SQL generator and approval ceremonies" },
      { id: "p-rep", type: "page", title: "Reports", category: "Admin", icon: FileText, tab: "Reports", description: "Attendance risk tracking and verifiable graduation certificates" },
      ...(role === "owner" ? [{ id: "p-set", type: "page", title: "Settings", category: "Admin", icon: Settings, tab: "Settings", description: "Audit trail, theme customization, calm mode and demo roles" }] : []),
      { id: "p-ui", type: "page", title: "UI Design System (/ui)", category: "Design", icon: Sparkles, tab: "UI System", description: "Cosmic Aurora component catalog, glass tokens and interactive states" },
    ];

    const copilotActions = [
      { id: "c-1", type: "copilot", title: "Ask: who is overdue this week?", category: "AI Actions", icon: Sparkles, prompt: "Which students have overdue fee instalments this week?", description: "Copilot will query instalments and draft WhatsApp follow-up reminders" },
      { id: "c-2", type: "copilot", title: "Ask: who is absent today?", category: "AI Actions", icon: Sparkles, prompt: "Who is absent today?", description: "Inspects daily registers and highlights attendance risk alerts" },
      { id: "c-3", type: "copilot", title: "Ask: show overdue EMIs", category: "AI Actions", icon: Sparkles, prompt: "Show overdue EMIs", description: "Lists all overdue payments across courses with fee breakdown" },
      { id: "c-4", type: "copilot", title: "Ask: which batches have highest fill rate?", category: "AI Actions", icon: Sparkles, prompt: "Which batches have the highest fill rate?", description: "Computes enrolled learners vs room capacity limits" },
    ];

    const studentItems = INITIAL_STUDENTS.slice(0, 10).map((s) => ({
      id: `s-${s.id}`,
      type: "student",
      title: s.name,
      subtitle: `${s.id} · ${s.course}`,
      category: "Students",
      icon: Users,
      data: s,
      description: `Course: ${s.course} · Batch: ${s.batch || "Morning"} · Status: ${s.status}`,
    }));

    const batchItems = batches.slice(0, 6).map((b) => ({
      id: `b-${b.id}`,
      type: "batch",
      title: b.name,
      subtitle: `${b.course_name} (${b.student_count} learners)`,
      category: "Batches",
      icon: BookOpen,
      data: b,
      description: `Trainer: ${b.trainer_name} · Schedule: ${b.slot_days} ${b.slot_start}-${b.slot_end}`,
    }));

    return [...pages, ...copilotActions, ...studentItems, ...batchItems];
  }, [role]);

  // Fuzzy filter
  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems.slice(0, 14);
    const q = query.toLowerCase().trim();
    return allItems
      .filter((item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q))
      )
      .slice(0, 16);
  }, [query, allItems]);

  const activeItem = filteredItems[selectedIndex] || filteredItems[0];

  const handleSelect = (item) => {
    if (!item) return;
    sound.tick(1400);
    if (item.type === "page") {
      onNavigate(item.tab);
    } else if (item.type === "copilot") {
      onCopilotPrompt(item.prompt);
    } else if (item.type === "student") {
      onNavigate("Students");
    } else if (item.type === "batch") {
      onNavigate("Batches");
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
      sound.tick(800, 0.015);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
      sound.tick(800, 0.015);
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(activeItem);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 20000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Blurred Backdrop */}
      <motion.div
        variants={modalBackdrop}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(5, 6, 15, 0.75)",
          backdropFilter: "blur(20px) saturate(140%)",
        }}
      />

      {/* Centred Glass Panel */}
      <motion.div
        variants={modalDialog}
        initial="hidden"
        animate="visible"
        exit="exit"
        style={{
          position: "relative",
          width: "92%",
          maxWidth: 780,
          background: "var(--surface)",
          backdropFilter: "blur(32px) saturate(160%)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-popover)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          zIndex: 1,
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            gap: 14,
          }}
        >
          <Search size={20} color="var(--accent-primary)" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, page name, student, or Copilot question..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: "15px",
              fontFamily: "'Inter', sans-serif",
            }}
          />
          <kbd
            style={{
              fontSize: "11px",
              fontFamily: "'JetBrains Mono', monospace",
              color: "var(--text-muted)",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "2px 6px",
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Dual Pane: Results + Live Preview */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", minHeight: 380, maxHeight: 460 }}>
          {/* Results List */}
          <div
            style={{
              overflowY: "auto",
              padding: "10px",
              borderRight: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "9px 12px",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    background: isSelected
                      ? "var(--accent-badge-bg)"
                      : "transparent",
                    border: isSelected ? "1px solid var(--accent-primary)" : "1px solid transparent",
                    transition: "background 0.1s ease",
                  }}
                >
                  <span
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: isSelected ? "var(--brand-gradient)" : "var(--surface-2)",
                      color: isSelected ? "#ffffff" : "var(--text-secondary)",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={15} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: isSelected ? 600 : 500,
                          color: isSelected ? "var(--accent-primary)" : "var(--text-primary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.title}
                      </span>
                    </div>
                    {item.subtitle && (
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        {item.subtitle}
                      </span>
                    )}
                  </div>
                  {isSelected && <CornerDownLeft size={13} color="var(--accent-primary)" />}
                </div>
              );
            })}
            {filteredItems.length === 0 && (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                No results found for "{query}"
              </div>
            )}
          </div>

          {/* Live Preview Pane */}
          <div
            style={{
              padding: 24,
              display: "flex",
              flexDirection: "column",
              background: "var(--surface-2)",
            }}
          >
            {activeItem ? (
              <div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: "var(--accent-primary)",
                    display: "block",
                    marginBottom: 10,
                  }}
                >
                  {activeItem.category} PREVIEW
                </span>
                <h3
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: "18px",
                    color: "var(--text-primary)",
                    marginBottom: 8,
                  }}
                >
                  {activeItem.title}
                </h3>
                <p
                  style={{
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                    marginBottom: 16,
                  }}
                >
                  {activeItem.description}
                </p>

                <div
                  style={{
                    marginTop: 20,
                    padding: 12,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: "12px",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <ArrowRight size={14} color="var(--accent-primary)" />
                  <span>Press <strong style={{ color: "var(--text-primary)" }}>Enter</strong> to execute action</span>
                </div>
              </div>
            ) : (
              <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                Select an item to view live details
              </div>
            )}
          </div>
        </div>

        {/* Footer keyboard hints */}
        <div
          style={{
            padding: "10px 20px",
            borderTop: "1px solid var(--border)",
            background: "var(--surface-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "11px",
            color: "var(--text-muted)",
          }}
        >
          <div style={{ display: "flex", gap: 14 }}>
            <span><strong style={{ color: "var(--text-primary)" }}>↑↓</strong> to navigate</span>
            <span><strong style={{ color: "var(--text-primary)" }}>↵</strong> to select</span>
            <span><strong style={{ color: "var(--text-primary)" }}>esc</strong> to close</span>
          </div>
          <span style={{ color: "var(--accent-primary)", fontWeight: 600 }}>InstituteOS Navigation</span>
        </div>
      </motion.div>
    </div>
  );
}
