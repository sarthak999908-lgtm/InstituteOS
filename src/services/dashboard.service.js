import { getDashboard, getFees, getAuditLog, getAttendance } from "./api.js";

function requireFinanceRole(role) {
  if (!["owner", "accounts"].includes(role)) throw new Error("Financial dashboard data is not available to this role.");
}

const dashboardService = {
  async getStats() {
    return getDashboard();
  },

  async getFeeSummary(role) {
    requireFinanceRole(role);
    const instalments = await getFees();
    if (!Array.isArray(instalments)) throw new Error("Fee API returned an invalid response.");
    const total = instalments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const collected = instalments.reduce((sum, item) => sum + Number(item.paid_amount || 0), 0);
    return {
      total,
      collected,
      pending: Math.max(0, total - collected),
      overdueCount: instalments.filter((item) => item.status === "overdue").length,
    };
  },

  async getRecentActivity(limit = 5) {
    const entries = await getAuditLog(Math.min(Math.max(Number(limit) || 5, 1), 200));
    if (!Array.isArray(entries)) throw new Error("Audit API returned an invalid response.");
    return entries.map((entry) => ({
      id: entry.id,
      type: entry.action || "action",
      text: entry.details || entry.action,
      time: entry.ts,
      icon: "activity",
    }));
  },

  async getAttendancePercentage(fromDate, toDate = new Date().toISOString().slice(0, 10)) {
    const records = await getAttendance({ from_date: fromDate, to_date: toDate });
    if (!Array.isArray(records)) throw new Error("Attendance API returned an invalid response.");
    const valid = records.filter((record) => ["present", "late", "absent"].includes(String(record.status || "").toLowerCase()));
    if (!valid.length) return null;
    const present = valid.filter((record) => ["present", "late"].includes(String(record.status).toLowerCase())).length;
    return Math.round((present / valid.length) * 100);
  },
};

export { dashboardService };
export default dashboardService;
