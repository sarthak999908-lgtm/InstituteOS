import { useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles, CheckCircle2, AlertTriangle, XCircle, Info, ShieldCheck,
  Send, RefreshCw, Layers, Palette, Eye, Volume2, Sun, Moon, Laptop, Feather
} from "lucide-react";
import GlassCard from "../components/common/GlassCard.jsx";
import MagneticButton from "../components/common/MagneticButton.jsx";
import HoldToConfirm from "../components/common/HoldToConfirm.jsx";
import Orb from "../components/common/Orb.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import CountUp from "../components/common/CountUp.jsx";
import Sparkline from "../components/common/Sparkline.jsx";
import Skeleton from "../components/common/Skeleton.jsx";
import { toast } from "../components/common/Toast.jsx";
import { sound } from "../lib/sound.js";
import { TOKENS } from "../lib/tokens.js";
import { useTheme } from "../app/providers.jsx";

export default function UiDesignSystemPage() {
  const { theme, resolvedTheme, setTheme, accent, setAccent, calmMode, setCalmMode } = useTheme();
  const [orbState, setOrbState] = useState("thinking");
  const [emptyType, setEmptyType] = useState("paperplane");

  return (
    <div className="module-page ui-design-system-page" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-primary)", boxShadow: "0 0 10px var(--accent-primary)" }} />
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", color: "var(--accent-primary)", textTransform: "uppercase" }}>
              CLEAR SKY DESIGN SYSTEM
            </span>
          </div>

          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(2rem, 3vw, 2.8rem)", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Component & Token Catalog
          </h1>

          <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: "6px 0 0" }}>
            Living documentation of Clear Sky light-first design tokens, themes, accent presets, motion primitives, and interactive ceremonies.
          </p>
        </div>

        {/* Live Theme & Preset Controls */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Light / Dark / System */}
          <div style={{ display: "flex", background: "var(--surface-2)", padding: 3, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={(e) => setTheme("light", e)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                borderRadius: 6,
                border: "none",
                background: theme === "light" ? "var(--surface)" : "transparent",
                color: theme === "light" ? "var(--accent-primary)" : "var(--text-muted)",
                boxShadow: theme === "light" ? "0 1px 3px rgba(15, 23, 42, 0.08)" : "none",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Sun size={13} /> Light
            </button>
            <button
              type="button"
              onClick={(e) => setTheme("dark", e)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                borderRadius: 6,
                border: "none",
                background: theme === "dark" ? "var(--surface)" : "transparent",
                color: theme === "dark" ? "var(--accent-primary)" : "var(--text-muted)",
                boxShadow: theme === "dark" ? "0 1px 3px rgba(15, 23, 42, 0.08)" : "none",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Moon size={13} /> Dark
            </button>
            <button
              type="button"
              onClick={(e) => setTheme("system", e)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                borderRadius: 6,
                border: "none",
                background: theme === "system" ? "var(--surface)" : "transparent",
                color: theme === "system" ? "var(--accent-primary)" : "var(--text-muted)",
                boxShadow: theme === "system" ? "0 1px 3px rgba(15, 23, 42, 0.08)" : "none",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Laptop size={13} /> System
            </button>
          </div>

          {/* Accent Presets */}
          <div style={{ display: "flex", background: "var(--surface-2)", padding: 3, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
            {["ocean", "emerald", "sunset"].map((ac) => (
              <button
                key={ac}
                type="button"
                onClick={() => setAccent(ac)}
                style={{
                  padding: "5px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: accent === ac ? "var(--surface)" : "transparent",
                  color: accent === ac ? "var(--accent-primary)" : "var(--text-muted)",
                  boxShadow: accent === ac ? "0 1px 3px rgba(15, 23, 42, 0.08)" : "none",
                  fontSize: "12px",
                  fontWeight: 600,
                  textTransform: "capitalize",
                  cursor: "pointer",
                }}
              >
                {ac}
              </button>
            ))}
          </div>

          {/* Calm Mode Toggle */}
          <button
            type="button"
            onClick={() => setCalmMode(!calmMode)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${calmMode ? "var(--accent-primary)" : "var(--border)"}`,
              background: calmMode ? "var(--accent-badge-bg)" : "var(--surface-2)",
              color: calmMode ? "var(--accent-primary)" : "var(--text-secondary)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Feather size={14} />
            Calm Mode: {calmMode ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* 1. Color Tokens & Presets */}
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ fontSize: "18px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
          <Palette size={18} color="var(--accent-primary)" />
          1. Color Tokens & Accent Presets (Active: {accent.toUpperCase()})
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          {[
            { name: "Primary Accent", token: "var(--accent-primary)", desc: "Brand primary action & glows" },
            { name: "Secondary Accent", token: "var(--accent-secondary)", desc: "Complementary teal / cyan" },
            { name: "Highlight Accent", token: "var(--accent-highlight)", desc: "Warm coral / amber focal" },
            { name: "Success", token: "var(--success)", desc: "Completed / verified actions" },
            { name: "Warning", token: "var(--warning)", desc: "Attention / near-capacity" },
            { name: "Danger", token: "var(--danger)", desc: "Overdue / deletions / errors" },
            { name: "Info", token: "var(--info)", desc: "Guidance & notifications" },
            { name: "Surface Canvas", token: "var(--surface)", desc: "Primary card elevation" },
          ].map((c) => (
            <GlassCard key={c.name} style={{ padding: 14 }}>
              <div
                style={{
                  height: 48,
                  borderRadius: "var(--radius-sm)",
                  background: c.token,
                  border: "1px solid var(--border)",
                  boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)",
                  marginBottom: 10,
                }}
              />
              <strong style={{ fontSize: "13px", color: "var(--text-primary)", display: "block" }}>{c.name}</strong>
              <code style={{ fontSize: "11px", color: "var(--accent-primary)", display: "block", margin: "2px 0" }}>{c.token}</code>
              <small style={{ fontSize: "10px", color: "var(--text-muted)" }}>{c.desc}</small>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* 2. Glass Cards with 3D Tilt and Cursor Sheen */}
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ fontSize: "18px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
          <Layers size={18} color="var(--accent-primary)" />
          2. Clear Glass Cards (3D Tilt & Cursor Sheen)
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <GlassCard style={{ padding: 24 }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-primary)", textTransform: "uppercase" }}>Airy Glass</span>
            <h3 style={{ fontSize: "18px", color: "var(--text-primary)", margin: "6px 0" }}>3D Perspective Tilt</h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
              Hover and move your mouse across this card. It tilts up to 5 degrees with perspective 1000px, lifts 3px, and follows the pointer with a localized sheen.
            </p>
          </GlassCard>

          <GlassCard style={{ padding: 24 }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-secondary)", textTransform: "uppercase" }}>Layered Shadows</span>
            <h3 style={{ fontSize: "18px", color: "var(--text-primary)", margin: "6px 0" }}>Crisp White Space</h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
              Soft layered shadows (0 1px 2px, 0 8px 24px) prevent generic admin-template flatness while remaining accessible with WCAG AA contrast.
            </p>
          </GlassCard>

          <GlassCard style={{ padding: 24 }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-highlight)", textTransform: "uppercase" }}>Warm Highlight</span>
            <h3 style={{ fontSize: "18px", color: "var(--text-primary)", margin: "6px 0" }}>Living Ambient Depth</h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
              Notice the 3% paper grain and the subtle 24px dot grid fading toward edges with pointer parallax.
            </p>
          </GlassCard>
        </div>
      </section>

      {/* 3. Buttons & Ceremonies */}
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ fontSize: "18px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={18} color="var(--accent-primary)" />
          3. Magnetic Buttons & Hold-To-Confirm Ceremony
        </h2>

        <GlassCard style={{ padding: 24 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20 }}>
            {/* Primary Magnetic */}
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                Primary (Magnetic Pull + Brand Shimmer)
              </span>
              <MagneticButton variant="primary">
                <Sparkles size={15} />
                Primary Shimmer
              </MagneticButton>
            </div>

            {/* Secondary Glass */}
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                Secondary (Crisp Surface)
              </span>
              <MagneticButton variant="secondary">
                Secondary Surface
              </MagneticButton>
            </div>

            {/* Ghost */}
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                Ghost (Underline Expand)
              </span>
              <MagneticButton variant="ghost">
                Ghost Action
              </MagneticButton>
            </div>

            {/* Hold to Confirm */}
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                Approval Ceremony (Hold 700ms + Blue/Teal/Coral Confetti)
              </span>
              <HoldToConfirm
                onConfirm={() => toast.success("Ceremony Complete", "Confetti burst and chime sound triggered!")}
                label="Hold to Approve"
                confirmedLabel="Approved!"
              />
            </div>
          </div>
        </GlassCard>
      </section>

      {/* 4. Copilot Orb State Machine */}
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ fontSize: "18px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
          <Eye size={18} color="var(--accent-primary)" />
          4. Copilot Living Orb State Machine
        </h2>

        <GlassCard style={{ padding: 28, textAlign: "center" }}>
          {/* State Switcher */}
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
            {["idle", "listening", "thinking", "success", "refused"].map((st) => (
              <MagneticButton
                key={st}
                variant={orbState === st ? "primary" : "secondary"}
                onClick={() => {
                  setOrbState(st);
                  if (st === "refused") sound.error();
                  else if (st === "success") sound.chime();
                  else sound.tick();
                }}
              >
                {st.toUpperCase()}
              </MagneticButton>
            ))}
          </div>

          <Orb
            size={130}
            state={orbState}
            stageLabel={
              orbState === "thinking"
                ? "Writing SQLite query..."
                : orbState === "listening"
                ? "Listening..."
                : orbState === "refused"
                ? "Role permission refused (Coral lock)"
                : orbState === "success"
                ? "Insight ready!"
                : ""
            }
          />
        </GlassCard>
      </section>

      {/* 5. Animated Empty States */}
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ fontSize: "18px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={18} color="var(--warning)" />
          5. Animated Empty & Error States (Paper Plane, Tangled Cable, Sleeping Cloud)
        </h2>

        <GlassCard style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 16 }}>
            <MagneticButton variant={emptyType === "paperplane" ? "primary" : "secondary"} onClick={() => setEmptyType("paperplane")}>
              Paper Plane (No Data)
            </MagneticButton>
            <MagneticButton variant={emptyType === "cable" ? "primary" : "secondary"} onClick={() => setEmptyType("cable")}>
              Tangled Cable (Error)
            </MagneticButton>
            <MagneticButton variant={emptyType === "cloud" ? "primary" : "secondary"} onClick={() => setEmptyType("cloud")}>
              Sleeping Cloud (No Results)
            </MagneticButton>
          </div>

          <EmptyState
            type={emptyType}
            title={
              emptyType === "paperplane"
                ? "No student records yet"
                : emptyType === "cable"
                ? "Connection lost"
                : "No matching results found"
            }
            description={
              emptyType === "paperplane"
                ? "Get started by adding your first batch or student record."
                : emptyType === "cable"
                ? "Could not reach the database backend. Check your network connection."
                : "Try adjusting your search criteria or clearing filters."
            }
            actionLabel="Take Primary Action"
            onAction={() => toast.info("Action Triggered", "Primary empty state button clicked.")}
          />
        </GlassCard>
      </section>

      {/* 6. Toast Notifications Test */}
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ fontSize: "18px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
          <Volume2 size={18} color="var(--accent-primary)" />
          6. Spring Physics Toasts
        </h2>

        <GlassCard style={{ padding: 24 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <MagneticButton variant="secondary" onClick={() => toast.success("Batch Completed", "Full Stack Batch A has reached 100% completion.")}>
              Trigger Success Toast
            </MagneticButton>
            <MagneticButton variant="secondary" onClick={() => toast.warning("Capacity Alert", "Room 4 capacity has exceeded 90% threshold.")}>
              Trigger Warning Toast
            </MagneticButton>
            <MagneticButton variant="secondary" onClick={() => toast.error("Permission Refused", "Trainers cannot view fee reconciliation data.")}>
              Trigger Error Toast
            </MagneticButton>
            <MagneticButton variant="secondary" onClick={() => toast.info("Role Switched", "Access reconfigured for Counselor.")}>
              Trigger Info Toast
            </MagneticButton>
          </div>
        </GlassCard>
      </section>

      {/* 7. Skeletons with Clear Shimmer */}
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ fontSize: "18px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
          <Layers size={18} color="var(--accent-primary)" />
          7. Clear Shimmer Skeletons
        </h2>

        <GlassCard style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <Skeleton width="40%" height="24px" />
          <Skeleton width="100%" height="16px" />
          <Skeleton width="85%" height="16px" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 8 }}>
            <Skeleton width="100%" height="60px" />
            <Skeleton width="100%" height="60px" />
            <Skeleton width="100%" height="60px" />
          </div>
        </GlassCard>
      </section>
    </div>
  );
}
