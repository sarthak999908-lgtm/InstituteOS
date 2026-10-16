import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Command, X, Keyboard, Sparkles } from "lucide-react";
import GlassCard from "./GlassCard.jsx";
import { modalBackdrop, modalDialog } from "../../lib/motion.js";
import { sound } from "../../lib/sound.js";

const SHORTCUT_GROUPS = [
  {
    category: "Navigation",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Open Command Palette" },
      { keys: ["1", "-", "9"], description: "Quick switch workspace tabs" },
      { keys: ["?"], description: "Open this keyboard shortcuts modal" },
      { keys: ["Esc"], description: "Close any modal, drawer, or search" },
    ],
  },
  {
    category: "Copilot & Operations",
    shortcuts: [
      { keys: ["↵"], description: "Submit AI Copilot question" },
      { keys: ["Shift", "↵"], description: "Insert newline in prompt" },
      { keys: ["Hold", "700ms"], description: "Execute high-privilege action approval" },
      { keys: ["Click"], description: "Inspect constellation node in drawer" },
    ],
  },
  {
    category: "System & Developer",
    shortcuts: [
      { keys: ["Shift", "F"], description: "Toggle real-time FPS & memory monitor" },
      { keys: ["Tab"], description: "Navigate focusable interactive elements" },
      { keys: ["Space"], description: "Activate buttons and toggles" },
    ],
  },
];

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  useEffect(() => {
    if (isOpen) sound.shimmer();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 25000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts"
    >
      {/* Backdrop */}
      <motion.div
        variants={modalBackdrop}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(16px)",
        }}
      />

      {/* Modal Dialog */}
      <motion.div
        variants={modalDialog}
        initial="hidden"
        animate="visible"
        exit="exit"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 620,
          zIndex: 1,
        }}
      >
        <GlassCard style={{ padding: 24 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--accent-badge-bg)",
                  border: "1px solid var(--accent-primary)",
                  display: "grid",
                  placeItems: "center",
                  color: "var(--accent-primary)",
                }}
              >
                <Keyboard size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: "17px", color: "var(--text-primary)", margin: 0 }}>
                  Keyboard Shortcuts
                </h2>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Navigate and execute institute operations at lightspeed
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                width: 32,
                height: 32,
                display: "grid",
                placeItems: "center",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
              aria-label="Close shortcuts"
            >
              <X size={16} />
            </button>
          </div>

          {/* Groups */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18, maxHeight: "60vh", overflowY: "auto", paddingRight: 4 }}>
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.category}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--accent-primary)",
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  {group.category}
                </span>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    background: "var(--surface-2)",
                    borderRadius: "var(--radius-sm)",
                    padding: "8px 12px",
                    border: "1px solid var(--border)",
                  }}
                >
                  {group.shortcuts.map((sc) => (
                    <div
                      key={sc.description}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 0",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                        {sc.description}
                      </span>

                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {sc.keys.map((k, i) => (
                          <kbd
                            key={i}
                            style={{
                              background: "var(--surface)",
                              border: "1px solid var(--border)",
                              borderRadius: 4,
                              padding: "2px 7px",
                              fontSize: "11px",
                              fontFamily: "'JetBrains Mono', monospace",
                              fontWeight: 600,
                              color: "var(--text-primary)",
                              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)",
                            }}
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div
            style={{
              marginTop: 18,
              paddingTop: 12,
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "11px",
              color: "var(--text-muted)",
            }}
          >
            <span>Tip: Press <kbd style={{ padding: "1px 4px", background: "var(--surface-2)", borderRadius: 3 }}>?</kbd> anytime to toggle</span>
            <span style={{ color: "var(--accent-primary)", fontWeight: 600 }}>InstituteOS Pro Controls</span>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
