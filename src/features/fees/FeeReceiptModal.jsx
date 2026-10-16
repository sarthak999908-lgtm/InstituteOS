import React from "react";
import { motion } from "framer-motion";
import { Printer, X, CheckCircle, ShieldCheck, Download } from "lucide-react";
import { sound } from "../../lib/sound.js";

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

export default function FeeReceiptModal({ record, onClose }) {
  if (!record) return null;

  const total = Number(record.total) || 0;
  const paid = Number(record.paid) || 0;
  const balance = Math.max(0, total - paid);
  const isPaidInFull = balance === 0;

  const receiptNo = `REC-${(record.studentId || "000").replace(/[^a-zA-Z0-9]/g, "")}-${new Date().getFullYear()}`;
  const currentDate = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handlePrint = () => {
    try {
      sound.chime();
    } catch {}
    window.print();
  };

  return (
    <div
      className="send-list-backdrop"
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(12px)",
        display: "grid",
        placeItems: "center",
        padding: "20px",
        overflowY: "auto",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 620,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          boxShadow: "0 24px 60px -15px rgba(15, 23, 42, 0.25), 0 0 0 1px var(--border)",
          overflow: "hidden",
        }}
      >
        {/* Modal Top Bar - Hidden on print */}
        <div
          className="fee-receipt-no-print"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 24px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Printer size={16} style={{ color: "var(--accent-primary)" }} />
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
              Printable Fee Receipt Preview
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 8,
                border: "none",
                background: "var(--accent-primary)",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 8px -2px rgba(37, 99, 235, 0.4)",
              }}
            >
              <Printer size={14} />
              Print / Save PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                padding: 4,
                borderRadius: 6,
              }}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div
          className="fee-receipt-printable"
          style={{
            padding: "36px 36px 32px",
            background: "#ffffff",
            color: "#0f172a",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0f172a", paddingBottom: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: "#2563eb",
                    color: "#ffffff",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    fontSize: "14px",
                  }}
                >
                  T
                </div>
                <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 800, letterSpacing: "-0.02em", color: "#0f172a" }}>
                  TechSummitTrainers
                </h1>
              </div>
              <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>
                Premier Technology Institute · Official Fee Receipt
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "10px", color: "#94a3b8" }}>
                GSTIN: 29ABCDE1234F1Z5 · Bengaluru, India
              </p>
            </div>

            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: 6,
                  background: isPaidInFull ? "#ecfdf5" : "#eff6ff",
                  border: isPaidInFull ? "1px solid #a7f3d0" : "1px solid #bfdbfe",
                  color: isPaidInFull ? "#059669" : "#2563eb",
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {isPaidInFull ? "Paid In Full" : "Partial Payment"}
              </div>
              <div style={{ marginTop: 8, fontSize: "11px", color: "#64748b" }}>
                <strong>Receipt No:</strong> {receiptNo}
              </div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>
                <strong>Date:</strong> {currentDate}
              </div>
            </div>
          </div>

          {/* Student & Course Details */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 24,
              padding: "20px 0",
              borderBottom: "1px solid #e2e8f0",
              fontSize: "12px",
            }}
          >
            <div>
              <span style={{ fontSize: "10px", textTransform: "uppercase", color: "#94a3b8", fontWeight: 700, letterSpacing: "0.05em" }}>
                Billed To
              </span>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", marginTop: 2 }}>
                {record.student}
              </div>
              <div style={{ color: "#64748b", marginTop: 2 }}>
                Student ID: <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{record.studentId}</span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: "10px", textTransform: "uppercase", color: "#94a3b8", fontWeight: 700, letterSpacing: "0.05em" }}>
                Payment Method & Ref
              </span>
              <div style={{ color: "#0f172a", fontWeight: 600, marginTop: 2 }}>
                Bank Transfer / UPI
              </div>
              <div style={{ color: "#64748b", marginTop: 2 }}>
                Due Date: {record.dueDate || "Immediate"}
              </div>
            </div>
          </div>

          {/* Fee Breakdown Table */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: 20,
              fontSize: "12px",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #cbd5e1", textAlign: "left" }}>
                <th style={{ padding: "8px 0", color: "#475569", fontWeight: 600 }}>Description</th>
                <th style={{ padding: "8px 0", textAlign: "right", color: "#475569", fontWeight: 600 }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "12px 0", color: "#0f172a" }}>
                  <strong>Course Tuition & Laboratory Access</strong>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>Academic term 2026 · Technical Curriculum</div>
                </td>
                <td style={{ padding: "12px 0", textAlign: "right", fontWeight: 600, color: "#0f172a" }}>
                  {formatCurrency(total)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td style={{ padding: "10px 0 4px", color: "#64748b" }}>Total Tuition Fees</td>
                <td style={{ padding: "10px 0 4px", textAlign: "right", fontWeight: 600, color: "#0f172a" }}>
                  {formatCurrency(total)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "4px 0", color: "#059669", fontWeight: 600 }}>Amount Received</td>
                <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 700, color: "#059669" }}>
                  {formatCurrency(paid)}
                </td>
              </tr>
              <tr style={{ borderTop: "2px solid #0f172a" }}>
                <td style={{ padding: "12px 0 4px", fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>
                  Outstanding Balance
                </td>
                <td style={{ padding: "12px 0 4px", textAlign: "right", fontSize: "15px", fontWeight: 800, color: balance > 0 ? "#dc2626" : "#059669" }}>
                  {formatCurrency(balance)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Verification Stamp & Signature */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginTop: 36,
              paddingTop: 20,
              borderTop: "1px dashed #cbd5e1",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "2px solid #059669",
                  color: "#059669",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <ShieldCheck size={24} />
              </div>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 800, color: "#059669", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Digitally Verified
                </div>
                <div style={{ fontSize: "10px", color: "#64748b" }}>
                  InstituteOS Cryptographic Ledger Stamp
                </div>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ width: 140, borderBottom: "1px solid #94a3b8", marginBottom: 6 }} />
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#475569" }}>
                Authorized Registrar
              </div>
              <div style={{ fontSize: "9px", color: "#94a3b8" }}>
                Accounts & Bursar Department
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar - Hidden on print */}
        <div
          className="fee-receipt-no-print"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 12,
            padding: "14px 24px",
            borderTop: "1px solid var(--border)",
            background: "var(--surface-2)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-secondary)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Close
          </button>

          <button
            type="button"
            onClick={handlePrint}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 18px",
              borderRadius: 8,
              border: "none",
              background: "var(--accent-primary)",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Printer size={14} />
            Print Receipt
          </button>
        </div>
      </motion.div>
    </div>
  );
}
