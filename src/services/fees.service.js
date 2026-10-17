import { getFees, recordFeePayment } from "./api.js";

function requireFinanceRole(role) {
  if (!["owner", "accounts"].includes(role)) throw new Error("Fee information is not available to this role.");
}

export const feesService = {
  async getAll(role) {
    requireFinanceRole(role);
    const data = await getFees();
    if (!Array.isArray(data)) throw new Error("Fee API returned an invalid response.");
    return data.map((item) => ({
      id: item.id,
      student: item.students?.name || "Student",
      studentId: item.student_id,
      total: Number(item.amount || 0),
      paid: Number(item.paid_amount || 0),
      balance: Math.max(0, Number(item.amount || 0) - Number(item.paid_amount || 0)),
      dueDate: item.due_date,
      status: Number(item.paid_amount || 0) >= Number(item.amount || 0)
        ? "Paid"
        : item.due_date < new Date().toISOString().slice(0, 10) ? "Overdue" : "Pending",
    }));
  },

  async recordPayment({ role, studentId, instalmentId, amount, method = "bank_transfer", utr = "" }) {
    requireFinanceRole(role);
    const amountText = typeof amount === "string" ? amount.trim() : Number.isSafeInteger(amount) ? String(amount) : "";
    const validFormat = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(amountText);
    const [wholePart = "0", fractionPart = ""] = amountText.split(".");
    const positive = validFormat
      ? BigInt(wholePart) * 100n + BigInt(fractionPart.padEnd(2, "0") || "0") > 0n
      : false;
    if (!positive) {
      throw new Error("Payment amount must be a positive decimal with at most two fractional digits.");
    }
    return recordFeePayment({ studentId, instalmentId, amount: amountText, method, utr: String(utr).trim() });
  },

  calculateSummary(records) {
    let totalBilled = 0;
    let totalCollected = 0;
    let overdueCount = 0;
    for (const record of records) {
      totalBilled += Number(record.total || 0);
      totalCollected += Number(record.paid || 0);
      if (record.status === "Overdue") overdueCount += 1;
    }
    return {
      totalBilled,
      totalCollected,
      outstanding: Math.max(0, totalBilled - totalCollected),
      overdueCount,
      collectionRate: totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0,
    };
  },
};
