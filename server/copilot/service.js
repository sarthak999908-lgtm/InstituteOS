import { createHash, randomUUID } from "node:crypto";
import { solveSchedule } from "../../src/features/schedules/solver.js";
import { buildSystemPrompt, PROMPT_VERSION } from "./systemPrompt.js";
import { formatScopedSchema, getAllowedSchema } from "./schema.js";
import { guardCopilotSql } from "./sqlGuard.js";
import { readPrivateStudentContacts, readScheduleSnapshot, runAsRequester } from "./queryExecutor.js";

const ACTION_KINDS = new Set(["whatsapp_reminders", "mark_attendance", "extend_due_date", "send_receipts", "timetable_replan"]);
const STUDENT_RELATIONS = new Set(["students", "student_profiles", "trainer_students", "account_students", "attendance", "instalments", "fee_plans", "payments"]);
const controlSequences = /[\u0000-\u001f\u007f-\u009f]/g;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const phonePattern = /(?<!\w)(?:\+?\d[\s().-]*){8,15}(?!\w)/g;

export class CopilotFallbackRequired extends Error {
  constructor(reason) { super(reason); this.name = "CopilotFallbackRequired"; }
}

export function isTrainerFinanceQuestion(text) {
  return /\b(?:fee|fees|emi|emis|payment|payments|paid|unpaid|outstanding|instal+ments?|collection|collections|balance|financial|finance|tuition|arrears|due amounts?|pending amounts?|pending dues?|who(?:'|’)s? not paid|who has not paid|not cleared|money|owed|owe|owes|owing|debt|debts)\b/i.test(String(text || ""));
}

function cleanText(value, max = 4000) {
  return String(value ?? "").replace(controlSequences, " ").slice(0, max);
}

function privateHash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function localDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Calcutta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function rolesAllowedForAction(role, kind) {
  const rules = {
    owner: ACTION_KINDS,
    counselor: new Set(["whatsapp_reminders", "extend_due_date", "timetable_replan"]),
    trainer: new Set(["mark_attendance"]),
    accounts: new Set(["extend_due_date", "send_receipts"]),
  };
  return Boolean(rules[role]?.has(kind));
}

function makeToolDefinitions() {
  return [
    {
      name: "get_schema",
      description: "Return the caller's role-scoped relations and columns.",
      input_schema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "run_readonly_query",
      description: "Execute one validated read-only SELECT against rows fetched through the requester's RLS-scoped Supabase session. Use ? placeholders and supply corresponding bound parameters in params.",
      input_schema: {
        type: "object",
        properties: {
          sql: { type: "string", maxLength: 12000 },
          purpose: { type: "string", maxLength: 500 },
          params: {
            type: "array",
            maxItems: 20,
            items: { anyOf: [
              { type: "string", maxLength: 1000 },
              { type: "number" },
              { type: "boolean" },
              { type: "null" },
            ] },
          },
        },
        required: ["sql", "purpose"],
        additionalProperties: false,
      },
    },
    {
      name: "draft_action",
      description: "Create an audited approval preview. This tool never executes the action.",
      input_schema: {
        type: "object",
        properties: {
          kind: { type: "string", enum: [...ACTION_KINDS] },
          payload: { type: "object" },
          summary: { type: "string", maxLength: 1000 },
        },
        required: ["kind", "payload", "summary"],
        additionalProperties: false,
      },
    },
    {
      name: "explain_timetable_change",
      description: "Run the existing timetable solver against the current requester-scoped timetable and explain the resulting change list.",
      input_schema: { type: "object", properties: { reason: { type: "string", maxLength: 500 } }, required: ["reason"], additionalProperties: false },
    },
    {
      name: "replan_timetable",
      description: "Run the existing timetable solver for a hypothetical unavailable trainer weekday. This only returns a plan; it does not save it.",
      input_schema: {
        type: "object",
        properties: {
          reason: { type: "string", maxLength: 500 },
          unavailable_trainer_id: { type: "string" },
          weekday: { type: "integer", minimum: 0, maximum: 6 },
        },
        required: ["reason"],
        additionalProperties: false,
      },
    },
  ];
}

export const copilotTools = makeToolDefinitions();

function safeContent(content = "") {
  return cleanText(content, 6000).replace(emailPattern, "[email redacted]").replace(phonePattern, "[phone redacted]");
}

function serializeUntrustedToolData(value) {
  return JSON.stringify(value)
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e");
}

function makeOpaqueId(map, prefix, id, record = {}) {
  const key = `${prefix}:${id}`;
  for (const [token, entry] of map) if (entry.key === key) return token;
  const token = `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  map.set(token, { key, id, ...record });
  return token;
}

function sanitizeRows(rows, tables, opaqueMap) {
  const includesStudents = tables.some((table) => STUDENT_RELATIONS.has(table));
  const singleRelationIdPrefixes = {
    batches: "batch",
    sessions: "session",
    trainers: "trainer",
    rooms: "room",
  };
  return rows.map((source) => {
    const row = {};
    for (const [column, rawValue] of Object.entries(source)) {
      if (/^(?:email|phone|utr)$/i.test(column)) continue;
      if (rawValue == null || typeof rawValue !== "string") {
        row[column] = rawValue;
        continue;
      }
      let value = cleanText(rawValue, 1000).replace(emailPattern, "[email redacted]").replace(phonePattern, "[phone redacted]");
      if (column === "id" && singleRelationIdPrefixes[tables[0]] && tables.length === 1) {
        const token = makeOpaqueId(opaqueMap, singleRelationIdPrefixes[tables[0]], rawValue, { name: source.name || "" });
        row[column] = token;
      } else if (includesStudents && ["id", "student_id"].includes(column) && rawValue) {
        const token = makeOpaqueId(opaqueMap, "student", rawValue, { name: source.name || "" });
        row[column] = token;
      } else if (["id", "batch_id", "session_id", "trainer_id", "room_id"].includes(column) && rawValue) {
        const token = makeOpaqueId(opaqueMap, column.replace(/_id$/, ""), rawValue, { name: source.name || source.batch_name || "" });
        row[column] = token;
      } else {
        row[column] = value;
      }
    }
    return row;
  });
}

function mapOpaqueValue(value, opaqueMap, expectedPrefix = null) {
  const entry = opaqueMap.get(String(value));
  if (!entry || (expectedPrefix && !entry.key.startsWith(`${expectedPrefix}:`))) throw new Error("The action refers to a record that was not returned by a scoped query.");
  return entry;
}

function normalizeScheduleSnapshot(snapshot, opaqueMap, role, queryTables) {
  const batches = snapshot.batches.map((batch) => ({ ...batch }));
  const trainers = snapshot.trainers.map((trainer) => ({ ...trainer }));
  const previousGrid = [];
  for (const batch of batches) {
    let days = [];
    try { days = Array.isArray(batch.slot_days) ? batch.slot_days : JSON.parse(batch.slot_days || "[]"); } catch { days = []; }
    for (const weekday of days.map(Number)) {
      previousGrid.push({
        batch_id: batch.id,
        batch_name: batch.name,
        trainer_id: batch.trainer_id,
        room_id: batch.room_id,
        weekday,
        start: batch.slot_start,
        end: batch.slot_end,
        room_name: snapshot.rooms.find((room) => room.id === batch.room_id)?.name || "Online",
      });
    }
  }
  return { batches, trainers, previousGrid, opaqueMap, role, queryTables };
}

function modelText(response) {
  return (response?.content || []).filter((block) => block.type === "text").map((block) => block.text).join("\n").trim();
}

export async function defaultAnthropicCall({ apiKey, model, system, messages, tools, signal, maxTokens = 1200, onText }) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: Math.max(256, Math.min(1200, maxTokens)), system, messages, tools, tool_choice: { type: "auto" }, stream: true }),
  });
  if (!response.ok) {
    const error = new Error("The language model request failed.");
    error.code = `COPILOT_PROVIDER_${response.status}`;
    throw error;
  }
  if (!response.body?.getReader) throw new Error("The language model stream is unavailable.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const content = [];
  const partialToolInputs = new Map();
  const usage = { input_tokens: 0, output_tokens: 0 };
  let buffer = "";
  let pendingText = "";
  let streamedTextLength = 0;
  let messageStopped = false;

  function flushSafeText(final = false) {
    const boundary = /(?:\r?\n+|[.!?](?:\s+|$))/g;
    let cut = 0;
    for (const match of pendingText.matchAll(boundary)) cut = match.index + match[0].length;
    if (final) cut = pendingText.length;
    if (!cut) return;
    const safe = safeContent(pendingText.slice(0, cut));
    if (safe) {
      onText?.(safe);
      streamedTextLength += safe.length;
    }
    pendingText = pendingText.slice(cut);
  }

  function processEvent(block) {
    const lines = block.split(/\r?\n/);
    const data = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
    if (!data || data === "[DONE]") return;
    let event;
    try { event = JSON.parse(data); }
    catch { throw new Error("The language model returned an invalid stream event."); }
    const type = event.type || lines.find((line) => line.startsWith("event:"))?.slice(6).trim();

    if (type === "error") {
      const error = new Error("The language model stream failed.");
      error.code = `COPILOT_PROVIDER_${event.error?.type || "STREAM"}`;
      throw error;
    }
    if (type === "message_start") {
      usage.input_tokens = Number(event.message?.usage?.input_tokens) || 0;
    } else if (type === "content_block_start") {
      const blockIndex = Number(event.index);
      const blockValue = event.content_block || {};
      content[blockIndex] = { ...blockValue };
      if (blockValue.type === "text" && blockValue.text) {
        pendingText += blockValue.text;
        flushSafeText();
      }
      if (blockValue.type === "tool_use") partialToolInputs.set(blockIndex, "");
    } else if (type === "content_block_delta") {
      const blockIndex = Number(event.index);
      const delta = event.delta || {};
      const current = content[blockIndex];
      if (delta.type === "text_delta" && current?.type === "text") {
        current.text = `${current.text || ""}${delta.text || ""}`;
        pendingText += delta.text || "";
        flushSafeText();
      } else if (delta.type === "input_json_delta" && current?.type === "tool_use") {
        partialToolInputs.set(blockIndex, `${partialToolInputs.get(blockIndex) || ""}${delta.partial_json || ""}`);
      }
    } else if (type === "content_block_stop") {
      const blockIndex = Number(event.index);
      const current = content[blockIndex];
      if (current?.type === "tool_use") {
        try { current.input = JSON.parse(partialToolInputs.get(blockIndex) || "{}"); }
        catch { throw new Error("The language model returned malformed tool arguments."); }
      }
    } else if (type === "message_delta") {
      usage.output_tokens = Number(event.usage?.output_tokens) || usage.output_tokens;
    } else if (type === "message_stop") {
      messageStopped = true;
      flushSafeText(true);
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";
      for (const event of events) processEvent(event);
    }
    buffer += decoder.decode();
    if (buffer.trim()) processEvent(buffer);
    if (!messageStopped) throw new Error("The language model stream ended before completion.");
    return { content: content.filter(Boolean), usage, streamedText: streamedTextLength > 0 };
  } catch (error) {
    try { await reader.cancel(); } catch { /* The provider stream may already be closed. */ }
    throw error;
  } finally {
    try { reader.releaseLock(); } catch { /* A failed stream may still be releasing its reader. */ }
  }
}

export function createCopilotService({ audit, queryRunner = runAsRequester, contactReader = readPrivateStudentContacts, scheduleReader = readScheduleSnapshot, approvalCreator, modelCall = defaultAnthropicCall, providerEnv = process.env, clock = () => new Date(), instituteResolver, userNameResolver } = {}) {
  const memories = new Map();
  const perUserRate = new Map();
  const instituteTokens = new Map();

  async function requiredAudit(req, event, detail) {
    if (typeof audit !== "function") throw new CopilotFallbackRequired("audit-unavailable");
    try { await audit(req, event, detail); }
    catch { throw new CopilotFallbackRequired("audit-unavailable"); }
  }

  function enforceLimits(auth) {
    const now = clock().getTime();
    for (const [memoryKey, turns] of memories) {
      const recentTurns = turns.filter((turn) => now - turn.at < 30 * 60_000).slice(-6);
      if (recentTurns.length) memories.set(memoryKey, recentTurns);
      else memories.delete(memoryKey);
    }
    const key = `${auth.instituteId}:${auth.userId}`;
    for (const [rateKey, timestamps] of perUserRate) {
      const fresh = timestamps.filter((time) => now - time < 60_000);
      if (fresh.length) perUserRate.set(rateKey, fresh);
      else perUserRate.delete(rateKey);
    }
    const recent = perUserRate.get(key) || [];
    if (recent.length >= 20) {
      const error = new Error("Rate limit reached. Please wait a minute before asking again.");
      error.status = 429;
      throw error;
    }
    recent.push(now);
    perUserRate.set(key, recent);
    const localDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Calcutta", year: "numeric", month: "2-digit", day: "2-digit" }).format(clock());
    for (const bucketKey of instituteTokens.keys()) if (!bucketKey.endsWith(`:${localDay}`)) instituteTokens.delete(bucketKey);
    const bucket = `${auth.instituteId}:${localDay}`;
    const used = instituteTokens.get(bucket) || 0;
    const cap = Math.max(1000, Math.min(Number(providerEnv.COPILOT_DAILY_TOKEN_CAP_PER_INSTITUTE) || 100000, 1000000));
    if (used >= cap) {
      const error = new Error("The institute's daily Copilot usage limit has been reached.");
      error.status = 429;
      throw error;
    }
    return { bucket, cap, remaining: cap - used };
  }

  async function requestContext(req, role) {
    let instituteName = "your institute";
    let userName = req.user?.user_metadata?.name || req.user?.user_metadata?.full_name || "Institute staff";
    try {
      if (instituteResolver) instituteName = await instituteResolver(req) || instituteName;
      else if (req.supabase) {
        const { data } = await req.supabase.from("institutes").select("name").eq("id", req.authContext.instituteId).maybeSingle();
        if (data?.name) instituteName = data.name;
      }
    } catch { /* Display-name lookup is optional; authorization comes from verified membership. */ }
    try {
      if (userNameResolver) userName = await userNameResolver(req) || userName;
      else if (req.supabase) {
        const { data } = await req.supabase.from("users").select("name").eq("id", req.authContext.userId).maybeSingle();
        if (data?.name) userName = data.name;
      }
    } catch { /* Do not make profile lookups an authorization dependency. */ }
    return buildSystemPrompt({ instituteName, today: localDate(), userName, role, schema: formatScopedSchema(role) });
  }

  async function handleTool(req, toolName, input, state) {
    const role = req.authContext.role;
    await requiredAudit(req, "copilot.tool_call", { tool: toolName, promptVersion: PROMPT_VERSION });
    if (toolName === "get_schema") {
      const schema = getAllowedSchema(role).tables;
      return { schema, promptVersion: PROMPT_VERSION };
    }
    if (toolName === "run_readonly_query") {
      if (typeof input?.purpose !== "string" || !input.purpose.trim() || input.purpose.length > 500) throw new Error("A short query purpose is required.");
      const guarded = guardCopilotSql(input.sql, role, input.params || []);
      await requiredAudit(req, "copilot.sql", { sql: guarded.sql, tables: guarded.tables, purposeHash: privateHash(input.purpose), promptVersion: PROMPT_VERSION });
      let result;
      state.emit?.("stage", { stage: "Running query" });
      try { result = await queryRunner(req, guarded.sql, guarded.params); }
      catch (error) {
        throw new Error("The scoped read-only query failed or was denied by database permissions.");
      }
      const opaqueMap = state.opaqueMap;
      let rows = sanitizeRows(result.rows, guarded.tables, opaqueMap);
      let truncated = result.rowCount >= 200;
      while (rows.length && JSON.stringify(rows).length > 40000) {
        rows = rows.slice(0, Math.max(1, Math.floor(rows.length * 0.75)));
        truncated = true;
      }
      const output = { sql: guarded.sql, columns: result.columns, rows, rowCount: result.rowCount, truncated, dataMode: result.source === "supabase-rls-snapshot" ? "live" : "local" };
      state.lastQuery = { sql: guarded.sql, tables: guarded.tables, rows: result.rows, safeRows: rows };
      state.queryResult = output;
      state.dataMode = output.dataMode;
      return output;
    }
    if (toolName === "draft_action") {
      const summary = cleanText(input?.summary, 1000).trim();
      if (!ACTION_KINDS.has(input?.kind) || !summary) throw new Error("A supported action kind and summary are required.");
      if (!rolesAllowedForAction(role, input.kind)) throw new Error("This role cannot request that action; no preview was created.");
      const opaqueMap = state.opaqueMap;
      const payload = input.payload && typeof input.payload === "object" && !Array.isArray(input.payload) ? input.payload : {};
      let storedPayload = {};
      let recipients = [];
      if (input.kind === "whatsapp_reminders") {
        const rawRecipients = Array.isArray(payload.recipients) ? payload.recipients : [];
        if (!rawRecipients.length || rawRecipients.length > 200) throw new Error("A WhatsApp preview needs 1–200 queried students.");
        const ids = rawRecipients.map((item) => mapOpaqueValue(item.studentId || item.student_id, opaqueMap, "student").id);
        const contacts = await contactReader(req, [...new Set(ids)]);
        const contactsById = new Map(contacts.map((item) => [String(item.id), item]));
        recipients = rawRecipients.map((item, index) => {
          const id = ids[index];
          const contact = contactsById.get(String(id));
          if (!contact) throw new Error("A contact is no longer visible to this requester; no preview was created.");
          return { studentId: id, name: cleanText(contact.name, 100), phone: cleanText(contact.phone || "", 40), message: cleanText(item.message, 1000) };
        });
        storedPayload = { recipients };
      } else if (input.kind === "mark_attendance") {
        const session = mapOpaqueValue(payload.sessionId || payload.session_id, opaqueMap, "session");
        const students = Array.isArray(payload.students) ? payload.students : [];
        if (!students.length || students.length > 200) throw new Error("An attendance preview needs 1–200 queried students.");
        storedPayload = { sessionId: session.id, studentIds: students.map((value) => mapOpaqueValue(value, opaqueMap, "student").id), status: cleanText(payload.status || "Absent", 30) };
        recipients = students.map((studentId) => ({ studentId, name: opaqueMap.get(studentId)?.name || "Student", phone: "", message: `Proposed attendance status: ${storedPayload.status}` }));
      } else if (input.kind === "timetable_replan") {
        const changes = Array.isArray(payload.changes) ? payload.changes.slice(0, 200) : [];
        storedPayload = { changes: changes.map((item) => ({
          batch_id: mapOpaqueValue(item.batch_id, opaqueMap, "batch").id,
          from: cleanText(item.from, 120), to: cleanText(item.to, 120), reason: cleanText(item.reason || summary, 500),
        })) };
      } else {
        storedPayload = Object.fromEntries(Object.entries(payload).slice(0, 20).map(([key, value]) => [cleanText(key, 60), cleanText(value, 1000)]));
      }
      const safeSummary = summary.replace(emailPattern, "[email redacted]").replace(phonePattern, "[phone redacted]");
      const previewText = `${safeSummary}\n\nNothing has been changed or sent. Approval is required.`;
      const approvalKind = input.kind === "mark_attendance" ? "attendance_bulk_mark"
        : input.kind === "timetable_replan" ? "schedule_replan"
          : ["send_receipts", "extend_due_date"].includes(input.kind) ? "fee_action" : input.kind;
      if (typeof approvalCreator !== "function") throw new CopilotFallbackRequired("approval-service-unavailable");
      const approval = await approvalCreator(req, { kind: approvalKind, payload: storedPayload, preview: previewText, actionKind: input.kind });
      state.actionPreview = { approvalId: approval.id, kind: input.kind, preview: previewText, recipients };
      return { approvalId: approval.id, kind: input.kind, preview: safeSummary, recipientCount: recipients.length, awaitingHumanApproval: true };
    }
    if (toolName === "explain_timetable_change" || toolName === "replan_timetable") {
      if (!rolesAllowedForAction(role, "timetable_replan")) throw new Error("This role cannot request timetable planning.");
      let snapshot;
      try { snapshot = await scheduleReader(req); }
      catch (error) {
        if (["COPILOT_DB_NOT_CONFIGURED", "COPILOT_PG_DRIVER_MISSING"].includes(error?.code)) throw new CopilotFallbackRequired("database-unavailable");
        throw new Error("Timetable data could not be read in the requester's scope.");
      }
      const opaqueMap = state.opaqueMap;
      const scoped = normalizeScheduleSnapshot(snapshot, opaqueMap, role, []);
      const requestReason = cleanText(input?.reason, 500);
      if (toolName === "replan_timetable" && input?.unavailable_trainer_id && Number.isInteger(input?.weekday)) {
        const trainer = mapOpaqueValue(input.unavailable_trainer_id, opaqueMap, "trainer");
        scoped.availability = snapshot.availability.filter((slot) => !(String(slot.trainer_id) === String(trainer.id) && Number(slot.weekday) === input.weekday));
      } else {
        scoped.availability = snapshot.availability;
      }
      const solved = solveSchedule({ ...snapshot, batches: scoped.batches, trainers: scoped.trainers, availability: scoped.availability }, { previousGrid: scoped.previousGrid, reason: requestReason });
      if (!solved.ok) return { ok: false, reason: solved.reason, relaxations: solved.relaxations };
      const changes = solved.changes.map((change) => ({
        ...change,
        batch_id: makeOpaqueId(opaqueMap, "batch", change.batch_id, { name: change.batch_name }),
        batch_name: safeContent(change.batch_name),
      }));
      state.scheduleChanges = changes;
      return { ok: true, changes, nodes: solved.nodes, approvalRequired: changes.length > 0 };
    }
    throw new Error("Unknown tool.");
  }

  async function run(req, question, { emit = () => {}, signal: clientSignal } = {}) {
    const auth = req.authContext;
    if (!auth?.userId || !auth?.instituteId || !auth?.role) throw new Error("Verified requester context is required.");
    const promptHash = privateHash(question);
    emit("stage", { stage: "Understanding" });
    await requiredAudit(req, "copilot.question", { promptHash, promptLength: question.length, promptVersion: PROMPT_VERSION });
    emit("stage", { stage: "Checking permissions" });
    if (auth.role === "trainer" && isTrainerFinanceQuestion(question)) {
      await requiredAudit(req, "copilot.refusal", { reason: "finance_role_denied", promptHash, promptVersion: PROMPT_VERSION });
      return { mode: "local", refusal: true, answer: "I can’t show fee, EMI, payment, or outstanding-balance information for a Trainer account. You can ask me about attendance, batches, assignments, or recordings instead.", queryResult: null };
    }
    const limit = enforceLimits(auth);
    if (providerEnv.COPILOT_ENABLED === "false" || providerEnv.COPILOT_ENABLED === "0") {
      await requiredAudit(req, "copilot.fallback", { reason: "disabled_by_kill_switch", promptVersion: PROMPT_VERSION });
      return { mode: "local", fallbackAvailable: true, unavailableReason: "disabled", answer: "AI is disabled. I’ll use the local planner for this question.", queryResult: null };
    }
    const apiKey = providerEnv.ANTHROPIC_API_KEY;
    const provider = (providerEnv.COPILOT_PROVIDER || "anthropic").toLowerCase();
    const model = providerEnv.COPILOT_MODEL || "claude-sonnet-5";
    if (!apiKey || provider !== "anthropic") {
      await requiredAudit(req, "copilot.fallback", { reason: !apiKey ? "provider_key_missing" : "provider_unsupported", promptVersion: PROMPT_VERSION });
      return { mode: "local", fallbackAvailable: true, unavailableReason: !apiKey ? "missing-key" : "unsupported-provider", answer: "AI is unavailable. I’ll use the local planner for this question.", queryResult: null };
    }
    const scopeKey = `${auth.instituteId}:${auth.userId}`;
    const now = clock().getTime();
    const memory = (memories.get(scopeKey) || []).filter((turn) => now - turn.at < 30 * 60_000).slice(-6);
    const messages = [
      ...memory.flatMap((turn) => [{ role: "user", content: turn.question }, { role: "assistant", content: turn.answer }]),
      { role: "user", content: cleanText(question, 4000) },
    ];
      const state = { lastQuery: null, queryResult: null, actionPreview: null, scheduleChanges: null, dataMode: "none", opaqueMap: new Map(), emit };
    let usedTokens = 0;
    let streamedText = false;
    const signalController = new AbortController();
    const timeout = setTimeout(() => signalController.abort(), 25000);
    const onAbort = () => signalController.abort();
    clientSignal?.addEventListener("abort", onAbort, { once: true });
    try {
      const system = await requestContext(req, auth.role);
      for (let round = 0; round < 5; round += 1) {
        emit("stage", { stage: round === 0 ? "Understanding" : "Summarising" });
        const estimatedInputTokens = Math.ceil((system.length + JSON.stringify(messages).length) / 3);
        const availableOutputTokens = Math.min(1200, limit.remaining - usedTokens - estimatedInputTokens);
        if (availableOutputTokens < 256) throw new CopilotFallbackRequired("token-limit");
        const response = await modelCall({
          apiKey,
          model,
          system,
          messages,
          tools: copilotTools,
          signal: signalController.signal,
          maxTokens: availableOutputTokens,
          onText: (text) => {
            if (typeof text !== "string" || !text) return;
            streamedText = true;
            emit("token", { text });
          },
        });
        const inputTokens = Number(response?.usage?.input_tokens) || 0;
        const outputTokens = Number(response?.usage?.output_tokens) || 0;
        const responseTokens = inputTokens + outputTokens;
        usedTokens += responseTokens;
        const instituteTokensUsed = (instituteTokens.get(limit.bucket) || 0) + responseTokens;
        if (responseTokens) instituteTokens.set(limit.bucket, instituteTokensUsed);
        if (usedTokens > Math.min(4000, limit.remaining)) throw new CopilotFallbackRequired("token-limit");
        if (instituteTokensUsed > limit.cap) throw new CopilotFallbackRequired("token-limit");
        messages.push({ role: "assistant", content: response.content || [] });
        const uses = (response.content || []).filter((block) => block.type === "tool_use");
        if (!uses.length) {
          const answer = safeContent(modelText(response)) || "I could not form a response from the available information.";
          memories.set(scopeKey, [...memory, { at: now, question: cleanText(question, 4000), answer }].slice(-6));
          await requiredAudit(req, "copilot.answer", { promptHash, promptVersion: PROMPT_VERSION, mode: "ai", tokenCount: usedTokens });
          return { mode: "ai", dataMode: state.dataMode, answer, refusal: false, queryResult: state.queryResult, actionPreview: state.actionPreview, followups: [], promptVersion: PROMPT_VERSION, tokenCount: usedTokens, streamedText };
        }
        if (uses.length > 5) throw new Error("Too many tool calls in one model turn.");
        const toolResultsForModel = [];
        for (const use of uses) {
          if (!copilotTools.some((tool) => tool.name === use.name)) throw new Error("The model requested an unavailable tool.");
          emit("stage", { stage: use.name === "run_readonly_query" ? "Writing query" : use.name === "get_schema" ? "Checking permissions" : "Preparing preview" });
          try {
            const result = await handleTool(req, use.name, use.input || {}, state);
            toolResultsForModel.push({ type: "tool_result", tool_use_id: use.id, content: `<untrusted-tool-data>${serializeUntrustedToolData(result)}</untrusted-tool-data>` });
          } catch (error) {
            if (error instanceof CopilotFallbackRequired) throw error;
            const safeError = cleanText(error?.message || "The tool could not complete.", 500);
            toolResultsForModel.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: `<untrusted-tool-data>${serializeUntrustedToolData(safeError)}</untrusted-tool-data>` });
          }
        }
        messages.push({ role: "user", content: toolResultsForModel });
      }
      throw new Error("The model exceeded the permitted tool-call rounds.");
    } catch (error) {
      if (error instanceof CopilotFallbackRequired) {
        emit("reset", {});
        await requiredAudit(req, "copilot.fallback", { reason: error.message, promptVersion: PROMPT_VERSION });
        return { mode: "local", fallbackAvailable: true, unavailableReason: error.message, answer: "AI is unavailable for this request. I’ll use the local planner for this question.", queryResult: null };
      }
      emit("reset", {});
      await requiredAudit(req, "copilot.provider_failure", { promptHash, reason: error?.code || error?.name || "request_failed", promptVersion: PROMPT_VERSION });
      return { mode: "local", fallbackAvailable: true, unavailableReason: "provider-failure", answer: "The AI service could not finish this request. I’ll use the local planner instead.", queryResult: null };
    } finally {
      clearTimeout(timeout);
      clientSignal?.removeEventListener("abort", onAbort);
    }
  }

  return { run, enforceLimits, memories, perUserRate, instituteTokens };
}
