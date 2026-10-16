import { useMemo, useState } from "react";
import { Check, FileUp, RotateCcw, X } from "lucide-react";
import { dataSeed, students } from "../../data/mockData.js";
import { createApproval, decideApproval } from "../../lib/database.js";
import { parseStatementCsv, reconcileStatement } from "./reconcile.js";
import "./fees.css";

function paymentCandidates() {
  const studentNames = new Map(students.map((student) => [student.id, student.name]));
  return dataSeed.payments.map((payment) => ({ ...payment, student_name: studentNames.get(payment.student_id) }));
}

export default function ReconciliationPanel({ role, userId }) {
  const [matches, setMatches] = useState([]);
  const [pendingApproval, setPendingApproval] = useState(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const candidates = useMemo(paymentCandidates, []);
  const matched = matches.filter((row) => row.status === "matched");
  const unmatched = matches.filter((row) => row.status === "unmatched");

  async function reconcile(text, name) {
    setError("");
    setStatus("");
    try {
      const statementRows = parseStatementCsv(text);
      setMatches(reconcileStatement(statementRows, candidates));
      setFileName(name);
      setPendingApproval(null);
    } catch (reason) {
      setError(`Could not read this statement: ${reason.message}`);
    }
  }

  async function loadSample() {
    const response = await fetch("/sample-statement.csv");
    if (!response.ok) {
      setError("The sample statement could not be loaded.");
      return;
    }
    await reconcile(await response.text(), "sample-statement.csv");
  }

  async function beginApproval() {
    if (!matched.length) return;
    const approval = await createApproval({
      role,
      userId,
      kind: "fee_reconciliation",
      payload: matched,
      preview: `Approve ${matched.length} statement match${matched.length === 1 ? "" : "es"} from ${fileName}.`,
    });
    setPendingApproval(approval);
  }

  async function decide(decision) {
    if (!pendingApproval) return;
    await decideApproval({ approvalId: pendingApproval.id, role, userId, decision, payload: matched });
    if (decision === "approve") {
      const prior = JSON.parse(localStorage.getItem("instituteos_approved_reconciliations") || "[]");
      localStorage.setItem("instituteos_approved_reconciliations", JSON.stringify([...prior, ...matched]));
      setStatus(`${matched.length} matched row${matched.length === 1 ? "" : "s"} approved and recorded locally.`);
    } else {
      setStatus("Reconciliation matches rejected; no payment records were changed.");
    }
    setPendingApproval(null);
    window.dispatchEvent(new CustomEvent("instituteos-approvals-changed"));
  }

  return <section className="panel reconciliation-panel"><div className="record-toolbar"><div><h2>Statement reconciliation</h2><p>Match imported UPI or bank transactions against local payment records.</p></div><span className="data-source-chip">OWNER / ACCOUNTS</span></div>
    <div className="reconciliation-controls"><label className="statement-upload"><FileUp size={17} /><span>{fileName || "Choose a CSV statement"}</span><input type="file" accept=".csv,text/csv" aria-label="Upload bank statement CSV" onChange={async (event) => { const file = event.target.files?.[0]; if (file) await reconcile(await file.text(), file.name); }} /></label><button className="student-secondary-button" type="button" onClick={loadSample}><RotateCcw size={14} />Load sample</button></div>
    {error && <p className="record-form-error" role="alert">{error}</p>}{status && <p className="reconciliation-status" role="status">{status}</p>}
    {!!matches.length && <><div className="reconciliation-counts"><span><strong>{matched.length}</strong> matched</span><span><strong>{unmatched.length}</strong> unmatched</span><span><strong>{matches.length}</strong> statement rows</span></div><div className="record-table-wrap"><table className="record-table"><thead><tr><th>Statement row</th><th>Transaction</th><th>Candidate</th><th>Confidence</th><th>Status</th></tr></thead><tbody>{matches.map((row) => <tr key={row.source.rowNumber}><td>#{row.source.rowNumber}</td><td><strong>{row.source.name || "Unknown payer"}</strong><small className="cell-subtitle">{row.source.utr || "No UTR"} · ₹{row.source.amount ?? "Invalid amount"}</small></td><td>{row.payment ? <><strong>{row.payment.student_name}</strong><small className="cell-subtitle">{row.payment.utr} · ₹{row.payment.amount}</small></> : "No confident match"}</td><td>{row.confidence}%</td><td><span className={`record-badge ${row.status === "matched" ? "paid" : "overdue"}`}>{row.status}</span></td></tr>)}</tbody></table></div>
      {!pendingApproval && <div className="reconciliation-actions"><button className="primary-button" type="button" disabled={!matched.length || !["owner", "accounts"].includes(role)} onClick={beginApproval}>Review {matched.length} matches</button></div>}
      {pendingApproval && <div className="reconciliation-approval"><span>Approve {matched.length} matched rows? Unmatched statement rows will not be applied.</span><div><button className="student-secondary-button" type="button" onClick={() => decide("reject")}><X size={14} />Reject</button><button className="primary-button" type="button" onClick={() => decide("approve")}><Check size={14} />Approve matches</button></div></div>}
    </>}
  </section>;
}