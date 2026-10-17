import { getBatches, createBatch } from "./api.js";

export const batchesService = {
  async getAll() {
    const data = await getBatches();
    if (!Array.isArray(data)) throw new Error("Batch API returned an invalid response.");
    return data.map((batch) => ({
      ...batch,
      course: batch.course_name || batch.course || "",
      instructor: batch.trainer_name || batch.instructor || "",
      students: batch.student_count || 0,
      capacity: batch.online_seat_limit || 0,
      schedule: `${batch.slot_days || ""} · ${batch.slot_start || ""}-${batch.slot_end || ""}`,
      status: batch.status || "Active",
    }));
  },

  async save(batchData) {
    if (!batchData.name || !batchData.name.trim()) throw new Error("Batch name is required.");
    return createBatch({ ...batchData, start_date: batchData.start_date || new Date().toISOString().slice(0, 10) });
  },

  validateCapacity(batch, currentStudentCount = 0) {
    const maxCapacity = Number(batch.capacity || 30);
    const count = Number(currentStudentCount ?? batch.students ?? 0);
    const isFull = count >= maxCapacity;
    const remaining = Math.max(0, maxCapacity - count);
    return {
      isValid: !isFull, remaining, maxCapacity, currentCount: count,
      message: isFull ? `Batch '${batch.name}' has reached its maximum capacity of ${maxCapacity} students.` : `${remaining} seat${remaining === 1 ? "" : "s"} available.`,
    };
  },
};
