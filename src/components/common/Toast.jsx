import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { toastVariants } from "../../lib/motion.js";
import { sound } from "../../lib/sound.js";

// Global toast listener
let toastListeners = [];
export const toast = {
  success: (title, message, duration = 4000) => emitToast({ type: "success", title, message, duration }),
  error: (title, message, duration = 5000) => emitToast({ type: "error", title, message, duration }),
  warning: (title, message, duration = 4500) => emitToast({ type: "warning", title, message, duration }),
  info: (title, message, duration = 4000) => emitToast({ type: "info", title, message, duration }),
};

function emitToast(toastData) {
  const id = Date.now() + Math.random();
  const item = { ...toastData, id };
  toastListeners.forEach((fn) => fn(item));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (newToast) => {
      sound.shimmer();
      setToasts((prev) => [...prev.slice(-4), newToast]);
    };
    toastListeners.push(handler);
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== handler);
    };
  }, []);

  const dismiss = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        pointerEvents: "none",
        maxWidth: 380,
        width: "calc(100vw - 48px)",
      }}
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((item) => (
          <ToastItem key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ item, onDismiss }) {
  const { type, title, message, duration } = item;

  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  const config = {
    success: {
      icon: CheckCircle2,
      color: "var(--lime)",
      border: "rgba(163, 230, 53, 0.3)",
      glow: "rgba(163, 230, 53, 0.2)",
    },
    error: {
      icon: XCircle,
      color: "var(--red)",
      border: "rgba(251, 113, 133, 0.3)",
      glow: "rgba(251, 113, 133, 0.2)",
    },
    warning: {
      icon: AlertTriangle,
      color: "var(--amber)",
      border: "rgba(251, 191, 36, 0.3)",
      glow: "rgba(251, 191, 36, 0.2)",
    },
    info: {
      icon: Info,
      color: "var(--cyan)",
      border: "rgba(34, 211, 238, 0.3)",
      glow: "rgba(34, 211, 238, 0.2)",
    },
  }[type] || {
    icon: Info,
    color: "var(--cyan)",
    border: "rgba(34, 211, 238, 0.3)",
    glow: "rgba(34, 211, 238, 0.2)",
  };

  const Icon = config.icon;

  return (
    <motion.div
      layout
      variants={toastVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      drag="x"
      dragConstraints={{ left: 0, right: 300 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 80) onDismiss();
      }}
      style={{
        pointerEvents: "auto",
        position: "relative",
        background: "rgba(10, 12, 28, 0.92)",
        backdropFilter: "blur(20px) saturate(140%)",
        border: `1px solid ${config.border}`,
        borderRadius: "var(--radius-md)",
        padding: "14px 16px",
        boxShadow: `0 12px 40px -10px rgba(0,0,0,0.8), 0 0 24px -5px ${config.glow}`,
        overflow: "hidden",
        cursor: "grab",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span
          style={{
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            marginTop: 1,
            color: config.color,
          }}
        >
          <Icon size={19} />
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <strong
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 600,
              color: "#f4f5ff",
              marginBottom: message ? 3 : 0,
            }}
          >
            {title}
          </strong>
          {message && (
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: "#a8acc8",
                lineHeight: 1.4,
              }}
            >
              {message}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: "transparent",
            border: "none",
            color: "#6b7094",
            padding: 2,
            cursor: "pointer",
            flexShrink: 0,
          }}
          aria-label="Dismiss toast"
        >
          <X size={15} />
        </button>
      </div>

      {/* Progress countdown bar */}
      <motion.div
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: duration / 1000, ease: "linear" }}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: 2,
          background: config.color,
          opacity: 0.7,
        }}
      />
    </motion.div>
  );
}
