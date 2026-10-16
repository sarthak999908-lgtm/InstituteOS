import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, BookOpen, ClipboardCheck, Wallet, Sparkles, RefreshCw,
  ArrowUpRight, AlertTriangle, TrendingUp, CheckCircle2, ChevronRight,
  Activity, Calendar
} from "lucide-react";
import GlassCard from "../components/common/GlassCard.jsx";
import MagneticButton from "../components/common/MagneticButton.jsx";
import CountUp from "../components/common/CountUp.jsx";
import Sparkline from "../components/common/Sparkline.jsx";
import { sound } from "../lib/sound.js";
import { INITIAL_STUDENTS } from "../data.js";
import { batches } from "../data/mockData.js";

export default function DashboardBento({
  dashboard,
  loading = false,
  error = "",
  lastUpdated,
  onRefresh,
  onNavigate,
  onSelectStudent,
  role = "owner",
}) {
  const stats = useMemo(() => getStatsData(dashboard), [dashboard]);

  // Cash flow monthly trend data for the River chart
  const cashFlowData = [
    { month: "May", collected: 140000, projected: 160000 },
    { month: "Jun", collected: 185000, projected: 190000 },
    { month: "Jul", collected: 210000, projected: 220000 },
    { month: "Aug", collected: 195000, projected: 240000 },
    { month: "Sep", collected: 260000, projected: 280000 },
    { month: "Oct", collected: 290000, projected: 310000 },
  ];

  // Attention Feed Alerts
  const alerts = [
    {
      id: "alt-1",
      severity: "high", // red
      title: "Critical Attendance & Fee Risk",
      description: "Pooja Verma & Rahul Sharma missed 3+ classes with overdue EMIs.",
      actionLabel: "Ask Copilot",
      action: () => onNavigate("AI Copilot"),
      time: "10m ago",
    },
    {
      id: "alt-2",
      severity: "medium", // amber
      title: "Room 4 Capacity at 94%",
      description: "Data Science Evening batch has 28 learners in a 30-seat room.",
      actionLabel: "View Batches",
      action: () => onNavigate("Batches"),
      time: "1h ago",
    },
    {
      id: "alt-3",
      severity: "low", // green
      title: "Clash-Free Timetable Generated",
      description: "Weekly solver produced optimal room-trainer allocation.",
      actionLabel: "Open Schedules",
      action: () => onNavigate("Schedules"),
      time: "2h ago",
    },
  ];

  return (
    <div className="dashboard-bento-container" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top Welcome Header */}
      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--accent-primary)",
                animation: "pulse-dot-green 2s infinite",
              }}
            />
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--accent-primary)",
              }}
            >
              OPERATIONS OVERVIEW
            </span>
          </div>

          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "clamp(1.8rem, 2.8vw, 2.4rem)",
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            {getGreeting()}, {capitalize(role)} 👋
          </h1>

          <p style={{ margin: "4px 0 0", fontSize: "14px", color: "var(--text-secondary)" }}>
            Real-time institute telemetry, risk constellations and financial trajectory.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <MagneticButton variant="secondary" onClick={() => onRefresh(true)} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spinning" : ""} />
            Sync
          </MagneticButton>

          <MagneticButton variant="primary" onClick={() => onNavigate("AI Copilot")}>
            <Sparkles size={15} />
            Ask Copilot
          </MagneticButton>
        </div>
      </section>

      {/* KPI 4-Tiles Grid */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 16,
        }}
      >
        {stats.map((stat, idx) => (
          <GlassCard
            key={stat.label}
            style={{
              padding: "20px 22px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: 135,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  {stat.label}
                </span>
                <div style={{ marginTop: 6 }}>
                  <CountUp
                    value={stat.value}
                    prefix={stat.prefix || ""}
                    suffix={stat.suffix || ""}
                    formatter={stat.formatter}
                  />
                </div>
              </div>

              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  background: stat.bg,
                  display: "grid",
                  placeItems: "center",
                  color: stat.color,
                  border: `1px solid ${stat.color}33`,
                }}
              >
                <stat.icon size={19} />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 10 }}>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                {stat.note}
              </span>
              <Sparkline data={stat.sparkline} color={stat.color} fillGradientId={`spark-${idx}`} width={88} height={26} />
            </div>
          </GlassCard>
        ))}
      </section>

      {/* Main Bento Asymmetric Section */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: 18,
        }}
      >
        {/* Left 7 Columns: Cash Flow River + Risk Constellation */}
        <div style={{ gridColumn: "span 7", display: "flex", flexDirection: "column", gap: 18 }} className="bento-col-7">
          {/* Cash Flow River Chart Tile */}
          <GlassCard style={{ padding: 22, position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent-primary)" }}>
                  FINANCIAL TRAJECTORY
                </span>
                <h3 style={{ fontSize: "17px", color: "var(--text-primary)", marginTop: 3, marginBottom: 0 }}>
                  Cash-Flow River & Inflow Forecast
                </h3>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--success)",
                  background: "var(--success-bg)",
                  padding: "4px 10px",
                  borderRadius: 14,
                  border: "1px solid rgba(22, 163, 74, 0.2)",
                }}
              >
                +24.8% YoY
              </span>
            </div>

            {/* SVG Interactive River Area Chart with Highlight Dot */}
            <CashFlowRiverSvg data={cashFlowData} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: "12px" }}>
              <div style={{ display: "flex", gap: 16 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-primary)" }} />
                  Collected Inflow
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-secondary)" }} />
                  Target Forecast
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate("Fees")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--accent-primary)",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  cursor: "pointer",
                }}
              >
                Reconciliation <ArrowUpRight size={14} />
              </button>
            </div>
          </GlassCard>

          {/* Risk Constellation Tile */}
          <GlassCard style={{ padding: 22, position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent-highlight)" }}>
                  STUDENT RETENTION MAP
                </span>
                <h3 style={{ fontSize: "17px", color: "var(--text-primary)", marginTop: 3, marginBottom: 2 }}>
                  Risk Constellation
                </h3>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                  Nodes sized by academic/fee risk, linked by cohort. Click any node to open the student drawer.
                </p>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--accent-primary)",
                  background: "var(--accent-badge-bg)",
                  padding: "3px 8px",
                  borderRadius: 10,
                }}
              >
                Interactive
              </span>
            </div>

            <RiskConstellation onSelectStudent={onSelectStudent} />
          </GlassCard>
        </div>

        {/* Right 5 Columns: Radial Attendance Gauge + Attention Feed */}
        <div style={{ gridColumn: "span 5", display: "flex", flexDirection: "column", gap: 18 }} className="bento-col-5">
          {/* Radial Attendance Gauge Tile */}
          <GlassCard style={{ padding: 22, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--success)" }}>
                DAILY ATTENDANCE
              </span>
              <Activity size={16} color="var(--success)" />
            </div>

            <RadialAttendanceGauge percentage={86} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
              <div style={{ padding: "8px 10px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Present Learners</span>
                <strong style={{ fontSize: "15px", color: "var(--success)", fontFamily: "'Space Grotesk', sans-serif" }}>44 / 52</strong>
              </div>
              <div style={{ padding: "8px 10px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Late / Unmarked</span>
                <strong style={{ fontSize: "15px", color: "var(--warning)", fontFamily: "'Space Grotesk', sans-serif" }}>8</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate("Attendance")}
              style={{
                width: "100%",
                marginTop: 12,
                padding: "8px 0",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              Open Daily Attendance Register <ChevronRight size={14} />
            </button>
          </GlassCard>

          {/* Attention Feed Tile */}
          <GlassCard style={{ padding: 22, flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--warning)" }}>
                  OPERATIONAL RADAR
                </span>
                <h3 style={{ fontSize: "17px", color: "var(--text-primary)", marginTop: 2, marginBottom: 0 }}>
                  Attention Feed
                </h3>
              </div>
              <span style={{ fontSize: "11px", color: "var(--accent-primary)", fontWeight: 600 }}>
                3 Alerts
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {alerts.map((item) => {
                const dotAnim =
                  item.severity === "high"
                    ? "pulse-dot-red"
                    : item.severity === "medium"
                    ? "pulse-dot-amber"
                    : "pulse-dot-green";
                const dotColor =
                  item.severity === "high"
                    ? "var(--danger)"
                    : item.severity === "medium"
                    ? "var(--warning)"
                    : "var(--success)";

                return (
                  <div
                    key={item.id}
                    style={{
                      padding: "11px 13px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: dotColor,
                            animation: `${dotAnim} 1.8s infinite`,
                            flexShrink: 0,
                          }}
                        />
                        <strong style={{ fontSize: "12px", color: "var(--text-primary)" }}>{item.title}</strong>
                      </div>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{item.time}</span>
                    </div>

                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 }}>
                      {item.description}
                    </p>

                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}>
                      <button
                        type="button"
                        onClick={item.action}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--accent-primary)",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          padding: 0,
                        }}
                      >
                        {item.actionLabel} <ArrowUpRight size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>
      </section>
    </div>
  );
}

// -------------------------------------------------------------
// Subcomponent: Radial Attendance Gauge (Theme-aware)
// -------------------------------------------------------------
function RadialAttendanceGauge({ percentage = 86 }) {
  const size = 165;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div style={{ position: "relative", width: size, height: size, margin: "8px auto" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id="clear-gauge-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent-primary)" />
            <stop offset="60%" stopColor="var(--accent-secondary)" />
            <stop offset="100%" stopColor="var(--success)" />
          </linearGradient>
        </defs>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={strokeWidth}
        />

        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#clear-gauge-grad)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          strokeLinecap="round"
        />
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "34px",
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1,
            letterSpacing: "-0.03em",
          }}
        >
          {percentage}%
        </span>
        <span style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: 3, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          ATTENDANCE
        </span>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Subcomponent: Cash Flow River SVG Area Chart
// -------------------------------------------------------------
function CashFlowRiverSvg({ data }) {
  const width = 520;
  const height = 150;
  const padding = 18;

  const maxVal = Math.max(...data.map((d) => Math.max(d.collected, d.projected))) * 1.1;

  const points = data.map((d, idx) => {
    const x = padding + (idx / (data.length - 1)) * (width - padding * 2);
    const yCollected = height - padding - (d.collected / maxVal) * (height - padding * 2);
    const yProjected = height - padding - (d.projected / maxVal) * (height - padding * 2);
    return { x, yCollected, yProjected, month: d.month };
  });

  const pathCollected = points.reduce(
    (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.yCollected}` : `${acc} C ${pt.x - 25} ${pt.yCollected}, ${pt.x - 25} ${pt.yCollected}, ${pt.x} ${pt.yCollected}`),
    ""
  );

  const fillCollected = `${pathCollected} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        <defs>
          <linearGradient id="river-fill-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal guide lines */}
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = height - padding - ratio * (height - padding * 2);
          return (
            <line
              key={ratio}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="var(--border)"
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Gradient River Fill */}
        <motion.path
          d={fillCollected}
          fill="url(#river-fill-grad)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        />

        {/* Flowing River Stroke */}
        <motion.path
          d={pathCollected}
          fill="none"
          stroke="var(--accent-primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* Travelling Highlight Dot */}
        <motion.circle
          r="4.5"
          fill="#ffffff"
          stroke="var(--accent-primary)"
          strokeWidth="2.5"
          animate={{
            cx: points.map((p) => p.x),
            cy: points.map((p) => p.yCollected),
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Month labels */}
        {points.map((pt) => (
          <text
            key={pt.month}
            x={pt.x}
            y={height - 2}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize="10"
            fontFamily="'Inter', sans-serif"
          >
            {pt.month}
          </text>
        ))}
      </svg>
    </div>
  );
}

// -------------------------------------------------------------
// Subcomponent: Risk Constellation (Ocean/Teal/Coral palette)
// -------------------------------------------------------------
function RiskConstellation({ onSelectStudent }) {
  const [hoveredNode, setHoveredNode] = useState(null);

  const constellationNodes = [
    { id: "STU-1", name: "Pooja Verma", batch: "Full Stack Morning", risk: 85, x: 75, y: 48, reason: "3 missed sessions · EMI overdue" },
    { id: "STU-2", name: "Rahul Sharma", batch: "Full Stack Morning", risk: 78, x: 165, y: 68, reason: "Attendance at 62% · EMI pending" },
    { id: "STU-3", name: "Ananya Iyer", batch: "Full Stack Morning", risk: 20, x: 115, y: 115, reason: "Stable · 95% attendance" },
    { id: "STU-4", name: "Vikram Das", batch: "Data Science Evening", risk: 65, x: 255, y: 52, reason: "2 missed sessions · fee due" },
    { id: "STU-5", name: "Sneha Reddy", batch: "Data Science Evening", risk: 30, x: 335, y: 85, reason: "Stable · 88% attendance" },
    { id: "STU-6", name: "Aditya Roy", batch: "Data Science Evening", risk: 15, x: 275, y: 125, reason: "Stable · Top test score" },
    { id: "STU-7", name: "Karan Malhotra", batch: "Product Design Weekend", risk: 72, x: 415, y: 38, reason: "Missed 3 workshops" },
    { id: "STU-8", name: "Neha Joshi", batch: "Product Design Weekend", risk: 25, x: 455, y: 105, reason: "Stable · 90% attendance" },
  ];

  const links = [
    [0, 1], [1, 2], [0, 2],
    [3, 4], [4, 5], [3, 5],
    [6, 7],
    [1, 3],
  ];

  return (
    <div style={{ position: "relative", width: "100%", height: 160, overflow: "visible" }}>
      <svg viewBox="0 0 520 155" style={{ width: "100%", height: "100%", overflow: "visible" }}>
        {/* Constellation link lines */}
        {links.map(([fromIdx, toIdx], i) => {
          const from = constellationNodes[fromIdx];
          const to = constellationNodes[toIdx];
          return (
            <line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="var(--border-strong)"
              strokeWidth="1.2"
              strokeDasharray="3 3"
            />
          );
        })}

        {/* Nodes */}
        {constellationNodes.map((node) => {
          const isHigh = node.risk > 60;
          const radius = isHigh ? 7 : 5;
          const nodeColor = isHigh ? "var(--danger)" : node.risk > 35 ? "var(--warning)" : "var(--accent-secondary)";

          return (
            <g
              key={node.id}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => {
                sound.tick(1600, 0.015);
                setHoveredNode(node);
              }}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => onSelectStudent && onSelectStudent(node)}
            >
              {isHigh && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius + 5}
                  fill="none"
                  stroke={nodeColor}
                  strokeWidth="1.5"
                  opacity="0.6"
                  style={{ animation: "pulse-dot-red 2s infinite" }}
                />
              )}

              <circle
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={nodeColor}
                stroke="var(--surface)"
                strokeWidth="1.5"
                style={{ filter: `drop-shadow(0 1px 3px ${nodeColor}66)` }}
              />
            </g>
          );
        })}
      </svg>

      {/* Floating Hover Tooltip */}
      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            initial={{ opacity: 0, y: 3, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 2, scale: 0.96 }}
            style={{
              position: "absolute",
              top: Math.max(0, hoveredNode.y - 60),
              left: Math.min(380, Math.max(10, hoveredNode.x - 85)),
              background: "var(--surface)",
              border: `1px solid ${hoveredNode.risk > 60 ? "rgba(220, 38, 38, 0.4)" : "var(--border)"}`,
              borderRadius: "var(--radius-sm)",
              padding: "8px 12px",
              boxShadow: "var(--shadow-popover)",
              pointerEvents: "none",
              zIndex: 30,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <strong style={{ fontSize: "12px", color: "var(--text-primary)" }}>{hoveredNode.name}</strong>
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  color: hoveredNode.risk > 60 ? "var(--danger)" : "var(--success)",
                  background: hoveredNode.risk > 60 ? "var(--danger-bg)" : "var(--success-bg)",
                  padding: "1px 5px",
                  borderRadius: 4,
                }}
              >
                {hoveredNode.risk}% Risk
              </span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: 2 }}>
              {hoveredNode.batch}
            </div>
            <div style={{ fontSize: "10px", color: "var(--accent-primary)", marginTop: 3 }}>
              {hoveredNode.reason} · Click to inspect
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------
function getStatsData(dashboard) {
  const localStudents = readLocalList("instituteos_students", INITIAL_STUDENTS);
  const localBatches = readLocalList("instituteos_batches", batches);

  return [
    {
      label: "Total Students",
      value: localStudents.length,
      prefix: "",
      suffix: "",
      icon: Users,
      color: "var(--accent-primary)",
      bg: "var(--accent-badge-bg)",
      note: "+12% this month",
      sparkline: [28, 32, 35, 38, 42, 45, 48, 52],
    },
    {
      label: "Active Batches",
      value: localBatches.length || 8,
      prefix: "",
      suffix: "",
      icon: BookOpen,
      color: "var(--accent-secondary)",
      bg: "rgba(13, 148, 136, 0.12)",
      note: "88% room capacity",
      sparkline: [5, 6, 6, 7, 7, 8, 8, 8],
    },
    {
      label: "Attendance Rate",
      value: 86,
      prefix: "",
      suffix: "%",
      icon: ClipboardCheck,
      color: "var(--success)",
      bg: "var(--success-bg)",
      note: "Daily marked register",
      sparkline: [80, 82, 85, 83, 86, 84, 88, 86],
    },
    {
      label: "Pending Fees",
      value: 64000,
      prefix: "₹",
      suffix: "",
      formatter: (v) => `₹${Math.round(v).toLocaleString("en-IN")}`,
      icon: Wallet,
      color: "var(--warning)",
      bg: "var(--warning-bg)",
      note: "4 overdue instalments",
      sparkline: [85000, 78000, 72000, 68000, 64000],
    },
  ];
}

function readLocalList(key, fallback = []) {
  try {
    const val = JSON.parse(localStorage.getItem(key) || "null");
    return Array.isArray(val) ? val : fallback;
  } catch {
    return fallback;
  }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function capitalize(str = "") {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
