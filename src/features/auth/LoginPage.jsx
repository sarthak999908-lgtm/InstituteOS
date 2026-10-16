import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Users, GraduationCap, Wallet, Sparkles, ArrowRight, Bot } from "lucide-react";
import GlassCard from "../../components/common/GlassCard.jsx";
import MagneticButton from "../../components/common/MagneticButton.jsx";
import { sound } from "../../lib/sound.js";
import MeshBackground from "../../components/layout/MeshBackground.jsx";

const ROLES = [
  {
    value: "owner",
    title: "Owner",
    icon: ShieldCheck,
    accent: "#2563EB",
    glow: "rgba(37, 99, 235, 0.22)",
    badge: "Full Access",
    capability: "Institute-wide operations, financial governance, approvals & overrides",
    details: ["Manage all batches & staff", "Approve schedule & fee replans", "Access full Copilot audit logs"],
  },
  {
    value: "counselor",
    title: "Counselor",
    icon: Users,
    accent: "#0D9488",
    glow: "rgba(13, 148, 136, 0.22)",
    badge: "Admissions",
    capability: "Admissions, student directory, batch rosters & fee status summaries",
    details: ["Student inquiry intake", "Attendance monitoring", "Draft follow-up reminders"],
  },
  {
    value: "trainer",
    title: "Trainer",
    icon: GraduationCap,
    accent: "#16A34A",
    glow: "rgba(22, 163, 74, 0.22)",
    badge: "Academics",
    capability: "Assigned batches, daily attendance registers & learner risk reports",
    details: ["Mark daily attendance", "View weekly clash-free schedule", "Confidential financial mask"],
  },
  {
    value: "accounts",
    title: "Accounts",
    icon: Wallet,
    accent: "#F97316",
    glow: "rgba(249, 115, 22, 0.22)",
    badge: "Finance",
    capability: "Fee collections, instalment schedules & bank statement reconciliation",
    details: ["Track pending & overdue fees", "Import UPI/bank statements", "Payment candidate matching"],
  },
];

export default function LoginPage({ role, onRoleChange, onLogin }) {
  const [selectedRole, setSelectedRole] = useState(role);
  const [expandingRole, setExpandingRole] = useState(null);

  const handleSelectRole = (r) => {
    sound.tick();
    setSelectedRole(r.value);
    onRoleChange(r.value);
  };

  const handleLaunch = () => {
    sound.chime();
    setExpandingRole(selectedRole);
    setTimeout(() => {
      onLogin();
    }, 550);
  };

  const chosenRoleObj = ROLES.find((r) => r.value === selectedRole) || ROLES[0];

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        overflow: "hidden",
      }}
    >
      <MeshBackground />

      {/* Screen Expansion Reveal on Selection */}
      <AnimatePresence>
        {expandingRole && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 99999,
              background: `radial-gradient(circle at center, ${chosenRoleObj.accent} 0%, var(--bg-0) 80%)`,
              display: "grid",
              placeItems: "center",
            }}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1.05, opacity: 1 }}
              transition={{ duration: 0.35 }}
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "26px",
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: "-0.02em",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Sparkles size={28} color="#ffffff" />
              Entering {chosenRoleObj.title} Workspace...
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          maxWidth: 1080,
          textAlign: "center",
        }}
      >
        {/* Brand Header */}
        <div style={{ marginBottom: 34 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 14px",
              borderRadius: 20,
              background: "var(--accent-badge-bg)",
              border: "1px solid var(--border)",
              color: "var(--accent-primary)",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            <Sparkles size={13} />
            TechSummitTrainers · Operations Copilot
          </div>

          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "clamp(2rem, 3.2vw, 3rem)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "var(--text-primary)",
              marginBottom: 8,
            }}
          >
            Select Your Role
          </h1>
          <p
            style={{
              fontSize: "15px",
              color: "var(--text-secondary)",
              maxWidth: 500,
              margin: "0 auto",
              lineHeight: 1.5,
            }}
          >
            Clear Sky reconfigures data permissions, SQL scopes, and administrative tools for your persona.
          </p>
        </div>

        {/* Four Large 3D-Tilting White Cards with Soft Shadows */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 18,
            marginBottom: 32,
          }}
        >
          {ROLES.map((item) => {
            const isSelected = selectedRole === item.value;
            const Icon = item.icon;
            return (
              <GlassCard
                key={item.value}
                onClick={() => handleSelectRole(item)}
                style={{
                  padding: 22,
                  textAlign: "left",
                  cursor: "pointer",
                  border: isSelected
                    ? `2px solid ${item.accent}`
                    : "1px solid var(--border)",
                  boxShadow: isSelected
                    ? `0 12px 30px -8px ${item.glow}, 0 0 0 1px ${item.accent}`
                    : "var(--shadow-card)",
                  background: "var(--surface)",
                  transform: isSelected ? "translateY(-3px)" : "none",
                  transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 10,
                      background: isSelected ? item.accent : "var(--surface-2)",
                      border: `1px solid ${isSelected ? item.accent : "var(--border)"}`,
                      display: "grid",
                      placeItems: "center",
                      color: isSelected ? "#ffffff" : item.accent,
                    }}
                  >
                    <Icon size={20} />
                  </div>

                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      padding: "3px 8px",
                      borderRadius: 12,
                      background: isSelected ? `${item.accent}1A` : "var(--surface-2)",
                      color: isSelected ? item.accent : "var(--text-muted)",
                    }}
                  >
                    {item.badge}
                  </span>
                </div>

                <h3
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: "19px",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginBottom: 6,
                  }}
                >
                  {item.title}
                </h3>

                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    lineHeight: 1.45,
                    marginBottom: 14,
                    minHeight: 34,
                  }}
                >
                  {item.capability}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {item.details.map((d, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          background: item.accent,
                        }}
                      />
                      <span>{d}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            );
          })}
        </div>

        {/* Launch Button */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <MagneticButton
            variant="primary"
            onClick={handleLaunch}
            style={{
              padding: "12px 34px",
              fontSize: "15px",
              borderRadius: "var(--radius-md)",
            }}
          >
            Enter as {chosenRoleObj.title}
            <ArrowRight size={16} />
          </MagneticButton>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "12px",
              color: "var(--text-muted)",
            }}
          >
            <Bot size={14} color="var(--accent-primary)" />
            <span>Role-scoped SQLite security policies are enforced on all queries and actions.</span>
          </div>
        </div>
      </div>
    </main>
  );
}