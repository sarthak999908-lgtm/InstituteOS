import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Sparkles, Volume2 } from "lucide-react";
import { sound } from "../../lib/sound.js";

export default function BootSequence({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [soundPlayed, setSoundPlayed] = useState(false);
  const hasTriggeredAudio = useRef(false);

  const statusMessages = [
    "INITIALIZING NEURAL REGISTRY...",
    "CALIBRATING ACADEMIC MATRIX...",
    "SYSTEMS SYNCHRONIZED · ACCESS GRANTED",
  ];

  const triggerAudio = () => {
    if (!hasTriggeredAudio.current) {
      hasTriggeredAudio.current = true;
      sound.playIconicStartup();
      setSoundPlayed(true);
    }
  };

  useEffect(() => {
    // Attempt automatic playback of the iconic 2s chime
    triggerAudio();

    // Attach one-time pointer listener to unlock audio if browser requires user interaction
    const unlockAudio = () => triggerAudio();
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });

    // Status progression
    const s1 = setTimeout(() => setStatusIndex(1), 700);
    const s2 = setTimeout(() => setStatusIndex(2), 1400);

    // Progress bar ramp (0 to 100 over ~1.9s)
    const startTime = Date.now();
    const duration = 1950;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);
      if (pct >= 100) clearInterval(interval);
    }, 25);

    // Sequence completion at 2.15s
    const doneTimer = setTimeout(() => {
      onComplete();
    }, 2150);

    const handleKeyDown = (e) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        clearInterval(interval);
        clearTimeout(s1);
        clearTimeout(s2);
        clearTimeout(doneTimer);
        onComplete();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearInterval(interval);
      clearTimeout(s1);
      clearTimeout(s2);
      clearTimeout(doneTimer);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", unlockAudio);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.08, filter: "blur(14px)" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      onClick={triggerAudio}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "radial-gradient(ellipse 90% 90% at 50% 50%, #0d0a21 0%, #06040e 65%, #030208 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      {/* Background Animated Atmosphere & Luminous Glows */}
      <motion.div
        animate={{
          scale: [1, 1.25, 1],
          opacity: [0.35, 0.65, 0.35],
          rotate: [0, 90, 180],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          width: 580,
          height: 580,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, rgba(6, 182, 212, 0.14) 40%, transparent 70%)",
          filter: "blur(48px)",
          pointerEvents: "none",
        }}
      />

      {/* Cinematic Center Content */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          maxWidth: 440,
          padding: "0 24px",
        }}
      >
        {/* Layered Geometric Hologram Emblem */}
        <div style={{ position: "relative", width: 110, height: 110, marginBottom: 28 }}>
          {/* Sonic Shockwave Rings (Fires with the iconic 2s chime) */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [0.85, 1.6, 2.4], opacity: [0.8, 0.35, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 0.15 }}
            style={{
              position: "absolute",
              inset: -10,
              borderRadius: "50%",
              border: "1.5px solid rgba(6, 182, 212, 0.6)",
              boxShadow: "0 0 25px rgba(6, 182, 212, 0.4)",
              pointerEvents: "none",
            }}
          />

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [0.85, 1.8, 2.7], opacity: [0.7, 0.25, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 0.45 }}
            style={{
              position: "absolute",
              inset: -10,
              borderRadius: "50%",
              border: "1.5px solid rgba(168, 85, 247, 0.6)",
              boxShadow: "0 0 25px rgba(168, 85, 247, 0.4)",
              pointerEvents: "none",
            }}
          />

          {/* Outer Orbital Telemetry Ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            style={{
              position: "absolute",
              inset: -4,
              borderRadius: "50%",
              border: "1px dashed rgba(255, 255, 255, 0.18)",
              pointerEvents: "none",
            }}
          />

          {/* SVG Laser-Cut Hexagon Shield */}
          <svg width="110" height="110" viewBox="0 0 100 100" fill="none" style={{ overflow: "visible" }}>
            <defs>
              <linearGradient id="boot-laser-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#06B6D4" />
                <stop offset="50%" stopColor="#6366F1" />
                <stop offset="100%" stopColor="#EC4899" />
              </linearGradient>
              <filter id="laser-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Glowing Hexagon outline */}
            <motion.polygon
              points="50,4 92,26 92,74 50,96 8,74 8,26"
              stroke="url(#boot-laser-grad)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              filter="url(#laser-glow)"
              fill="rgba(99, 102, 241, 0.08)"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>

          {/* Center Emblem Icon with 3D Pop & Laser Core */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
            }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -25, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.65, ease: [0.34, 1.56, 0.64, 1] }}
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(6, 182, 212, 0.9))",
                boxShadow: "0 0 32px rgba(99, 102, 241, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.4)",
                display: "grid",
                placeItems: "center",
                color: "#ffffff",
              }}
            >
              <GraduationCap size={30} />
            </motion.div>
          </div>
        </div>

        {/* Brand Pre-title Pill */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.45 }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(99, 102, 241, 0.12)",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            borderRadius: 20,
            padding: "3px 10px",
            marginBottom: 12,
          }}
        >
          <Sparkles size={11} color="#06B6D4" />
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "#A5B4FC",
              textTransform: "uppercase",
            }}
          >
            Unified Academic OS
          </span>
        </motion.div>

        {/* Main Brand Title with Shimmer */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.55 }}
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "clamp(28px, 4.5vw, 36px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            margin: "0 0 6px",
            background: "linear-gradient(135deg, #FFFFFF 30%, #A5B4FC 75%, #06B6D4 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "0 0 40px rgba(99, 102, 241, 0.35)",
          }}
        >
          InstituteOS
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "12px",
            color: "#94A3B8",
            letterSpacing: "0.04em",
            margin: "0 0 24px",
          }}
        >
          Operations · Timetables · AI Copilot
        </motion.p>

        {/* Futuristic Sonic Progress Bar */}
        <div style={{ width: "100%", maxWidth: 280, position: "relative", marginBottom: 14 }}>
          {/* Track */}
          <div
            style={{
              width: "100%",
              height: 4,
              borderRadius: 4,
              background: "rgba(255, 255, 255, 0.08)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Fill */}
            <motion.div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "linear-gradient(90deg, #6366F1, #06B6D4, #EC4899)",
                borderRadius: 4,
                boxShadow: "0 0 12px rgba(6, 182, 212, 0.8)",
                transition: "width 0.04s linear",
              }}
            />
          </div>

          {/* Glowing leading cursor */}
          <div
            style={{
              position: "absolute",
              top: -3,
              left: `calc(${progress}% - 5px)`,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#FFFFFF",
              boxShadow: "0 0 10px #06B6D4, 0 0 20px #6366F1",
              pointerEvents: "none",
              transition: "left 0.04s linear",
            }}
          />
        </div>

        {/* Telemetry Status Line */}
        <div
          style={{
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "11px",
            letterSpacing: "0.06em",
            color: "#94A3B8",
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#06B6D4",
              boxShadow: "0 0 8px #06B6D4",
              animation: "pulse-dot-green 1.5s infinite",
            }}
          />
          <AnimatePresence mode="wait">
            <motion.span
              key={statusIndex}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
            >
              {statusMessages[statusIndex]}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer Prompt */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: 20,
            padding: "5px 14px",
            color: "#64748B",
            fontSize: "11px",
            fontFamily: "'Inter', sans-serif",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#E2E8F0";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#64748B";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
          }}
        >
          Click or ESC to skip
        </button>
      </div>
    </motion.div>
  );
}
