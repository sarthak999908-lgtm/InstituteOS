import { Worker } from "node:worker_threads";
import { getAllowedSchema } from "./schema.js";
import { guardCopilotSql } from "./sqlGuard.js";

const PAGE_SIZE = 500;
const MAX_RELATION_ROWS = 2000;
const MAX_TOTAL_SOURCE_ROWS = 10000;
const MAX_QUERY_MS = 5000;

function verifiedContext(req) {
  const claims = req?.jwtClaims;
  const auth = req?.authContext;
  if (!claims || claims.role !== "authenticated" || claims.sub !== auth?.authUserId
      || !auth?.userId || !auth?.instituteId || !["owner", "counselor", "trainer", "accounts"].includes(auth.role)
      || !req.supabase) {
    throw new Error("Verified requester context is unavailable.");
  }
  return auth.role;
}

async function defaultLoadRelation(req, relation, columns, signal) {
  if (!req.supabase || !columns.length) throw new Error("Scoped data access is unavailable.");
  const rows = [];
  for (let offset = 0; offset <= MAX_RELATION_ROWS; offset += PAGE_SIZE) {
    if (signal.aborted || Date.now() > signal.deadline) throw new Error("The scoped query timed out.");
    const end = Math.min(offset + PAGE_SIZE - 1, MAX_RELATION_ROWS);
    let query = req.supabase.from(relation).select(columns.join(",")).range(offset, end).abortSignal(signal.controller.signal);
    const { data, error } = await query;
    if (error) throw new Error("A requester-scoped relation could not be read.");
    const page = data || [];
    if (rows.length + page.length > MAX_RELATION_ROWS) throw new Error("A source relation exceeds the local query bound; narrow the question with filters.");
    rows.push(...page);
    if (page.length < PAGE_SIZE || offset + PAGE_SIZE > MAX_RELATION_ROWS) break;
  }
  return rows;
}

function runBoundedWorker(workerData, timeoutMs = MAX_QUERY_MS) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./sqlWorker.js", import.meta.url), {
      workerData,
      resourceLimits: { maxOldGenerationSizeMb: 128 },
    });
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      void worker.terminate();
      reject(new Error("The scoped SQL statement exceeded its time limit."));
    }, timeoutMs);
    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      handler(value);
    };
    worker.once("message", (result) => {
      if (result?.error) finish(reject, new Error(result.error));
      else finish(resolve, result);
      void worker.terminate();
    });
    worker.once("error", () => finish(reject, new Error("The scoped SQL statement could not be completed.")));
    worker.once("exit", (code) => {
      if (code !== 0) finish(reject, new Error("The scoped SQL statement could not be completed."));
    });
  });
}

export function createScopedQueryExecutor({ relationReader = defaultLoadRelation, workerRunner = runBoundedWorker } = {}) {
  return async function runAsVerifiedRequester(req, sql, params = []) {
    const role = verifiedContext(req);
    const policy = getAllowedSchema(role).tables;
    const guarded = guardCopilotSql(sql, role, params);
    sql = guarded.sql;
    params = guarded.params;
    const requested = guarded.tables;
    if (!requested.length || requested.some((relation) => !Object.hasOwn(policy, relation))) {
      throw new Error("The query requested a relation outside the caller's scoped schema.");
    }
    const deadline = Date.now() + MAX_QUERY_MS;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MAX_QUERY_MS);
    const signal = { controller, get deadline() { return deadline; }, get aborted() { return controller.signal.aborted; } };
    try {
      const sourceRows = {};
      let totalSourceRows = 0;
      const relations = await Promise.all(requested.map(async (relation) => [
        relation,
        await relationReader(req, relation, policy[relation], signal),
      ]));
      for (const [relation, rows] of relations) {
        totalSourceRows += rows.length;
        if (totalSourceRows > MAX_TOTAL_SOURCE_ROWS) throw new Error("The requester-scoped source data exceeds the local query bound; narrow the question.");
        sourceRows[relation] = rows;
      }
      if (signal.aborted || Date.now() > deadline) throw new Error("The scoped query timed out.");
      const remaining = Math.max(1, Math.min(MAX_QUERY_MS, deadline - Date.now()));
      return await workerRunner({
        schema: Object.fromEntries(requested.map((relation) => [relation, policy[relation]])),
        sourceRows,
        sql,
        params,
      }, remaining);
    } catch (error) {
      // Stop sibling PostgREST reads if one scoped relation fails. Otherwise a
      // rejected Promise.all could clear the deadline while sibling reads run on.
      controller.abort();
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };
}

export const runAsRequester = createScopedQueryExecutor();

export async function readPrivateStudentContacts(req, studentIds) {
  if (!["owner", "counselor"].includes(req.authContext?.role)) {
    throw new Error("This role cannot prepare WhatsApp contact previews.");
  }
  if (!Array.isArray(studentIds) || !studentIds.length || studentIds.length > 200) return [];
  const { data, error } = await req.supabase
    .from("student_profiles")
    .select("id,name,phone")
    .in("id", studentIds)
    .limit(200);
  if (error) throw new Error("Contacts could not be read in the requester's scope.");
  return data || [];
}

export async function readScheduleSnapshot(req) {
  const role = req.authContext?.role;
  if (!["owner", "counselor", "trainer"].includes(role)) throw new Error("This role cannot view timetable planning data.");
  const tables = await Promise.all([
    req.supabase.from("batches").select("id,name,course_id,trainer_id,mode,start_date,slot_days,slot_start,slot_end,room_id,online_seat_limit,student_count,course_name").limit(201),
    req.supabase.from("trainers").select("id,name,weekly_hours_max").limit(201),
    req.supabase.from("trainer_availability").select("trainer_id,weekday,start,end").limit(201),
    req.supabase.from("rooms").select("id,name,capacity").limit(201),
  ]);
  if (tables.some(({ error }) => error)) throw new Error("Timetable data could not be read in the requester's scope.");
  if (tables.some(({ data }) => (data || []).length > 200)) {
    throw new Error("Timetable planning needs a narrower scope; the complete schedule exceeds its safe row bound.");
  }
  return { batches: tables[0].data || [], trainers: tables[1].data || [], availability: tables[2].data || [], rooms: tables[3].data || [] };
}
