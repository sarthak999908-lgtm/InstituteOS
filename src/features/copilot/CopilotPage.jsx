import { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Check, Clipboard, Clock3, LockKeyhole, Plus, Send,
  Sparkles, X, ChevronDown, ArrowDown, ShieldCheck, AlertCircle
} from "lucide-react";
import { decideApproval, listApprovals } from "../../lib/database.js";
import { runCopilotMessage } from "../../services/copilot.js";
import { queryCopilotBackend, decideApproval as apiDecideApproval } from "../../services/api.js";

import GlassCard from "../../components/common/GlassCard.jsx";
import MagneticButton from "../../components/common/MagneticButton.jsx";
import Orb from "../../components/common/Orb.jsx";
import HoldToConfirm from "../../components/common/HoldToConfirm.jsx";
import { sound } from "../../lib/sound.js";
import { staggerContainer, staggerItem } from "../../lib/motion.js";
import "./copilot.css";

const suggestions = [
  "Which students in the Java batch have missed three or more classes and have an EMI due this week? Draft a WhatsApp reminder for each.",
  "Show overdue EMIs",
  "Who is absent today?",
  "Which batches have the highest fill rate?",
];

function historyKey(userId) {
  return `instituteos_copilot_${userId}`;
}

function readHistory(userId) {
  try {
    const history = JSON.parse(localStorage.getItem(historyKey(userId)) || "[]");
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

// SQL Syntax Highlighter Helper
function highlightSql(sql = "") {
  const keywords = /\b(SELECT|FROM|JOIN|LEFT JOIN|INNER JOIN|WHERE|AND|OR|ORDER BY|GROUP BY|LIMIT|AS|ON|COUNT|SUM|AVG|DISTINCT|CASE|WHEN|THEN|ELSE|END|IN|NOT|NULL|IS|DESC|ASC)\b/gi;
  const parts = sql.split(keywords);

  return parts.map((part, i) => {
    if (part.match(keywords)) {
      return (
        <span key={i} style={{ color: "var(--accent-primary)", fontWeight: 700 }}>
          {part.toUpperCase()}
        </span>
      );
    }
    // Numbers
    if (/^\d+$/.test(part.trim())) {
      return (
        <span key={i} style={{ color: "var(--accent-highlight)" }}>
          {part}
        </span>
      );
    }
    // Strings in quotes
    if (/^'.*'$/.test(part.trim()) || /^".*"$/.test(part.trim())) {
      return (
        <span key={i} style={{ color: "var(--success)" }}>
          {part}
        </span>
      );
    }
    return <span key={i} style={{ color: "#e2e8f0" }}>{part}</span>;
  });
}

function DataTable({ columns, rows }) {
  if (!rows || !rows.length) {
    return (
      <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "8px 0" }}>
        No rows returned for this query.
      </p>
    );
  }

  return (
    <div
      style={{
        overflowX: "auto",
        margin: "12px 0",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border)",
        background: "rgba(5, 6, 15, 0.4)",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "12px",
          textAlign: "left",
        }}
      >
        <thead>
          <tr style={{ background: "rgba(255, 255, 255, 0.04)", borderBottom: "1px solid var(--border)" }}>
            {columns.map((column) => (
              <th
                key={column}
                style={{
                  padding: "9px 12px",
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--cyan)",
                  whiteSpace: "nowrap",
                }}
              >
                {column.replaceAll("_", " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <motion.tr
              key={row.student_id || row.id || idx}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * idx, duration: 0.2 }}
              style={{
                borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                background: idx % 2 === 0 ? "transparent" : "rgba(255, 255, 255, 0.015)",
              }}
            >
              {columns.map((column) => (
                <td
                  key={column}
                  style={{
                    padding: "9px 12px",
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row[column] ?? "—"}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QueryResult({ result, onPrompt, role, userId }) {
  const [copied, setCopied] = useState(false);
  const [sqlOpen, setSqlOpen] = useState(false);

  if (!result) return null;

  async function copyQuery() {
    await navigator.clipboard.writeText(result.sql || "");
    sound.tick();
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
      {result.refusal && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: 8,
            background: "rgba(251, 113, 133, 0.15)",
            border: "1px solid rgba(251, 113, 133, 0.3)",
            color: "var(--red)",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          <LockKeyhole size={15} />
          <span>Role Policy Permission Boundary</span>
        </div>
      )}

      {/* SQL Code Block with syntax colouring and accordion */}
      {result.sql && (
        <div
          style={{
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            background: "rgba(5, 6, 15, 0.6)",
            overflow: "hidden",
            marginTop: 4,
          }}
        >
          <div
            onClick={() => setSqlOpen(!sqlOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              background: "rgba(255, 255, 255, 0.03)",
              cursor: "pointer",
              fontSize: "11px",
              color: "var(--text-secondary)",
              userSelect: "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ChevronDown
                size={14}
                style={{
                  transform: sqlOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                }}
              />
              <span style={{ fontWeight: 600, color: "#ffffff" }}>Executed SQLite Query</span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                copyQuery();
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "2px 7px",
                color: copied ? "var(--lime)" : "var(--text-muted)",
                fontSize: "10px",
                cursor: "pointer",
              }}
            >
              {copied ? <Check size={12} /> : <Clipboard size={12} />}
              <span>{copied ? "Copied" : "Copy SQL"}</span>
            </button>
          </div>

          {sqlOpen && (
            <motion.pre
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{
                margin: 0,
                padding: "12px 14px",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "12px",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                borderTop: "1px solid var(--border)",
                background: "rgba(0, 0, 0, 0.3)",
              }}
            >
              <code>{highlightSql(result.sql)}</code>
            </motion.pre>
          )}
        </div>
      )}

      {/* Structured result table */}
      {result.sql && <DataTable columns={result.columns || []} rows={result.rows || []} />}

      {/* Action Preview Card Ceremony */}
      {result.actionPreview && (
        <ActionPreview preview={result.actionPreview} role={role} userId={userId} />
      )}

      {/* Followup suggestions floating chips */}
      {result.followups?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {result.followups.map((item, idx) => (
            <motion.button
              key={item}
              type="button"
              onClick={() => onPrompt(item)}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 * idx, duration: 0.2 }}
              style={{
                background: "rgba(139, 92, 246, 0.12)",
                border: "1px solid rgba(139, 92, 246, 0.3)",
                borderRadius: 16,
                padding: "5px 12px",
                color: "#e2e8f0",
                fontSize: "11px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(139, 92, 246, 0.25)";
                e.currentTarget.style.borderColor = "var(--cyan)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(139, 92, 246, 0.12)";
                e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.3)";
              }}
            >
              {item}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

// Action Preview Physical Card Ceremony
function ActionPreview({ preview, role, userId }) {
  const [recipients, setRecipients] = useState(preview.recipients);
  const [status, setStatus] = useState("pending");
  const canApprove =
    role === "owner" ||
    (role === "accounts" && ["fee_reconciliation", "fee_action"].includes(preview.kind));
  const [working, setWorking] = useState(false);

  async function decide(decision) {
    setWorking(true);
    try {
      await decideApproval({
        approvalId: preview.approvalId,
        role,
        userId,
        decision,
        payload: recipients,
      });
      apiDecideApproval(preview.approvalId, decision === "approve" ? "approved" : "rejected").catch(() => {});
      setStatus(decision === "approve" ? "approved" : "rejected");
      window.dispatchEvent(new CustomEvent("instituteos-approvals-changed"));
      if (decision === "approve") {
        window.dispatchEvent(
          new CustomEvent("instituteos-send-list", { detail: recipients })
        );
      }
    } finally {
      setWorking(false);
    }

  }

  return (
    <motion.section
      layout
      style={{
        marginTop: 14,
        background: "rgba(15, 12, 35, 0.8)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(139, 92, 246, 0.35)",
        borderRadius: "var(--radius-md)",
        padding: "18px 20px",
        boxShadow: "0 14px 40px -10px rgba(0, 0, 0, 0.7), 0 0 25px -5px rgba(139, 92, 246, 0.35)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--cyan)", fontSize: "12px", fontWeight: 700 }}>
          <Sparkles size={16} />
          <span>ACTION CEREMONY PREVIEW</span>
        </div>
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            padding: "2px 8px",
            borderRadius: 12,
            color: status === "approved" ? "var(--lime)" : status === "rejected" ? "var(--red)" : "var(--amber)",
            background: status === "approved" ? "rgba(163,230,53,0.15)" : status === "rejected" ? "rgba(251,113,133,0.15)" : "rgba(251,191,36,0.15)",
          }}
        >
          {status}
        </span>
      </div>

      <p style={{ fontSize: "13px", color: "#f4f5ff", lineHeight: 1.45, margin: "0 0 14px" }}>
        {preview.preview}
      </p>

      {/* Recipient Cards Stack */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {recipients.map((recipient, idx) => (
          <div
            key={recipient.studentId}
            style={{
              padding: "10px 12px",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--cyan)", fontWeight: 600, marginBottom: 4 }}>
              <span>{recipient.name}</span>
              <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>{recipient.phone}</span>
            </div>
            <textarea
              rows="2"
              value={recipient.message}
              disabled={status !== "pending"}
              onChange={(e) =>
                setRecipients((curr) =>
                  curr.map((r, i) => (i === idx ? { ...r, message: e.target.value } : r))
                )
              }
              style={{
                width: "100%",
                background: "rgba(0, 0, 0, 0.25)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 6,
                padding: "6px 8px",
                color: "#f4f5ff",
                fontSize: "12px",
                fontFamily: "'Inter', sans-serif",
                resize: "vertical",
              }}
            />
          </div>
        ))}
      </div>

      {status === "pending" && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "center" }}>
          <MagneticButton
            variant="secondary"
            disabled={working}
            onClick={() => decide("reject")}
          >
            Reject
          </MagneticButton>

          {canApprove ? (
            <HoldToConfirm
              onConfirm={() => decide("approve")}
              label="Hold to Approve"
              confirmedLabel="Approved!"
              disabled={working}
            />
          ) : (
            <MagneticButton
              variant="primary"
              disabled={working}
              onClick={() => decide("approve")}
            >
              Request Approval
            </MagneticButton>
          )}
        </div>
      )}
    </motion.section>
  );
}

// Approval Panel Queue
function ApprovalPanel({ approvals, role, onRefresh }) {
  const mayApprove = role === "owner" || role === "accounts";

  return (
    <aside
      style={{
        width: 320,
        background: "rgba(10, 12, 28, 0.8)",
        backdropFilter: "blur(20px)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        height: "fit-content",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--cyan)" }}>
            REVIEW QUEUE
          </span>
          <h2 style={{ fontSize: "16px", color: "#ffffff", margin: 0 }}>
            Pending Approvals
          </h2>
        </div>
        <span
          style={{
            fontSize: "12px",
            fontWeight: 700,
            background: "rgba(139, 92, 246, 0.2)",
            color: "var(--cyan)",
            padding: "2px 8px",
            borderRadius: 10,
          }}
        >
          {approvals.length}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 420, overflowY: "auto" }}>
        {approvals.length ? (
          approvals.map((app) => (
            <div
              key={app.id}
              style={{
                padding: "10px 12px",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12px", fontWeight: 600, color: "#ffffff" }}>
                <Clock3 size={13} color="var(--amber)" />
                <span>{app.kind.replaceAll("_", " ").toUpperCase()}</span>
              </div>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "4px 0" }}>
                {app.preview}
              </p>
              <small style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                {new Date(app.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </small>
            </div>
          ))
        ) : (
          <div style={{ textAlign: "center", padding: "28px 10px", color: "var(--text-muted)", fontSize: "12px" }}>
            <Bot size={22} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
            No pending actions
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onRefresh}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--cyan)",
          fontSize: "11px",
          fontWeight: 600,
          cursor: "pointer",
          textAlign: "left",
          padding: 0,
        }}
      >
        Refresh review queue
      </button>
    </aside>
  );
}

// -------------------------------------------------------------
// Main Copilot Page Component
// -------------------------------------------------------------
export default function CopilotPage({ role, userId }) {
  const [messages, setMessages] = useState(() => readHistory(userId));
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [orbState, setOrbState] = useState("idle"); // idle, listening, thinking, success, refused
  const [context, setContext] = useState({});
  const [approvals, setApprovals] = useState([]);
  const [sendList, setSendList] = useState(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  const textareaRef = useRef(null);
  const chatScrollRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    setMessages(readHistory(userId));
    setContext({});
  }, [userId]);

  useEffect(() => {
    try {
      localStorage.setItem(historyKey(userId), JSON.stringify(messages));
    } catch (e) {
      console.error(e);
    }
  }, [messages, userId]);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  // Scroll listener for "jump to latest" pill
  const handleScroll = () => {
    if (!chatScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current;
    setIsScrolledUp(scrollHeight - scrollTop - clientHeight > 180);
  };

  async function refreshApprovals() {
    setApprovals(await listApprovals("pending", role, userId));
  }

  useEffect(() => {
    refreshApprovals();
    const onChange = () => refreshApprovals();
    const onSendList = (e) => setSendList(e.detail);
    window.addEventListener("instituteos-approvals-changed", onChange);
    window.addEventListener("instituteos-send-list", onSendList);
    return () => {
      window.removeEventListener("instituteos-approvals-changed", onChange);
      window.removeEventListener("instituteos-send-list", onSendList);
    };
  }, [role, userId]);

  // Keyboard shortcut '/' to focus input
  useEffect(() => {
    function onShortcut(e) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA"].includes(target.tagName))) return;
      e.preventDefault();
      textareaRef.current?.focus();
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  // Update Orb state when typing
  const handleTextChange = (e) => {
    setQuestion(e.target.value);
    if (!busy) {
      if (e.target.value.trim().length > 0) {
        setOrbState("listening");
      } else {
        setOrbState("idle");
      }
    }
  };

  async function send(rawQuestion = question) {
    const text = rawQuestion.trim();
    if (!text || busy) return;

    sound.tick();
    setMessages((current) => [...current, { role: "user", text }]);
    setQuestion("");
    setBusy(true);
    setOrbState("thinking");

    // Stage labels cycle: Understanding -> Writing query -> Checking permissions -> Running -> Summarising
    const stages = ["Understanding", "Writing query", "Checking permissions", "Running query", "Summarising"];
    let stageIdx = 0;
    setStage(stages[0]);

    const stageInterval = setInterval(() => {
      stageIdx = (stageIdx + 1) % stages.length;
      setStage(stages[stageIdx]);
    }, 450);

    try {
      const result = await runCopilotMessage({ question: text, role, userId, context });
      clearInterval(stageInterval);

      if (result.refusal) {
        setOrbState("refused");
        sound.error();
      } else {
        setOrbState("success");
        sound.chime();
      }

      setMessages((current) => [...current, { role: "assistant", text: result.answer, result }]);
      if (result.context) setContext(result.context);
      await refreshApprovals();

      // Mirror query audit to backend remote logging pipeline
      queryCopilotBackend(text, result?.intent || "copilot_query").catch(() => {});

      setTimeout(() => setOrbState("idle"), 2400);

    } catch (error) {
      clearInterval(stageInterval);
      setOrbState("refused");
      sound.error();
      setMessages((current) => [
        ...current,
        { role: "assistant", text: `I couldn't complete that request: ${error.message}` },
      ]);
      setTimeout(() => setOrbState("idle"), 2400);
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  function clearChat() {
    sound.tick();
    setMessages([]);
    setContext({});
    localStorage.removeItem(historyKey(userId));
  }

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start", width: "100%" }} className="copilot-container-layout">
      {/* Main Chat Stream */}
      <GlassCard
        style={{
          flex: 1,
          minWidth: 0,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          minHeight: "calc(100vh - 120px)",
        }}
        glowColor="rgba(139, 92, 246, 0.2)"
      >
        {/* Header with Orb and Action */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 20,
            borderBottom: "1px solid var(--border)",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Living Copilot Orb with shared layoutId */}
            <Orb
              size={64}
              state={orbState}
              stageLabel={busy ? stage : ""}
              layoutId="copilot-orb-entity"
            />

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    color: "var(--cyan)",
                    textTransform: "uppercase",
                  }}
                >
                  INSTITUTE OPERATIONS COPILOT
                </span>
              </div>
              <h1
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "#ffffff",
                  margin: 0,
                }}
              >
                Ask your institute
              </h1>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                Role-scoped SQLite answers, visible SQL syntax, and approval-first ceremonies.
              </p>
            </div>
          </div>

          <MagneticButton
            variant="secondary"
            onClick={clearChat}
            disabled={!messages.length}
          >
            <Plus size={14} />
            New Session
          </MagneticButton>
        </div>

        {/* Message Stream */}
        <div
          ref={chatScrollRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            paddingRight: 6,
            position: "relative",
          }}
        >
          {/* Welcome Screen with Staggered Suggestion Chips */}
          {!messages.length && (
            <div
              style={{
                margin: "auto",
                textAlign: "center",
                maxWidth: 580,
                padding: "30px 20px",
              }}
            >
              <Orb size={100} state="idle" style={{ marginBottom: 20 }} />

              <h2
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "#ffffff",
                  marginBottom: 8,
                }}
              >
                What needs your attention?
              </h2>

              <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.5 }}>
                Query attendance, fee instalments, trainer availability, room conflicts, or draft approval actions.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {suggestions.map((suggestion) => (
                  <motion.button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      color: "#e2e8f0",
                      fontSize: "12px",
                      lineHeight: 1.4,
                      cursor: "pointer",
                      transition: "border-color 0.2s, background 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--cyan)";
                      e.currentTarget.style.background = "rgba(34, 211, 238, 0.08)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                    }}
                  >
                    {suggestion}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Chat Messages */}
          {messages.map((message, idx) => {
            const isUser = message.role === "user";
            return (
              <motion.article
                key={`${userId}-${idx}`}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  alignSelf: isUser ? "flex-end" : "flex-start",
                  maxWidth: isUser ? "75%" : "92%",
                  display: "flex",
                  gap: 12,
                }}
              >
                {!isUser && (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #1e1b4b, #22d3ee)",
                      display: "grid",
                      placeItems: "center",
                      color: "#ffffff",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    <Bot size={17} />
                  </div>
                )}

                <div
                  style={{
                    padding: isUser ? "12px 18px" : "16px 20px",
                    borderRadius: "var(--radius-md)",
                    background: isUser
                      ? "var(--brand-gradient)"
                      : "rgba(10, 12, 28, 0.8)",
                    backdropFilter: isUser ? "none" : "blur(20px)",
                    border: isUser
                      ? "1px solid rgba(255, 255, 255, 0.2)"
                      : "1px solid var(--border)",
                    boxShadow: isUser
                      ? "0 8px 24px -6px var(--brand-glow)"
                      : "0 8px 30px rgba(0,0,0,0.5), inset 0 1px 0 var(--top-edge)",
                    color: "#ffffff",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: isUser ? "rgba(255,255,255,0.85)" : "var(--cyan)",
                      marginBottom: 4,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {isUser ? "You" : "Cosmic Copilot"}
                  </div>

                  <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.5, color: isUser ? "#ffffff" : "#f4f5ff" }}>
                    {message.text}
                  </p>

                  {message.result && (
                    <QueryResult
                      result={message.result}
                      onPrompt={send}
                      role={role}
                      userId={userId}
                    />
                  )}
                </div>
              </motion.article>
            );
          })}

          {/* Busy Thinking Indicator */}
          {busy && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 18px",
                borderRadius: "var(--radius-sm)",
                background: "rgba(10, 12, 28, 0.6)",
                border: "1px solid var(--border)",
                alignSelf: "flex-start",
              }}
            >
              <Orb size={28} state="thinking" />
              <div>
                <strong style={{ fontSize: "13px", color: "var(--cyan)", display: "block" }}>
                  {stage || "Running query"}...
                </strong>
                <small style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  Executing role-scoped policies in WebAssembly SQLite
                </small>
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Floating "Jump to latest" pill */}
        <AnimatePresence>
          {isScrolledUp && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
              style={{
                position: "absolute",
                bottom: 84,
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(10, 12, 28, 0.9)",
                backdropFilter: "blur(16px)",
                border: "1px solid var(--border)",
                borderRadius: 20,
                padding: "6px 14px",
                color: "var(--cyan)",
                fontSize: "11px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                boxShadow: "0 6px 20px rgba(0,0,0,0.6)",
                zIndex: 10,
              }}
            >
              <ArrowDown size={13} />
              Jump to latest
            </motion.button>
          )}
        </AnimatePresence>

        {/* Composer Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          style={{
            marginTop: 16,
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(5, 6, 15, 0.7)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "8px 12px",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)",
          }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={question}
            onChange={handleTextChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask about your institute… (Press / to focus)"
            aria-label="Ask the operations copilot"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#ffffff",
              fontSize: "14px",
              fontFamily: "'Inter', sans-serif",
              resize: "none",
              minHeight: 28,
            }}
          />

          <MagneticButton
            type="submit"
            variant="primary"
            disabled={!question.trim() || busy}
            style={{ padding: "8px 16px", borderRadius: "var(--radius-sm)" }}
          >
            <Send size={15} />
            Send
          </MagneticButton>
        </form>
      </GlassCard>

      {/* Review Queue Right Aside */}
      <ApprovalPanel
        approvals={approvals}
        role={role}
        onRefresh={refreshApprovals}
      />

      {/* Approved Send List Modal */}
      {sendList && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(5, 6, 15, 0.8)",
            backdropFilter: "blur(16px)",
          }}
          role="presentation"
        >
          <GlassCard
            style={{
              width: "90%",
              maxWidth: 540,
              padding: 24,
              maxHeight: "85vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--lime)" }}>
                  APPROVED ACTION CEREMONY
                </span>
                <h2 style={{ fontSize: "20px", color: "#ffffff", margin: 0 }}>
                  WhatsApp Send List
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSendList(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: 18 }}>
              Open each prepared message individually. No message is sent automatically.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sendList.map((recipient) => (
                <div
                  key={recipient.studentId}
                  style={{
                    padding: "12px 14px",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "13px", color: "#ffffff", display: "block" }}>
                      {recipient.name}
                    </strong>
                    <small style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {recipient.phone}
                    </small>
                  </div>
                  <a
                    href={`https://wa.me/${recipient.phone.replace(/\D/g, "")}?text=${encodeURIComponent(recipient.message)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: "rgba(163, 230, 53, 0.15)",
                      border: "1px solid rgba(163, 230, 53, 0.3)",
                      borderRadius: 6,
                      padding: "6px 12px",
                      color: "var(--lime)",
                      fontSize: "12px",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Open draft
                  </a>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}