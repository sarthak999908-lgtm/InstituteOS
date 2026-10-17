/**
 * InstituteOS - Schedules & Sessions Domain Service
 * Handles timetable scheduling, conflict detection, room/batch/instructor validation,
 * and session state management.
 */

import { getSessions, createSession, updateSession, deleteSession } from "./api.js";

/**
 * Check if two time intervals overlap on the same date
 * Format: HH:MM (24-hour)
 */
function intervalsOverlap(startA, endA, startB, endB) {
  if (!startA || !startB) return false;
  const toMinutes = (timeStr) => {
    const [h, m] = String(timeStr).split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const aStart = toMinutes(startA);
  const aEnd = endA ? toMinutes(endA) : aStart + 120; // default 2 hours if end omitted
  const bStart = toMinutes(startB);
  const bEnd = endB ? toMinutes(endB) : bStart + 120;

  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

/**
 * Comprehensive conflict detection for a proposed schedule
 * Checks for:
 * 1. Batch collision (same batch can't be in two places at once)
 * 2. Room collision (same classroom can't host multiple classes simultaneously)
 * 3. Instructor collision (same teacher can't teach two classes at once)
 */
export function detectScheduleConflict(existingSchedules, candidate) {
  if (!Array.isArray(existingSchedules) || !candidate) return null;

  for (const existing of existingSchedules) {
    // Ignore self when updating
    if (candidate.id && existing.id === candidate.id) continue;

    // Check same date
    if (existing.date !== candidate.date) continue;

    const timeOverlap = intervalsOverlap(
      existing.time || existing.start,
      existing.end,
      candidate.time || candidate.start,
      candidate.end
    );

    if (!timeOverlap) continue;

    // 1. Batch conflict
    if (candidate.batch && existing.batch && candidate.batch === existing.batch) {
      return {
        hasConflict: true,
        type: "batch_conflict",
        message: `Batch "${candidate.batch}" already has a class scheduled at ${existing.time || existing.start} on ${candidate.date}.`,
        conflictingSchedule: existing,
      };
    }

    // 2. Room/Classroom conflict
    if (
      candidate.classroom &&
      existing.classroom &&
      candidate.classroom !== "Online" &&
      candidate.classroom.toLowerCase() === existing.classroom.toLowerCase()
    ) {
      return {
        hasConflict: true,
        type: "room_conflict",
        message: `Classroom "${candidate.classroom}" is already reserved for "${existing.subject || existing.name}" at this time.`,
        conflictingSchedule: existing,
      };
    }

    // 3. Instructor conflict
    if (
      candidate.instructor &&
      existing.instructor &&
      candidate.instructor.toLowerCase() === existing.instructor.toLowerCase()
    ) {
      return {
        hasConflict: true,
        type: "instructor_conflict",
        message: `Instructor "${candidate.instructor}" is already assigned to "${existing.batch || existing.subject}" at this time.`,
        conflictingSchedule: existing,
      };
    }
  }

  return null;
}

export const schedulesService = {
  /**
   * List schedules / sessions with optional filtering
   */
  async list({ batchId, date, fromDate, toDate, limit = 50 } = {}) {
    const rows = await getSessions({ batch_id: batchId, start_date: date || fromDate, end_date: date || toDate, limit });
    if (!Array.isArray(rows)) throw new Error("Schedule API returned an invalid response.");
    return rows.map((item) => ({
      id: item.id,
      date: item.date,
      time: item.start,
      end: item.end,
      subject: item.topic || item.batches?.course_name || "",
      batch: item.batches?.name || "",
      instructor: item.batches?.trainer_name || "",
      classroom: item.batches?.room_id || "",
      batch_id: item.batch_id,
    })).slice(0, Math.min(Math.max(Number(limit) || 50, 1), 200));
  },

  /**
   * Create a new class schedule with automated conflict validation
   */
  async create(scheduleData, existingSchedules = []) {
    // Basic validation
    if (!scheduleData.subject?.trim()) {
      throw new Error("Subject/class name is required.");
    }
    if (!scheduleData.date) {
      throw new Error("Class date is required.");
    }
    if (!scheduleData.time) {
      throw new Error("Start time is required.");
    }

    // Conflict detection
    const conflict = detectScheduleConflict(existingSchedules, scheduleData);
    if (conflict) {
      throw new Error(conflict.message);
    }

    return createSession({
      id: scheduleData.id,
      batch_id: scheduleData.batch_id || scheduleData.batchId,
      date: scheduleData.date,
      start: scheduleData.time,
      end: scheduleData.end || scheduleData.endTime,
      topic: scheduleData.subject,
    });
  },

  /**
   * Update an existing schedule with conflict check
   */
  async update(id, updates, existingSchedules = []) {
    const conflict = detectScheduleConflict(existingSchedules, { id, ...updates });
    if (conflict) {
      throw new Error(conflict.message);
    }

    return updateSession(id, {
      date: updates.date,
      start: updates.time || updates.start,
      end: updates.end,
      topic: updates.subject || updates.topic,
    });
  },

  /**
   * Delete / Cancel a schedule
   */
  async delete(id) {
    if (!id) throw new Error("A session ID is required.");
    return deleteSession(id);
  },

  /**
   * Get upcoming classes for a batch or today's schedule
   */
  async getUpcoming({ batchId, limit = 5 } = {}) {
    const today = new Date().toISOString().slice(0, 10);
    const schedules = await this.list({ batchId, fromDate: today, limit });
    return schedules.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  },
};

export default schedulesService;
