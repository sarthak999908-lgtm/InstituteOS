import { useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, Check, RotateCcw, WandSparkles, X, AlertTriangle,
  Clock, MapPin, User, Sparkles, Filter, ChevronRight,
  LayoutGrid, BarChart3, TrendingUp, CheckCircle2
} from "lucide-react";
import { batches as seedBatches, rooms, trainerAvailability, trainerIdByUserId, trainers } from "../../data/mockData.js";
import { createApproval, decideApproval } from "../../lib/database.js";
import { createSession as apiCreateSession } from "../../services/api.js";
import { appStorageKey } from "../../lib/localDemo.js";
import { solveSchedule } from "./solver.js";

import GlassCard from "../../components/common/GlassCard.jsx";
import MagneticButton from "../../components/common/MagneticButton.jsx";
import HoldToConfirm from "../../components/common/HoldToConfirm.jsx";
import { sound } from "../../lib/sound.js";
import { toast } from "../../components/common/Toast.jsx";
import "./schedules.css";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Color schemes per course (Clear Sky palette: Ocean blue, teal, coral, emerald)
const COURSE_THEMES = {
  "Full Stack Development": {
    bg: "linear-gradient(135deg, rgba(37, 99, 235, 0.15), rgba(13, 148, 136, 0.08))",
    border: "rgba(37, 99, 235, 0.3)",
    text: "var(--accent-primary)",
    glow: "rgba(37, 99, 235, 0.2)",
    tag: "#2563EB",
  },
  "Data Science": {
    bg: "linear-gradient(135deg, rgba(13, 148, 136, 0.15), rgba(37, 99, 235, 0.08))",
    border: "rgba(13, 148, 136, 0.3)",
    text: "var(--accent-secondary)",
    glow: "rgba(13, 148, 136, 0.2)",
    tag: "#0D9488",
  },
  "Product Design": {
    bg: "linear-gradient(135deg, rgba(249, 115, 22, 0.15), rgba(217, 119, 6, 0.08))",
    border: "rgba(249, 115, 22, 0.3)",
    text: "var(--accent-highlight)",
    glow: "rgba(249, 115, 22, 0.2)",
    tag: "#F97316",
  },
  "Digital Marketing": {
    bg: "linear-gradient(135deg, rgba(22, 163, 74, 0.15), rgba(13, 148, 136, 0.08))",
    border: "rgba(22, 163, 74, 0.3)",
    text: "var(--success)",
    glow: "rgba(22, 163, 74, 0.2)",
    tag: "#16A34A",
  },
};

function initialGrid() {
  try {
    const parsed = JSON.parse(localStorage.getItem(appStorageKey("instituteos_solved_schedule")) || "null");
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {}

  // Fallback default generated timetable
  const fallback = [
    { id: "S-1", weekday: 1, start: "09:00", end: "11:00", batch_id: "BAT-1", batch_name: "Java Masterclass · A", course_name: "Full Stack Development", trainer_name: "Neha Kapoor", room_name: "Lab 2", mode: "Classroom", student_count: 24 },
    { id: "S-2", weekday: 1, start: "14:00", end: "16:00", batch_id: "BAT-2", batch_name: "Data Science · Evening", course_name: "Data Science", trainer_name: "Arjun Mehta", room_name: "Room 4", mode: "Hybrid", student_count: 22 },
    { id: "S-3", weekday: 2, start: "10:00", end: "12:00", batch_id: "BAT-3", batch_name: "Product Design · Studio", course_name: "Product Design", trainer_name: "Mira Shah", room_name: "Studio 1", mode: "Classroom", student_count: 18 },
    { id: "S-4", weekday: 3, start: "09:00", end: "11:00", batch_id: "BAT-1", batch_name: "Java Masterclass · A", course_name: "Full Stack Development", trainer_name: "Neha Kapoor", room_name: "Lab 2", mode: "Classroom", student_count: 24 },
    { id: "S-5", weekday: 4, start: "14:00", end: "16:00", batch_id: "BAT-2", batch_name: "Data Science · Evening", course_name: "Data Science", trainer_name: "Arjun Mehta", room_name: "Room 4", mode: "Hybrid", student_count: 22 },
    { id: "S-6", weekday: 5, start: "10:00", end: "12:00", batch_id: "BAT-3", batch_name: "Product Design · Studio", course_name: "Product Design", trainer_name: "Mira Shah", room_name: "Studio 1", mode: "Classroom", student_count: 18 },
  ];
  return fallback;
}

function formatDay(day) {
  return days[day - 1] || "Sunday";
}

function makeInput(role, userId) {
  if (role !== "trainer") return { batches: seedBatches, trainers, rooms, availability: trainerAvailability };
  const trainerId = trainerIdByUserId[userId];
  const trainer = trainers.find((item) => item.id === trainerId);
  const assigned = seedBatches.filter((batch) => batch.trainer_id === trainerId);
  return {
    batches: assigned,
    trainers: trainer ? [trainer] : [],
    rooms,
    availability: trainerAvailability.filter((slot) => slot.trainer_id === trainer?.id),
  };
}

export default function SchedulesPage({ role, userId }) {
  const [grid, setGrid] = useState(initialGrid);
  const [proposal, setProposal] = useState(null);
  const [trainerId, setTrainerId] = useState(trainers[0]?.id || "");
  const [weekday, setWeekday] = useState(2);
  const [trainerFilter, setTrainerFilter] = useState("All trainers");
  const [roomFilter, setRoomFilter] = useState("All rooms");
  const [status, setStatus] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [activeDragSlot, setActiveDragSlot] = useState(null);
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "heatmap"

  const input = useMemo(() => makeInput(role, userId), [role, userId]);
  const canReplan = role === "owner" || role === "counselor" || role === "trainer";

  const visibleGrid = grid.filter(
    (slot) =>
      (trainerFilter === "All trainers" || slot.trainer_name === trainerFilter || slot.trainer_id === trainerFilter) &&
      (roomFilter === "All rooms" || slot.room_name === roomFilter || slot.room_id === roomFilter)
  );

  const roomUtilization = useMemo(() => {
    return rooms.map((room) => {
      const dayStats = days.map((dayName, dayIdx) => {
        const dayNum = dayIdx + 1;
        const matching = visibleGrid.filter(
          (s) => (s.room_id === room.id || s.room_name === room.name) && s.weekday === dayNum
        );
        const pct = Math.min(100, Math.round((matching.length / 4) * 100));
        return { dayName, dayNum, count: matching.length, pct, sessions: matching };
      });
      const totalSessions = dayStats.reduce((sum, d) => sum + d.count, 0);
      const avgPct = Math.round(dayStats.reduce((sum, d) => sum + d.pct, 0) / days.length);
      return { room, dayStats, totalSessions, avgPct };
    });
  }, [visibleGrid]);

  async function propose(replan = false) {
    setStatus("");
    sound.tick();
    setIsScanning(true);

    const nextInput = {
      ...input,
      availability: replan
        ? input.availability.filter((slot) => !(slot.trainer_id === trainerId && Number(slot.weekday) === weekday))
        : input.availability,
    };
    const trainer = trainers.find((item) => item.id === trainerId);
    const reason = replan
      ? `${trainer?.name || "Trainer"} is unavailable on ${formatDay(weekday)}; moved sessions to preserve availability and room capacity.`
      : "Generated a weekly timetable that satisfies trainer, room, and capacity constraints.";

    setTimeout(async () => {
      setIsScanning(false);
      const result = solveSchedule(nextInput, { previousGrid: grid, reason });

      if (!result.ok) {
        sound.error();
        setProposal({ ...result, approvalId: null, input: nextInput });
        return;
      }

      sound.shimmer();
      const approvalData = {
        role,
        userId,
        kind: "schedule_replan",
        payload: { grid: result.grid, changes: result.changes },
        preview: `${result.changes.length} timetable change${result.changes.length === 1 ? "" : "s"} proposed. ${reason}`,
      };
      const approval = await createApproval(approvalData);

      setProposal({ ...result, approvalId: approval.id, input: nextInput });
      window.dispatchEvent(new CustomEvent("instituteos-approvals-changed"));
    }, 900);
  }

  async function decide(decision) {
    if (!proposal?.approvalId) return;
    await decideApproval({
      approvalId: proposal.approvalId,
      role,
      userId,
      decision,
      payload: { grid: proposal.grid, changes: proposal.changes },
    });
    if (decision === "approve") {
      sound.chime();
      setGrid(proposal.grid);
      localStorage.setItem(appStorageKey("instituteos_solved_schedule"), JSON.stringify(proposal.grid));
      setStatus("Approved timetable plan saved locally.");
      toast.success("Schedule Approved", "New clash-free timetable is now active across all rooms.");

      // Sync active session instances to backend timetable
      if (Array.isArray(proposal.grid)) {
        proposal.grid.slice(0, 12).forEach((slot) => {
          if (slot.batch_id) {
            apiCreateSession({
              batch_id: slot.batch_id,
              date: new Date().toISOString().slice(0, 10),
              start: slot.start || "10:00",
              end: slot.end || "12:00",
            }).catch(() => {});
          }
        });
      }
    } else {
      sound.tick();
      setStatus("Proposed timetable changes were rejected; saved timetable is unchanged.");
      toast.info("Schedule Proposal Discarded", "Existing timetable was preserved.");
    }

    setProposal(null);
    window.dispatchEvent(new CustomEvent("instituteos-approvals-changed"));
  }


  const trainerOptions = role === "trainer" ? input.trainers : trainers;

  return (
    <div className="module-page schedule-page" style={{ position: "relative" }}>
      {/* Page Title & Control Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--cyan)",
                boxShadow: "0 0 8px var(--cyan)",
              }}
            />
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "var(--cyan)",
                textTransform: "uppercase",
              }}
            >
              WEEKLY OPERATIONS SOLVER
            </span>
          </div>

          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "clamp(1.8rem, 2.8vw, 2.4rem)",
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            Timetable Stage
          </h1>

          <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: "4px 0 0" }}>
            Constraint-based room and trainer allocation with magnetic collision aura.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* View Mode Toggle: Grid vs Room Heatmap */}
          <div
            style={{
              display: "inline-flex",
              padding: 3,
              borderRadius: 8,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
          >
            <button
              type="button"
              onClick={() => {
                sound.tick();
                setViewMode("grid");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: viewMode === "grid" ? "var(--surface)" : "transparent",
                color: viewMode === "grid" ? "var(--text-primary)" : "var(--text-muted)",
                boxShadow: viewMode === "grid" ? "0 1px 3px rgba(15, 23, 42, 0.08)" : "none",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <LayoutGrid size={13} />
              Grid View
            </button>
            <button
              type="button"
              onClick={() => {
                sound.tick();
                setViewMode("heatmap");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: viewMode === "heatmap" ? "var(--surface)" : "transparent",
                color: viewMode === "heatmap" ? "var(--text-primary)" : "var(--text-muted)",
                boxShadow: viewMode === "heatmap" ? "0 1px 3px rgba(15, 23, 42, 0.08)" : "none",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <BarChart3 size={13} />
              Room Heatmap
            </button>
          </div>

          {canReplan && (
            <MagneticButton variant="primary" onClick={() => propose(false)}>
              <WandSparkles size={15} />
              {grid.length ? "Re-Solve Schedule" : "Generate Timetable"}
            </MagneticButton>
          )}
        </div>
      </div>

      {/* Filter and Replan Rails */}
      <GlassCard style={{ padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          {/* Rails Filters */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "12px", color: "var(--text-secondary)" }}>
              <User size={14} color="var(--cyan)" />
              <select
                value={trainerFilter}
                onChange={(e) => setTrainerFilter(e.target.value)}
                style={{
                  background: "rgba(5, 6, 15, 0.7)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "6px 10px",
                  color: "#ffffff",
                  fontSize: "12px",
                }}
              >
                <option>All trainers</option>
                {trainerOptions.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "12px", color: "var(--text-secondary)" }}>
              <MapPin size={14} color="var(--accent-secondary)" />
              <select
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "6px 10px",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                }}
              >
                <option>All rooms</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.name}>{r.name} ({r.capacity} seats)</option>
                ))}
              </select>
            </label>
          </div>

          {/* Quick Simulation Re-plan Trigger */}
          {canReplan && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Simulate Unavailability:</span>
              <select
                value={trainerId}
                onChange={(e) => setTrainerId(e.target.value)}
                style={{
                  background: "rgba(5, 6, 15, 0.7)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "5px 8px",
                  color: "#ffffff",
                  fontSize: "11px",
                }}
              >
                {trainerOptions.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>

              <select
                value={weekday}
                onChange={(e) => setWeekday(Number(e.target.value))}
                style={{
                  background: "rgba(5, 6, 15, 0.7)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "5px 8px",
                  color: "#ffffff",
                  fontSize: "11px",
                }}
              >
                {days.map((d, i) => (
                  <option key={d} value={i + 1}>{d}</option>
                ))}
              </select>

              <MagneticButton variant="secondary" onClick={() => propose(true)}>
                <RotateCcw size={13} />
                Re-plan
              </MagneticButton>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Floating Change List & Before/After Proposal Ceremony */}
      <AnimatePresence>
        {proposal && (
          <motion.section
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.3 }}
            style={{
              marginBottom: 24,
              padding: 20,
              background: "rgba(10, 12, 28, 0.92)",
              backdropFilter: "blur(24px)",
              border: "1px solid var(--cyan)",
              borderRadius: "var(--radius-md)",
              boxShadow: "0 16px 50px rgba(0,0,0,0.8), 0 0 30px rgba(34, 211, 238, 0.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--cyan)" }}>
                  OPTIMIZATION CEREMONY
                </span>
                <h3 style={{ fontSize: "18px", color: "#ffffff", margin: "4px 0 0" }}>
                  {proposal.ok ? "Proposed Schedule Modifications" : "No Feasible Plan Available"}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setProposal(null)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            {proposal.ok ? (
              <>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: 14 }}>
                  {proposal.changes.length} session block{proposal.changes.length === 1 ? "" : "s"} adjusted to satisfy room capacity and trainer constraints.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10, marginBottom: 18 }}>
                  {proposal.changes.map((change, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "10px 14px",
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    >
                      <strong style={{ fontSize: "13px", color: "#ffffff", display: "block" }}>
                        {change.batch_name}
                      </strong>
                      <div style={{ fontSize: "11px", color: "var(--cyan)", margin: "4px 0" }}>
                        {change.from} <span style={{ color: "#ffffff" }}>→</span> {change.to}
                      </div>
                      <small style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                        {change.reason}
                      </small>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "center" }}>
                  <MagneticButton variant="secondary" onClick={() => decide("reject")}>
                    Reject Changes
                  </MagneticButton>

                  {role === "owner" ? (
                    <HoldToConfirm
                      onConfirm={() => decide("approve")}
                      label="Hold to Approve Plan"
                      confirmedLabel="Plan Saved"
                    />
                  ) : (
                    <span style={{ fontSize: "12px", color: "var(--amber)", fontWeight: 600 }}>
                      Owner approval required to persist timetable changes.
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div>
                <p style={{ color: "var(--red)", fontSize: "13px" }}>{proposal.reason}</p>
                <ul style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
                  {proposal.relaxations?.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Timetable Stage Content: Grid View or Room Utilization Heatmap */}
      {viewMode === "heatmap" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Heatmap Telemetry Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <GlassCard style={{ padding: "16px 20px" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Campus Utilization
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--accent-primary)", fontVariantNumeric: "tabular-nums" }}>
                  {Math.round(roomUtilization.reduce((sum, r) => sum + r.avgPct, 0) / (roomUtilization.length || 1))}%
                </span>
                <span style={{ fontSize: "11px", color: "var(--success)", fontWeight: 600 }}>Active baseline</span>
              </div>
            </GlassCard>

            <GlassCard style={{ padding: "16px 20px" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Active Physical Rooms
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--accent-secondary)", fontVariantNumeric: "tabular-nums" }}>
                  {rooms.length}
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Fully monitored</span>
              </div>
            </GlassCard>

            <GlassCard style={{ padding: "16px 20px" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Total Weekly Sessions
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                  {visibleGrid.length}
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Classes scheduled</span>
              </div>
            </GlassCard>
          </div>

          {/* Interactive Room Heatmap Matrix */}
          <GlassCard style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                  Room Occupancy & Capacity Heatmap
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                  Daily utilization calculated against 4 standard 2-hour operational teaching blocks.
                </p>
              </div>

              {/* Heatmap Legend */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "11px", color: "var(--text-secondary)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--surface-2)", border: "1px solid var(--border)" }} />
                  0%
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(13, 148, 136, 0.25)" }} />
                  1–49%
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(37, 99, 235, 0.3)" }} />
                  50–74%
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(249, 115, 22, 0.35)" }} />
                  75%+
                </span>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "14px 20px", color: "var(--text-secondary)", fontWeight: 700, fontSize: "11px", textTransform: "uppercase" }}>Room</th>
                    <th style={{ padding: "14px 16px", color: "var(--text-secondary)", fontWeight: 700, fontSize: "11px", textTransform: "uppercase" }}>Capacity</th>
                    {days.map((day) => (
                      <th key={day} style={{ padding: "14px 14px", color: "var(--text-secondary)", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", textAlign: "center" }}>
                        {day.slice(0, 3)}
                      </th>
                    ))}
                    <th style={{ padding: "14px 20px", color: "var(--text-secondary)", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", textAlign: "right" }}>
                      Weekly Avg
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roomUtilization.map((ru) => (
                    <tr key={ru.room.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "16px 20px" }}>
                        <strong style={{ fontSize: "13px", color: "var(--text-primary)", display: "block" }}>
                          {ru.room.name}
                        </strong>
                        <small style={{ fontSize: "11px", color: "var(--text-muted)" }}>{ru.room.id}</small>
                      </td>

                      <td style={{ padding: "16px 16px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", background: "var(--surface-2)", padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)" }}>
                          {ru.room.capacity} seats
                        </span>
                      </td>

                      {ru.dayStats.map((ds) => {
                        const cellBg =
                          ds.pct === 0
                            ? "transparent"
                            : ds.pct < 50
                            ? "rgba(13, 148, 136, 0.14)"
                            : ds.pct < 75
                            ? "rgba(37, 99, 235, 0.18)"
                            : "rgba(249, 115, 22, 0.22)";
                        const cellColor =
                          ds.pct === 0
                            ? "var(--text-muted)"
                            : ds.pct < 50
                            ? "var(--accent-secondary)"
                            : ds.pct < 75
                            ? "var(--accent-primary)"
                            : "var(--accent-highlight)";

                        return (
                          <td
                            key={ds.dayNum}
                            style={{
                              padding: "12px 14px",
                              textAlign: "center",
                              background: cellBg,
                              transition: "background 0.15s ease",
                            }}
                            title={`${ru.room.name} · ${ds.dayName}: ${ds.count} session(s) (${ds.pct}% utilized)`}
                          >
                            <span style={{ fontSize: "13px", fontWeight: 700, color: cellColor, display: "block" }}>
                              {ds.pct}%
                            </span>
                            <small style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>
                              {ds.count} session{ds.count === 1 ? "" : "s"}
                            </small>
                          </td>
                        );
                      })}

                      <td style={{ padding: "16px 20px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                          <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--text-primary)" }}>
                            {ru.avgPct}%
                          </span>
                          <div style={{ width: 64, height: 4, borderRadius: 2, background: "var(--surface-3)", overflow: "hidden" }}>
                            <div style={{ width: `${ru.avgPct}%`, height: "100%", background: "var(--accent-primary)", borderRadius: 2 }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      ) : (
        /* Weekly Grid Stage with Luminous Scan Line Sweep */
        <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--radius-md)" }}>
          {/* Luminous Re-plan Scan Line Sweep */}
          {isScanning && (
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 30,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  width: "4px",
                  background: "linear-gradient(180deg, var(--accent-primary), var(--accent-secondary), #ffffff, var(--accent-highlight))",
                  boxShadow: "0 0 25px 6px var(--brand-glow)",
                  animation: "scanline-sweep 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards",
                }}
              />
            </div>
          )}

          {/* 6-Column Weekly Timetable Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: 12,
            }}
            className="timetable-grid-columns"
          >
            {days.map((day, dayIdx) => {
              const dayNum = dayIdx + 1;
              const daySlots = visibleGrid
                .filter((slot) => slot.weekday === dayNum)
                .sort((a, b) => a.start.localeCompare(b.start));

              return (
                <GlassCard
                  key={day}
                  style={{
                    padding: 14,
                    minHeight: 380,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    background: "var(--surface)",
                  }}
                >
                  {/* Day Header */}
                  <div
                    style={{
                      paddingBottom: 10,
                      borderBottom: "1px solid var(--border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <strong style={{ fontSize: "14px", color: "var(--text-primary)", fontFamily: "'Space Grotesk', sans-serif" }}>
                      {day}
                    </strong>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "var(--accent-primary)",
                        background: "var(--accent-badge-bg)",
                        padding: "2px 6px",
                        borderRadius: 10,
                      }}
                    >
                      {daySlots.length}
                    </span>
                  </div>

                  {/* Session Blocks with FLIP Animations & Drag Magnetic Snapping */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                    {daySlots.map((slot) => {
                      const courseTheme =
                        COURSE_THEMES[slot.course_name] || COURSE_THEMES["Full Stack Development"];

                      return (
                        <motion.div
                          key={slot.id}
                          layout
                          drag
                          dragConstraints={{ left: -10, right: 10, top: -10, bottom: 10 }}
                          dragElastic={0.2}
                          onDragStart={() => setActiveDragSlot(slot)}
                          onDragEnd={() => {
                            setActiveDragSlot(null);
                            sound.tick(1200, 0.02);
                          }}
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 24,
                          }}
                          style={{
                            background: courseTheme.bg,
                            border: `1px solid ${courseTheme.border}`,
                            borderRadius: "var(--radius-sm)",
                            padding: "10px 12px",
                            boxShadow: `0 4px 16px rgba(0,0,0,0.1), 0 0 16px -4px ${courseTheme.glow}`,
                            cursor: "grab",
                            position: "relative",
                            overflow: "hidden",
                          }}
                        >
                          {/* Time tag */}
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "10px", color: "var(--text-primary)", fontWeight: 700, marginBottom: 4 }}>
                            <Clock size={11} color="var(--accent-primary)" />
                            <span>{slot.start} – {slot.end}</span>
                          </div>

                          {/* Batch Name */}
                          <strong
                            style={{
                              display: "block",
                              fontSize: "12px",
                              fontWeight: 700,
                              color: "var(--text-primary)",
                              lineHeight: 1.3,
                              marginBottom: 4,
                            }}
                          >
                            {slot.batch_name}
                          </strong>

                          {/* Trainer & Room Rails */}
                          <div style={{ fontSize: "10px", color: courseTheme.text, display: "flex", flexDirection: "column", gap: 2 }}>
                            <span>{slot.trainer_name}</span>
                            <span style={{ color: "var(--text-muted)" }}>
                              {slot.room_name} · {slot.mode} · {slot.student_count} learners
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}

                    {daySlots.length === 0 && (
                      <div
                        style={{
                          margin: "auto",
                          textAlign: "center",
                          padding: "20px 6px",
                          color: "var(--text-muted)",
                          fontSize: "11px",
                        }}
                      >
                        No sessions scheduled
                      </div>
                    )}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
