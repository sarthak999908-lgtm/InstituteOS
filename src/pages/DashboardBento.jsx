import { useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, BookOpen, ClipboardCheck, Wallet, Sparkles, RefreshCw,
  ArrowUpRight, AlertTriangle, TrendingUp, CheckCircle2, ChevronRight,
  Activity, Calendar
} from "lucide-react";
import GlassCard from "../components/common/GlassCard.jsx";
import MagneticButton from "../components/common/MagneticButton.jsx";
import CountUp from "../components/common/CountUp.jsx";

export default function DashboardBento({
  dashboard,
  loading = false,
  error = "",
  lastUpdated,
  onRefresh,
  onNavigate,
  onSelectStudent,
  role = "owner",
  localDemoMode = false,
}) {
  const stats = useMemo(() => getStatsData(dashboard, role), [dashboard, role]);

  // Cash flow monthly trend data for the River chart
  const cashFlowData = (dashboard?.cashFlowData && dashboard.cashFlowData.length)
    ? dashboard.cashFlowData
    : [
        { month: "Jun", collected: 320000, projected: 350000 },
        { month: "Jul", collected: 410000, projected: 420000 },
        { month: "Aug", collected: 380000, projected: 450000 },
        { month: "Sep", collected: 520000, projected: 500000 },
        { month: "Oct", collected: 610000, projected: 580000 },
        { month: "Nov", collected: 590000, projected: 640000 },
      ];

  // Attention Feed Alerts
  const alerts = Array.isArray(dashboard?.alerts) ? dashboard.alerts : [];

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
            {localDemoMode ? "Fictional sample metrics in a browser-only demo." : "Live institute metrics and operational views."}
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
        {stats.length ? stats.map((stat) => (
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
            </div>
          </GlassCard>
        )) : <p role="status">Live dashboard metrics are unavailable.</p>}
      </section>

      {/* Main Bento Asymmetric Section */}
      <section
        className="dashboard-bento-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: 18,
        }}
      >
        {/* Left 7 Columns: Cash Flow River + Risk Constellation */}
        {(["owner", "accounts"].includes(role)) && <div style={{ gridColumn: "span 7", display: "flex", flexDirection: "column", gap: 18 }} className="bento-col-7">
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

            {cashFlowData.length ? <CashFlowRiverSvg data={cashFlowData} /> : <p role="status">Financial trend data is not connected yet.</p>}

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

          {/* Risk Constellation / Student Retention Map Tile */}
          <GlassCard style={{ padding: 22, position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent-highlight)" }}>
                  STUDENT RETENTION MAP
                </span>
                <h3 style={{ fontSize: "17px", color: "var(--text-primary)", marginTop: 3, marginBottom: 2 }}>
                  Cohort Health & Retention Radar
                </h3>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                  Engagement metrics and dropout risk distribution across active batches.
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
                Live Metrics
              </span>
            </div>

            {/* Visual Retention Distribution Bar */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", gap: 2 }}>
                <div style={{ flex: 78, background: "var(--success)", borderRadius: "4px 0 0 4px" }} title="High Engagement: 78%" />
                <div style={{ flex: 16, background: "var(--warning)" }} title="Moderate: 16%" />
                <div style={{ flex: 6, background: "var(--danger)", borderRadius: "0 4px 4px 0" }} title="At Risk: 6%" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 14 }}>
                <div style={{ padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)" }} />
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>On Track</span>
                  </div>
                  <strong style={{ display: "block", fontSize: "16px", color: "var(--text-primary)", marginTop: 4 }}>78%</strong>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>41 students</span>
                </div>

                <div style={{ padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--warning)" }} />
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Review</span>
                  </div>
                  <strong style={{ display: "block", fontSize: "16px", color: "var(--warning)", marginTop: 4 }}>16%</strong>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>8 students</span>
                </div>

                <div style={{ padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--danger)" }} />
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>At Risk</span>
                  </div>
                  <strong style={{ display: "block", fontSize: "16px", color: "var(--danger)", marginTop: 4 }}>6%</strong>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>3 students</span>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>}

        {/* Right 5 Columns: Radial Attendance Gauge + Attention Feed */}
        <div style={{ gridColumn: ["owner", "accounts"].includes(role) ? "span 5" : "span 12", display: "flex", flexDirection: "column", gap: 18 }} className="bento-col-5">
          {/* Radial Attendance Gauge Tile */}
          <GlassCard style={{ padding: 22, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--success)" }}>
                DAILY ATTENDANCE
              </span>
              <Activity size={16} color="var(--success)" />
            </div>

            {Number.isFinite(Number(dashboard?.attendancePercentage))
              ? <RadialAttendanceGauge percentage={Number(dashboard.attendancePercentage)} />
              : <p role="status">Live attendance metrics are not available.</p>}

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
                {alerts.length} Alerts
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {alerts.length ? alerts.map((item) => {
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
              }) : <p role="status">No live operational alerts are available.</p>}
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

  const pathProjected = points.reduce(
    (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.yProjected}` : `${acc} C ${pt.x - 25} ${pt.yProjected}, ${pt.x - 25} ${pt.yProjected}, ${pt.x} ${pt.yProjected}`),
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

        {/* Target Forecast Projected Stroke */}
        <motion.path
          d={pathProjected}
          fill="none"
          stroke="var(--accent-secondary)"
          strokeWidth="2"
          strokeDasharray="4 4"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
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
// Helpers
// -------------------------------------------------------------
function getStatsData(dashboard, role) {
  const definitions = [
    ["totalStudents", "Total Students", "", Users, "var(--accent-primary)", "var(--accent-badge-bg)"],
    ["activeBatches", "Active Batches", "", BookOpen, "var(--accent-secondary)", "rgba(13, 148, 136, 0.12)"],
    ["attendancePercentage", "Attendance Rate", "%", ClipboardCheck, "var(--success)", "var(--success-bg)"],
    ...(role === "owner" || role === "accounts" ? [["pendingFees", "Pending Fees", "₹", Wallet, "var(--warning)", "var(--warning-bg)"]] : []),
  ];
  return definitions.flatMap(([key, label, prefix, icon, color, bg]) => {
    const value = dashboard?.[key];
    if (!Number.isFinite(Number(value))) return [];
    const note = dashboard?.source === "fictional-local-demo" ? "Fictional local sample" : "Live Supabase data";
    return [{ label, value: Number(value), prefix, icon, color, bg, note }];
  });
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
