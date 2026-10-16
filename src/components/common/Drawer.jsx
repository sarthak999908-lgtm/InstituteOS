import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Wallet, AlertTriangle, CheckCircle2, Clock, Phone, Mail, GraduationCap } from "lucide-react";
import { drawerVariants, modalBackdrop } from "../../lib/motion.js";
import MagneticButton from "./MagneticButton.jsx";

export default function StudentDrawer({
  isOpen,
  onClose,
  student,
  role = "owner",
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !student) return null;

  // Mock or derived student insights
  const attendanceRate = student.attendanceRate ?? 86;
  const isHighRisk = attendanceRate < 75 || student.status === "Pending";
  const riskScore = isHighRisk ? 72 : 24; // 0 to 100
  const canSeeFees = role !== "trainer";

  // 14 days attendance heat strip data
  const heatStrip = [
    "P", "P", "P", "L", "P", "P", "A",
    "P", "P", "P", "P", "L", "P", isHighRisk ? "A" : "P"
  ];

  const circumference = 2 * Math.PI * 34; // r = 34
  const strokeDashoffset = circumference - (attendanceRate / 100) * circumference;

  return (
    <AnimatePresence>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          display: "flex",
          justifyContent: "flex-end",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`Student details: ${student.name}`}
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
            background: "rgba(5, 6, 15, 0.7)",
            backdropFilter: "blur(12px)",
          }}
        />

        {/* Drawer panel */}
        <motion.aside
          variants={drawerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 480,
            height: "100vh",
            background: "rgba(10, 12, 28, 0.96)",
            backdropFilter: "blur(28px) saturate(150%)",
            borderLeft: "1px solid var(--border)",
            boxShadow: "-10px 0 50px rgba(0,0,0,0.8), inset 0 1px 0 0 var(--top-edge)",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            zIndex: 1,
          }}
        >
          {/* Header with avatar ring */}
          <div
            style={{
              padding: "24px 24px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              background: "linear-gradient(180deg, rgba(139, 92, 246, 0.08) 0%, transparent 100%)",
            }}
          >
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              {/* Circular Avatar Ring filled with attendance % */}
              <div style={{ position: "relative", width: 78, height: 78 }}>
                <svg width="78" height="78" style={{ transform: "rotate(-90deg)" }}>
                  <circle
                    cx="39"
                    cy="39"
                    r="34"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="4"
                  />
                  <motion.circle
                    cx="39"
                    cy="39"
                    r="34"
                    fill="none"
                    stroke={attendanceRate >= 80 ? "var(--lime)" : attendanceRate >= 70 ? "var(--amber)" : "var(--red)"}
                    strokeWidth="4"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                    strokeLinecap="round"
                  />
                </svg>
                <div
                  style={{
                    position: "absolute",
                    inset: 6,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #1e1b4b, #0f172a)",
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "#ffffff",
                    border: "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  {student.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </div>
              </div>

              <div>
                <h2
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "#ffffff",
                    margin: 0,
                  }}
                >
                  {student.name}
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "11px",
                      color: "var(--cyan)",
                      background: "rgba(34, 211, 238, 0.12)",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    {student.id || "STU-8821"}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    {student.course || "Full Stack Development"}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                width: 32,
                height: 32,
                display: "grid",
                placeItems: "center",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
              aria-label="Close drawer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Drawer Body */}
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Contact quick actions */}
            {(student.email || student.phone) && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {student.email && (
                  <div
                    style={{
                      padding: "10px 12px",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: "11px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <Mail size={14} color="var(--accent-primary)" />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {student.email}
                    </span>
                  </div>
                )}
                {student.phone && (
                  <div
                    style={{
                      padding: "10px 12px",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: "11px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <Phone size={14} color="var(--cyan)" />
                    <span>{student.phone}</span>
                  </div>
                )}
              </div>
            )}

            {/* Dropout Risk Meter */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: "var(--text-muted)" }}>
                  DROPOUT RISK ASSESSMENT
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 12,
                    color: isHighRisk ? "var(--red)" : "var(--lime)",
                    background: isHighRisk ? "rgba(251, 113, 133, 0.15)" : "rgba(163, 230, 53, 0.15)",
                  }}
                >
                  {isHighRisk ? "HIGH RISK" : "STABLE"}
                </span>
              </div>

              {/* Animated Needle Meter */}
              <div style={{ position: "relative", height: 16, background: "rgba(255,255,255,0.06)", borderRadius: 8, overflow: "hidden" }}>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(90deg, #a3e635 0%, #fbbf24 50%, #fb7185 100%)",
                    opacity: 0.7,
                  }}
                />
                <motion.div
                  initial={{ left: "0%" }}
                  animate={{ left: `${riskScore}%` }}
                  transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    width: 4,
                    background: "#ffffff",
                    boxShadow: "0 0 8px #ffffff",
                    transform: "translateX(-50%)",
                  }}
                />
              </div>

              {/* Risk reason chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                {isHighRisk ? (
                  <>
                    <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: 6, background: "rgba(251,113,133,0.15)", color: "#fb7185" }}>
                      • 2 unexcused absences
                    </span>
                    <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: 6, background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>
                      • EMI payment pending
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: 6, background: "rgba(163,230,53,0.12)", color: "#a3e635" }}>
                      • 86% attendance rate
                    </span>
                    <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: 6, background: "rgba(34,211,238,0.12)", color: "#22d3ee" }}>
                      • Lab assignments current
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Attendance Heat Strip */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: "var(--text-muted)" }}>
                  RECENT ATTENDANCE (14 SESSIONS)
                </span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#ffffff" }}>
                  {attendanceRate}% present
                </span>
              </div>

              {/* Heat cells popping in sequentially */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: 4 }}>
                {heatStrip.map((status, idx) => {
                  const bg =
                    status === "P"
                      ? "var(--lime)"
                      : status === "L"
                      ? "var(--amber)"
                      : "var(--red)";
                  return (
                    <motion.div
                      key={idx}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.04 * idx, duration: 0.3 }}
                      title={`Session #${idx + 1}: ${status === "P" ? "Present" : status === "L" ? "Late" : "Absent"}`}
                      style={{
                        aspectRatio: "1/1",
                        borderRadius: 4,
                        background: bg,
                        opacity: status === "P" ? 0.85 : 0.95,
                        display: "grid",
                        placeItems: "center",
                        fontSize: "9px",
                        fontWeight: 700,
                        color: "#05060f",
                      }}
                    >
                      {status}
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Fee Ledger Timeline (Hidden for trainers) */}
            {canSeeFees && (
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: "var(--text-muted)" }}>
                    FEE LEDGER & TIMELINE
                  </span>
                  <Wallet size={15} color="var(--accent-primary)" />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 6 }}>
                    <div>
                      <strong style={{ display: "block", fontSize: "12px", color: "#ffffff" }}>Instalment 1 (Admission)</strong>
                      <small style={{ color: "var(--text-muted)", fontSize: "10px" }}>Paid on 12 Sep 2026 · UPI</small>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--lime)" }}>₹15,000 (Paid)</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 6 }}>
                    <div>
                      <strong style={{ display: "block", fontSize: "12px", color: "#ffffff" }}>Instalment 2 (Mid-term)</strong>
                      <small style={{ color: "var(--text-muted)", fontSize: "10px" }}>Due on 20 Oct 2026</small>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--amber)" }}>₹15,000 (Due)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer action */}
          <div
            style={{
              marginTop: "auto",
              padding: "16px 24px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              background: "rgba(5, 6, 15, 0.6)",
            }}
          >
            <MagneticButton variant="secondary" onClick={onClose}>
              Close
            </MagneticButton>
          </div>
        </motion.aside>
      </div>
    </AnimatePresence>
  );
}
