import Papa from "papaparse";

function firstValue(row, candidates) {
  for (const key of candidates) {
    if (row[key] !== undefined && String(row[key]).trim()) return String(row[key]).trim();
  }
  return "";
}

function parseAmount(value) {
  const amount = Number(String(value || "").replace(/[₹$,\s]/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

export function parseStatementCsv(text) {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: (header) => header.trim().toLowerCase().replace(/[\s-]+/g, "_") });
  if (parsed.errors.length) throw new Error(parsed.errors[0].message);
  return parsed.data.map((row, index) => ({
    rowNumber: index + 2,
    utr: firstValue(row, ["utr", "utr_number", "transaction_id", "reference"]),
    amount: parseAmount(firstValue(row, ["amount", "transaction_amount", "credit"])),
    name: firstValue(row, ["name", "payer", "beneficiary", "student"]),
    date: firstValue(row, ["date", "received_on", "transaction_date"]),
  }));
}

function sameDate(first, second) {
  if (!first || !second) return false;
  const left = new Date(first).getTime();
  const right = new Date(second).getTime();
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 86400000;
}

function scoreMatch(source, payment) {
  const amountMatch = source.amount !== null && Number(source.amount) === Number(payment.amount);
  if (!amountMatch) return 0;
  const utrMatch = source.utr && payment.utr && source.utr.toLowerCase() === payment.utr.toLowerCase();
  const normalizedName = source.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const paymentName = String(payment.student_name || payment.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const nameMatch = normalizedName && paymentName && (normalizedName === paymentName || normalizedName.includes(paymentName) || paymentName.includes(normalizedName));
  if (!utrMatch && !nameMatch) return 0;
  return 35 + (utrMatch ? 40 : 0) + (nameMatch ? 15 : 0) + (sameDate(source.date, payment.received_on) ? 10 : 0);
}

export function reconcileStatement(statementRows, paymentRows) {
  const used = new Set();
  return statementRows.map((source) => {
    const candidates = paymentRows
      .filter((payment) => !used.has(payment.id))
      .map((payment) => ({ payment, confidence: scoreMatch(source, payment) }))
      .sort((first, second) => second.confidence - first.confidence);
    const best = candidates[0];
    if (best && best.confidence >= 60) {
      used.add(best.payment.id);
      return { source, payment: best.payment, confidence: best.confidence, status: "matched" };
    }
    return { source, payment: null, confidence: best?.confidence || 0, status: "unmatched" };
  });
}