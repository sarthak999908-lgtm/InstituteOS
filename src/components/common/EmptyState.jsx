import { motion } from "framer-motion";
import MagneticButton from "./MagneticButton.jsx";

export default function EmptyState({
  type = "paper-plane", // 'paper-plane' (no data) | 'cable' (error) | 'cloud' (no results)
  title = "No data available",
  description = "Get started by adding records or exploring other modules.",
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "44px 20px",
        minHeight: 260,
      }}
    >
      <div style={{ width: 130, height: 130, marginBottom: 18 }}>
        {(type === "paper-plane" || type === "astronaut") && <FloatingPaperPlane />}
        {(type === "cable" || type === "satellite") && <TangledCable />}
        {(type === "cloud" || type === "planet") && <SleepingCloud />}
      </div>

      <h3
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: "18px",
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: 6,
        }}
      >
        {title}
      </h3>

      <p
        style={{
          maxWidth: 360,
          fontSize: "13px",
          color: "var(--text-secondary)",
          lineHeight: 1.5,
          marginBottom: actionLabel || secondaryActionLabel ? 20 : 0,
        }}
      >
        {description}
      </p>

      {(actionLabel || secondaryActionLabel) && (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {secondaryActionLabel && onSecondaryAction && (
            <MagneticButton variant="secondary" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </MagneticButton>
          )}
          {actionLabel && onAction && (
            <MagneticButton variant="primary" onClick={onAction}>
              {actionLabel}
            </MagneticButton>
          )}
        </div>
      )}
    </div>
  );
}

// 1. Floating Paper Plane (No Data)
function FloatingPaperPlane() {
  return (
    <motion.svg
      viewBox="0 0 120 120"
      width="100%"
      height="100%"
      animate={{
        y: [0, -8, 0],
        rotate: [0, 3, -2, 0],
      }}
      transition={{
        duration: 4.8,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <defs>
        <linearGradient id="plane-body-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent-primary)" />
          <stop offset="100%" stopColor="var(--accent-secondary)" />
        </linearGradient>
        <linearGradient id="plane-fold-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0D9488" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {/* Dotted air trail */}
      <motion.path
        d="M 18 95 Q 38 98 48 85 T 68 62"
        fill="none"
        stroke="var(--accent-primary)"
        strokeWidth="1.8"
        strokeDasharray="3 4"
        opacity="0.4"
        animate={{ strokeDashoffset: [0, -14] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
      />

      {/* Main Origami Paper Plane */}
      <g transform="translate(15, 15)">
        <polygon points="10,48 85,15 48,78" fill="url(#plane-body-grad)" />
        <polygon points="48,78 85,15 38,48" fill="url(#plane-fold-grad)" />
        <polygon points="38,48 48,78 42,62" fill="rgba(15, 23, 42, 0.2)" />
      </g>

      {/* Tiny soft floating spark */}
      <motion.circle
        cx="92"
        cy="28"
        r="2.5"
        fill="var(--accent-highlight)"
        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.3, 0.8] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </motion.svg>
  );
}

// 2. Tangled Cable (Error State)
function TangledCable() {
  return (
    <motion.svg
      viewBox="0 0 120 120"
      width="100%"
      height="100%"
      animate={{
        rotate: [0, 2, -2, 0],
      }}
      transition={{
        duration: 5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {/* Plug 1 */}
      <rect x="22" y="32" width="16" height="24" rx="4" fill="var(--surface-3)" stroke="var(--border-strong)" strokeWidth="1.5" />
      <line x1="26" y1="26" x2="26" y2="32" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="34" y1="26" x2="34" y2="32" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" />

      {/* Tangled Looping Cable */}
      <motion.path
        d="M 30 56 C 30 85 75 75 70 50 C 65 25 45 65 60 90 C 75 110 95 85 85 62"
        fill="none"
        stroke="var(--accent-highlight)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={{
          d: [
            "M 30 56 C 30 85 75 75 70 50 C 65 25 45 65 60 90 C 75 110 95 85 85 62",
            "M 30 56 C 32 82 78 78 72 48 C 62 22 42 68 58 92 C 78 112 92 82 85 62",
            "M 30 56 C 30 85 75 75 70 50 C 65 25 45 65 60 90 C 75 110 95 85 85 62",
          ],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Plug 2 (disconnected end) */}
      <rect x="78" y="44" width="16" height="24" rx="4" fill="var(--surface-3)" stroke="var(--border-strong)" strokeWidth="1.5" />
      <circle cx="86" cy="38" r="3" fill="var(--danger)" />
      {/* Warning spark */}
      <motion.path
        d="M 86 28 L 88 33 L 93 33 L 89 36 L 91 41 L 86 38 L 82 41 L 84 36 L 80 33 L 85 33 Z"
        fill="var(--warning)"
        animate={{ scale: [0.6, 1.2, 0.6], opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.4, repeat: Infinity }}
      />
    </motion.svg>
  );
}

// 3. Sleeping Cloud (No Results)
function SleepingCloud() {
  return (
    <motion.svg
      viewBox="0 0 120 120"
      width="100%"
      height="100%"
      animate={{
        y: [0, -6, 0],
      }}
      transition={{
        duration: 4.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <defs>
        <linearGradient id="cloud-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--surface)" />
          <stop offset="100%" stopColor="var(--surface-2)" />
        </linearGradient>
      </defs>

      {/* Cloud Shape */}
      <path
        d="M 32 75 A 18 18 0 0 1 45 48 A 24 24 0 0 1 82 46 A 18 18 0 0 1 96 75 Z"
        fill="url(#cloud-grad)"
        stroke="var(--border-hover)"
        strokeWidth="1.5"
      />

      {/* Sleeping Eyes */}
      <path d="M 48 60 Q 52 64 56 60" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" />
      <path d="M 68 60 Q 72 64 76 60" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" />

      {/* Gentle smile */}
      <path d="M 60 67 Q 62 69 64 67" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />

      {/* Floating Zzz */}
      <motion.text
        x="82"
        y="38"
        fill="var(--accent-primary)"
        fontFamily="'Space Grotesk', sans-serif"
        fontSize="12"
        fontWeight="700"
        animate={{ y: [38, 28, 38], opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      >
        Z
      </motion.text>
      <motion.text
        x="92"
        y="26"
        fill="var(--accent-secondary)"
        fontFamily="'Space Grotesk', sans-serif"
        fontSize="15"
        fontWeight="700"
        animate={{ y: [26, 16, 26], opacity: [0.2, 0.9, 0.2] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      >
        z
      </motion.text>
    </motion.svg>
  );
}
