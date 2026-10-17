/**
 * InstituteOS – Services barrel export
 * Import any domain service from this single entry point.
 *
 * Usage:
 *   import { studentsService, dashboardService } from '../services';
 *   // or
 *   import { studentsService } from '../services/index.js';
 */

// ── Domain services ────────────────────────────────────────────────────────
export { studentsService }    from "./students.service.js";
export { batchesService }     from "./batches.service.js";
export { attendanceService }  from "./attendance.service.js";
export { feesService }        from "./fees.service.js";
export { schedulesService, detectScheduleConflict } from "./schedules.service.js";
export { dashboardService }   from "./dashboard.service.js";
export { storageService }     from "./storage.service.js";

// ── Core clients / helpers ─────────────────────────────────────────────────
export {
  supabaseClient,
  supabaseEnabled,
  getSession,
  signIn,
  signOut,
  onAuthStateChange,
} from "./supabase.js";

// ── Legacy API layer (backwards-compatible) ────────────────────────────────
export {
  getDashboard,
  getHealth,
  getStudents,
  createStudent,
  deleteStudent,
  getBatches,
  createBatch,
  getFees,
  recordFeePayment,
  getAttendance,
  markAttendance,
  getSessions,
  createSession,
  queryCopilotBackend,
  getSystemStatus,
  getAuditLog,
  getUserProfile,
  updateUserProfile,
} from "./api.js";
