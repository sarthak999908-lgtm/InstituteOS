import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Laptop } from "lucide-react";
import { useTheme } from "../../app/providers.jsx";
import { sound } from "../../lib/sound.js";

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isDark = resolvedTheme === "dark";

  const handleQuickToggle = (e) => {
    sound.tick();
    const next = isDark ? "light" : "dark";
    setTheme(next, e);
  };

  const handleSelectOption = (opt, e) => {
    sound.tick();
    setTheme(opt, e);
    setDropdownOpen(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={handleQuickToggle}
        onContextMenu={(e) => {
          e.preventDefault();
          setDropdownOpen((prev) => !prev);
        }}
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          width: 36,
          height: 36,
          display: "grid",
          placeItems: "center",
          color: "var(--text-primary)",
          cursor: "pointer",
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)",
          transition: "background 0.2s, border-color 0.2s",
        }}
        title={`Current: ${theme.toUpperCase()} (Click to toggle Light/Dark)`}
        aria-label="Toggle theme"
      >
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.span
              key="moon"
              initial={{ rotate: -90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: "grid", placeItems: "center", color: "#60A5FA" }}
            >
              <Moon size={16} />
            </motion.span>
          ) : (
            <motion.span
              key="sun"
              initial={{ rotate: 90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: -90, scale: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: "grid", placeItems: "center", color: "#F59E0B" }}
            >
              <Sun size={17} />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Right-click or dropdown choices */}
      <AnimatePresence>
        {dropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute",
              top: 44,
              right: 0,
              width: 130,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              boxShadow: "var(--shadow-popover)",
              padding: 4,
              zIndex: 100,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {[
              { id: "light", label: "Light", icon: Sun },
              { id: "dark", label: "Dark", icon: Moon },
              { id: "system", label: "System", icon: Laptop },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={(e) => handleSelectOption(id, e)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  border: "none",
                  borderRadius: 6,
                  background: theme === id ? "var(--accent-badge-bg)" : "transparent",
                  color: theme === id ? "var(--accent-primary)" : "var(--text-secondary)",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
