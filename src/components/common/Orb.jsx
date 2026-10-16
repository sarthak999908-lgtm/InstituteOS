import { motion } from "framer-motion";
import { LockKeyhole } from "lucide-react";

export default function Orb({
  state = "idle", // 'idle' | 'listening' | 'thinking' | 'success' | 'refused'
  size = 120,
  stageLabel = "",
  layoutId = "copilot-orb-entity",
  onClick,
  className = "",
  style = {},
}) {
  const isCompact = size <= 56;

  // Clear Sky color palettes (Blue and Teal, Coral on refusal; no purple/pink!)
  const colorMap = {
    idle: {
      core: "#0EA5A4",
      secondary: "#2563EB",
      outer: "#0284C7",
      glow: "rgba(37, 99, 235, 0.35)",
    },
    listening: {
      core: "#38BDF8",
      secondary: "#0284C7",
      outer: "#14B8A6",
      glow: "rgba(56, 189, 248, 0.5)",
    },
    thinking: {
      core: "#0D9488",
      secondary: "#1D4ED8",
      outer: "#0369A1",
      glow: "rgba(13, 148, 136, 0.55)",
    },
    success: {
      core: "#16A34A",
      secondary: "#0D9488",
      outer: "#FFFFFF",
      glow: "rgba(22, 163, 74, 0.6)",
    },
    refused: {
      core: "#F97316", // Coral
      secondary: "#EA580C",
      outer: "#DC2626",
      glow: "rgba(249, 115, 22, 0.55)",
    },
  }[state] || {
    core: "#0EA5A4",
    secondary: "#2563EB",
    outer: "#0284C7",
    glow: "rgba(37, 99, 235, 0.35)",
  };

  return (
    <div
      className={`copilot-orb-wrapper ${className}`}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
      onClick={onClick}
    >
      <motion.div
        layoutId={layoutId}
        style={{
          width: size,
          height: size,
          position: "relative",
          display: "grid",
          placeItems: "center",
        }}
      >
        {/* Outermost ambient aura */}
        <motion.div
          animate={
            state === "thinking"
              ? { scale: [1, 1.25, 1], opacity: [0.45, 0.8, 0.45] }
              : state === "listening"
              ? { scale: [1, 1.28, 1], opacity: [0.4, 0.75, 0.4] }
              : state === "success"
              ? { scale: [1, 1.4, 1.1], opacity: [0.7, 1, 0.8] }
              : state === "refused"
              ? { scale: [1, 0.85, 0.9], opacity: [0.5, 0.85, 0.6] }
              : { scale: [1, 1.1, 1], opacity: [0.35, 0.55, 0.35] }
          }
          transition={{
            duration: state === "thinking" ? 1.6 : 3.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            position: "absolute",
            inset: -size * 0.25,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${colorMap.glow} 0%, transparent 70%)`,
            filter: "blur(18px)",
            pointerEvents: "none",
          }}
        />

        {/* Listening ripple waves */}
        {state === "listening" && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0.8 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: `2px solid ${colorMap.core}`,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Orbiting particles in thinking state */}
        {state === "thinking" && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
            style={{
              position: "absolute",
              inset: -size * 0.15,
              borderRadius: "50%",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: "50%",
                width: isCompact ? 3 : 5,
                height: isCompact ? 3 : 5,
                borderRadius: "50%",
                background: "#ffffff",
                boxShadow: "0 0 10px #ffffff, 0 0 16px #38bdf8",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 4,
                right: "15%",
                width: isCompact ? 3 : 4,
                height: isCompact ? 3 : 4,
                borderRadius: "50%",
                background: "#2dd4bf",
                boxShadow: "0 0 8px #2dd4bf",
              }}
            />
          </motion.div>
        )}

        {/* Core Living Glassy Sphere */}
        <motion.div
          animate={
            state === "thinking"
              ? { rotate: 360, scale: [0.95, 1.05, 0.95] }
              : state === "listening"
              ? { scale: [1, 1.08, 1] }
              : state === "success"
              ? { scale: [1, 1.2, 1] }
              : state === "refused"
              ? { scale: [1, 0.9, 0.92] }
              : { scale: [1, 1.04, 1] }
          }
          transition={{
            rotate: { duration: 6, repeat: Infinity, ease: "linear" },
            scale: {
              duration: state === "thinking" ? 1.4 : 3,
              repeat: Infinity,
              ease: "easeInOut",
            },
          }}
          style={{
            width: "82%",
            height: "82%",
            borderRadius: "50%",
            position: "relative",
            background: `radial-gradient(circle at 35% 30%, ${colorMap.core} 0%, ${colorMap.secondary} 55%, ${colorMap.outer} 90%)`,
            boxShadow: `
              inset 0 2px 6px rgba(255, 255, 255, 0.85),
              inset 0 -6px 14px rgba(0, 0, 0, 0.35),
              0 8px 24px -4px ${colorMap.glow}
            `,
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
          }}
        >
          {/* Inner glass reflection highlight */}
          <motion.div
            animate={{
              x: ["-100%", "100%"],
              opacity: [0.2, 0.65, 0.2],
            }}
            transition={{
              duration: state === "thinking" ? 1.5 : 3.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background:
                "linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.6) 50%, transparent 70%)",
              pointerEvents: "none",
            }}
          />

          {/* Refused State Center Lock Icon */}
          {state === "refused" && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              style={{
                color: "#ffffff",
                display: "grid",
                placeItems: "center",
                zIndex: 3,
                filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))",
              }}
            >
              <LockKeyhole size={isCompact ? 16 : 28} />
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      {/* Thinking / Cycling Stage Label */}
      {!isCompact && stageLabel && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          style={{
            marginTop: 12,
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: state === "refused" ? "var(--accent-highlight)" : "var(--accent-primary)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "currentColor",
              boxShadow: "0 0 6px currentColor",
              animation: "pulse-dot-green 1.4s infinite",
            }}
          />
          {stageLabel}
        </motion.div>
      )}
    </div>
  );
}
