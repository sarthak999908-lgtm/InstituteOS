import { getAttendance, markAttendance } from "./api.js";

export const attendanceService = {
  async get(filters = {}) {
    const data = await getAttendance(filters);
    if (!Array.isArray(data)) throw new Error("Attendance API returned an invalid response.");
    return data;
  },

  async record(sessionId, records) {
    if (!sessionId) throw new Error("sessionId is required.");
    if (!Array.isArray(records) || records.length === 0) throw new Error("records array cannot be empty.");
    const uniqueRecords = [...new Map(records.map((record) => [record.student_id, record])).values()];
    return markAttendance(sessionId, uniqueRecords);
  },

  calculateMetrics(records) {
    const counts = { present: 0, absent: 0, late: 0 };
    for (const record of records) {
      const status = (record.status || "").toLowerCase();
      if (status === "present") counts.present += 1;
      else if (status === "absent") counts.absent += 1;
      else if (status === "late") counts.late += 1;
    }
    const total = counts.present + counts.absent + counts.late;
    return { ...counts, total, rate: total ? Math.round(((counts.present + counts.late) / total) * 100) : 0 };
  },
};
