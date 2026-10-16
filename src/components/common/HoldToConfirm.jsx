import { useState, useRef, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import confetti from "canvas-confetti";
import { Check } from "lucide-react";
import { sound } from "../../lib/sound.js";

export default function HoldToConfirm({
  onConfirm,
  label = "Hold to Approve",
  confirmedLabel = "Approved",
  duration = 700,
  disabled = false,
  className = "",
  title = "Hold to confirm",
}) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [microShake, setMicroShake] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const prefersReduced = useReducedMotion();

  const fireConfetti = () => {
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        // Accent colours: Blue, Teal, Coral, Green (Clear Sky palette)
        colors: ["#2563EB", "#0D9488", "#F97316", "#16A34A"],
        disableForReducedMotion: true,
      });
    } catch {}
  };

  const startHold = (e) => {
    if (disabled || confirmed) return;
    if (e.button && e.button !== 0) return;
    setHolding(true);
    startTimeRef.current = performance.now();

    const update = (now) => {
      const elapsed = now - startTimeRef.current;
      const p = Math.min(elapsed / duration, 1);
      setProgress(p);

      if (p > 0.45 && !prefersReduced) {
        setMicroShake(true);
      }

      if (p < 1) {
        timerRef.current = requestAnimationFrame(update);
      } else {
        setHolding(false);
        setMicroShake(false);
        setConfirmed(true);
        sound.chime();
        fireConfetti();
        if (onConfirm) onConfirm();
      }
    };

    timerRef.current = requestAnimationFrame(update);
  };

  const endHold = () => {
    if (confirmed) return;
    setHolding(false);
    setMicroShake(false);
    if (timerRef.current) cancelAnimationFrame(timerRef.current);
    setProgress(0);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, []);

  return (
    <motion.button
      type="button"
      disabled={disabled || confirmed}
      title={title}
      className={`hold-to-confirm-btn ${className}`}
      onMouseDown={startHold}
      onMouseUp={endHold}
      onMouseLeave={endHold}
      onTouchStart={startHold}
      onTouchEnd={endHold}
      animate={
        microShake
          ? {
              x: [-1, 1, -1, 1, 0],
              y: [1, -1, 1, -1, 0],
            }
          : {}
      }
      transition={{ repeat: Infinity, duration: 0.1 }}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minWidth: 160,
        height: 40,
        padding: "0 20px",
        borderRadius: "var(--radius-sm)",
        border: confirmed
          ? "1px solid var(--success)"
          : "1px solid var(--border)",
        background: confirmed
          ? "var(--success-bg)"
          : "var(--surface-2)",
        color: confirmed ? "var(--success)" : "var(--text-primary)",
        fontFamily: "'Inter', sans-serif",
        fontSize: "13px",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : confirmed ? "default" : "pointer",
        overflow: "hidden",
        userSelect: "none",
        boxShadow: confirmed
          ? "0 0 16px rgba(22, 163, 74, 0.25)"
          : holding
          ? "0 0 20px var(--brand-glow)"
          : "0 1px 2px rgba(15, 23, 42, 0.05)",
        transition: "box-shadow 0.2s ease, border-color 0.2s ease, background 0.3s ease",
      }}
    >
      {/* Background fill progress with Brand Gradient */}
      {!confirmed && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--brand-gradient)",
            transform: `scaleX(${progress})`,
            transformOrigin: "left center",
            transition: holding ? "none" : "transform 0.25s ease-out",
            opacity: 0.9,
            zIndex: 1,
          }}
        />
      )}

      {/* Button content */}
      <span
        style={{
          position: "relative",
          zIndex: 2,
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          color: holding && !confirmed ? "#ffffff" : "inherit",
        }}
      >
        {confirmed ? (
          <>
            <motion.span
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <Check size={16} strokeWidth={2.8} />
            </motion.span>
            {confirmedLabel}
          </>
        ) : (
          <>
            <Check size={15} />
            {holding ? `Keep holding...` : label}
          </>
        )}
      </span>
    </motion.button>
  );
}
