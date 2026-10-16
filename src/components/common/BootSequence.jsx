import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap } from "lucide-react";
import { sound } from "../../lib/sound.js";

export default function BootSequence({ onComplete }) {
  const [step, setStep] = useState(0);
  const [statusLineIndex, setStatusLineIndex] = useState(0);

  const statusLines = [
    "Syncing batches...",
    "Verifying roles...",
    "Copilot online.",
  ];

  const sponsorText = "TechSummitTrainers";

  useEffect(() => {
    sound.shimmer();

    // 1.6s total intro duration
    const t1 = setTimeout(() => setStep(1), 400);
    const t2 = setTimeout(() => {
      setStep(2);
      setStatusLineIndex(1);
    }, 750);
    const t3 = setTimeout(() => setStatusLineIndex(2), 1150);
    const t4 = setTimeout(() => {
      sound.chime();
      onComplete();
    }, 1600);

    const handleKeyDown = (e) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
        onComplete();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02, filter: "blur(8px)" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "relative", zIndex: 2, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Animated Drawing Logo Mark */}
        <div style={{ position: "relative", width: 80, height: 80, marginBottom: 20 }}>
          {/* Pulsing ring */}
          <motion.div
            animate={{ scale: [1, 1.35, 1.7], opacity: [0.7, 0.25, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
            style={{
              position: "absolute",
              inset: -6,
              borderRadius: "50%",
              border: "2px solid var(--accent-primary)",
              pointerEvents: "none",
            }}
          />

          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <motion.polygon
              points="40,4 74,22 74,58 40,76 6,58 6,22"
              stroke="var(--accent-primary)"
              strokeWidth="2.5"
              fill="var(--accent-badge-bg)"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>

          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
            }}
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.35 }}
            >
              <GraduationCap size={36} color="var(--accent-primary)" />
            </motion.div>
          </div>
        </div>

        {/* Text "TechSummitTrainers" reveals letter by letter */}
        <div style={{ display: "flex", gap: 1, marginBottom: 10, height: 24, alignItems: "center" }}>
          {sponsorText.split("").map((char, idx) => (
            <motion.span
              key={idx}
              initial={{ opacity: 0, y: 5 }}
              animate={step >= 1 ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.025 * idx, duration: 0.2 }}
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "var(--accent-primary)",
              }}
            >
              {char}
            </motion.span>
          ))}
        </div>

        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "26px",
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.03em",
            marginBottom: 14,
          }}
        >
          InstituteOS
        </h1>

        {/* Typing status lines */}
        <div
          style={{
            height: 22,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "12px",
            color: "var(--text-secondary)",
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--accent-secondary)",
              boxShadow: "0 0 6px var(--accent-secondary)",
            }}
          />
          <AnimatePresence mode="wait">
            <motion.span
              key={statusLineIndex}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.12 }}
            >
              {statusLines[statusLineIndex]}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      <button
        type="button"
        onClick={onComplete}
        style={{
          position: "absolute",
          bottom: 28,
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 20,
          padding: "5px 14px",
          color: "var(--text-muted)",
          fontSize: "11px",
          fontFamily: "'Inter', sans-serif",
          cursor: "pointer",
        }}
      >
        Press ESC to skip intro
      </button>
    </motion.div>
  );
}
