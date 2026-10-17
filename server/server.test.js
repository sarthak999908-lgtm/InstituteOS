import { describe, expect, it, vi } from "vitest";
import {
  app,
  auditRowsToCsv,
  createAuditWriter,
  createCopilotApprovalWriter,
  createRequireAuth,
  createRateLimiter,
  normalizePaymentAmount,
  isFinancialCopilotRequest,
  requireAuth,
  requireRole,
  studentDeleteRoleGuard,
  withApprovedReminderMessages,
} from "./index.js";

function responseRecorder() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

describe("secure API boundary", () => {
  it("stores only edited reminder text while retaining the audited recipients", () => {
    const saved = {
      channel: "whatsapp",
      recipients: [
        { studentId: "student-1", name: "Fictional Student", phone: "+91 90000 00001", message: "Original message" },
      ],
    };

    expect(withApprovedReminderMessages(saved, [
      { studentId: "student-1", name: "Changed name", phone: "+91 99999 99999", message: "Approved edited text" },
    ])).toEqual({
      channel: "whatsapp",
      recipients: [
        { studentId: "student-1", name: "Fictional Student", phone: "+91 90000 00001", message: "Approved edited text" },
      ],
    });
    expect(() => withApprovedReminderMessages(saved, [
      { studentId: "other-student", message: "Swap recipient" },
    ])).toThrow("does not match the saved recipients");
  });

  it("denies protected requests without a bearer token", async () => {
    const res = responseRecorder();
    let advanced = false;
    await requireAuth({ headers: {} }, res, () => { advanced = true; });
    expect(advanced).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it("rejects locally encoded tokens without treating their contents as identity", async () => {
    const res = responseRecorder();
    let advanced = false;
    await requireAuth({ headers: { authorization: "Bearer inst_token_eyJyb2xlIjoib3duZXIifQ==" } }, res, () => { advanced = true; });
    expect(advanced).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it("derives role and institute from the verified membership result, not request body fields", async () => {
    const claims = { sub: "verified-auth-id", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 300, app_metadata: { institute_id: "INST-VERIFIED" } };
    const token = `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
    const middleware = createRequireAuth({
      verifyToken: async () => ({ data: { user: { id: "verified-auth-id", email: "staff@example.invalid", app_metadata: claims.app_metadata } }, error: null }),
      createUserClient: () => ({ rpc: async () => ({ data: [{ user_id: "PROFILE-VERIFIED", institute_id: "INST-VERIFIED", role: "counselor" }], error: null }) }),
    });
    const req = {
      headers: { authorization: `Bearer ${token}` },
      body: { user_id: "ATTACKER", institute_id: "INST-ATTACKER", role: "owner" },
    };
    const res = responseRecorder();
    let advanced = false;
    await middleware(req, res, () => { advanced = true; });
    expect(advanced).toBe(true);
    expect(req.authContext).toEqual({ authUserId: "verified-auth-id", userId: "PROFILE-VERIFIED", instituteId: "INST-VERIFIED", role: "counselor" });
    expect(req.jwtClaims.sub).toBe("verified-auth-id");
    expect(req.jwtClaims.role).toBe("authenticated");
  });

  it("allows GET /api/me to report an authenticated identity with no membership without authorizing other APIs", async () => {
    const claims = { sub: "unlinked-auth-id", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 300 };
    const token = `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
    const middleware = createRequireAuth({
      allowUnlinked: true,
      verifyToken: async () => ({ data: { user: { id: claims.sub } }, error: null }),
      createUserClient: () => ({ rpc: async () => ({ data: [], error: null }) }),
    });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = responseRecorder();
    let advanced = false;
    await middleware(req, res, () => { advanced = true; });
    expect(advanced).toBe(true);
    expect(req.authContext).toEqual({ authUserId: claims.sub, userId: null, instituteId: null, role: null });

    const protectedResponse = responseRecorder();
    let protectedAdvanced = false;
    const regularMiddleware = createRequireAuth({
      verifyToken: async () => ({ data: { user: { id: claims.sub } }, error: null }),
      createUserClient: () => ({ rpc: async () => ({ data: [], error: null }) }),
    });
    await regularMiddleware({ headers: { authorization: `Bearer ${token}` } }, protectedResponse, () => { protectedAdvanced = true; });
    expect(protectedAdvanced).toBe(false);
    expect(protectedResponse.statusCode).toBe(403);
  });

  it("fails closed when membership lookup errors instead of reporting the user as unlinked", async () => {
    const claims = { sub: "verified-auth-id", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 300 };
    const token = `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
    const middleware = createRequireAuth({
      allowUnlinked: true,
      verifyToken: async () => ({ data: { user: { id: claims.sub } }, error: null }),
      createUserClient: () => ({ rpc: async () => ({ data: null, error: new Error("network failure") }) }),
    });
    const res = responseRecorder();
    let advanced = false;
    await middleware({ headers: { authorization: `Bearer ${token}` } }, res, () => { advanced = true; });
    expect(advanced).toBe(false);
    expect(res.statusCode).toBe(503);
  });

  it("rate limits per caller key and resets after the fixed window", () => {
    let now = 1_000;
    const limiter = createRateLimiter({ limit: 2, windowMs: 10_000, keyFor: (req) => req.userId, clock: () => now });
    const pass = vi.fn();
    const first = responseRecorder();
    const second = responseRecorder();
    const blocked = responseRecorder();
    limiter({ userId: "user-a" }, first, pass);
    limiter({ userId: "user-a" }, second, pass);
    limiter({ userId: "user-a" }, blocked, pass);
    expect(pass).toHaveBeenCalledTimes(2);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.body).toMatchObject({ success: false });

    now += 10_001;
    const afterReset = responseRecorder();
    limiter({ userId: "user-a" }, afterReset, pass);
    expect(pass).toHaveBeenCalledTimes(3);
    expect(afterReset.statusCode).toBeNull();
  });

  it("builds RFC-style quoted CSV for owner audit exports", () => {
    expect(auditRowsToCsv([{ at: "2026-10-17T00:00:00Z", role: "owner", user_id: "U-1", event: "test", detail: 'quoted "value", next line\nsecond' }]))
      .toBe('"at","role","user_id","event","detail"\r\n"2026-10-17T00:00:00Z","owner","U-1","test","quoted ""value"", next line\nsecond"');
  });

  it("keeps payment amounts as validated decimal strings rather than floating-point values", () => {
    expect(normalizePaymentAmount("1250.30")).toBe("1250.30");
    expect(normalizePaymentAmount("1250")).toBe("1250.00");
    expect(normalizePaymentAmount(1250)).toBe("1250.00");
    expect(normalizePaymentAmount(0.1)).toBeNull();
    expect(normalizePaymentAmount("1.234")).toBeNull();
    expect(normalizePaymentAmount("NaN")).toBeNull();
    expect(normalizePaymentAmount("0.00")).toBeNull();
  });

  it("wires authentication before the Copilot chat handler", async () => {
    const route = app.router.stack.find((layer) => layer.route?.path === "/api/copilot/chat" && layer.route.methods.post);
    expect(route).toBeDefined();
    const authMiddleware = route.route.stack[0].handle;
    const res = responseRecorder();
    let advanced = false;
    await authMiddleware({ headers: {} }, res, () => { advanced = true; });
    expect(advanced).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it("requires the trusted audit writer on every implemented business mutation route", () => {
    const mutations = [
      ["post", "/api/students"], ["delete", "/api/students/:id"], ["post", "/api/batches"],
      ["post", "/api/fees/payment"], ["post", "/api/attendance"], ["post", "/api/sessions"],
      ["patch", "/api/sessions/:id"], ["delete", "/api/sessions/:id"], ["post", "/api/approvals"],
      ["patch", "/api/approvals/:id"], ["post", "/api/assignments"], ["post", "/api/submissions"],
      ["post", "/api/recordings"], ["post", "/api/trainers"], ["post", "/api/courses"], ["post", "/api/rooms"],
    ];

    for (const [method, path] of mutations) {
      const route = app.router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
      expect(route, `${method.toUpperCase()} ${path}`).toBeDefined();
      expect(route.route.stack.at(-1).handle.toString(), `${method.toUpperCase()} ${path} handler`)
        .toContain("writeRequiredAudit");
    }
  });

  it("exposes GET /api/me behind verified authentication and returns linked state without secrets", () => {
    const route = app.router.stack.find((layer) => layer.route?.path === "/api/me" && layer.route.methods.get);
    expect(route).toBeDefined();
    expect(route.route.stack.length).toBe(3);
    const handler = route.route.stack[2].handle;
    const res = responseRecorder();
    handler({ user: { id: "auth-user-id" }, authContext: { userId: null, instituteId: null, role: null } }, res);
    expect(res.body).toEqual({ success: true, data: { linked: false, userId: "auth-user-id" } });
  });

  it("rejects audit-log CSV export for trainers before loading records", async () => {
    const route = app.router.stack.find((layer) => layer.route?.path === "/api/audit-log/export" && layer.route.methods.post);
    expect(route).toBeDefined();
    const handler = route.route.stack.at(-1).handle;
    const res = responseRecorder();
    await handler({
      body: { resource: "audit_log", format: "csv" },
      authContext: { role: "trainer", authUserId: "AUTH-1", userId: "U-1", instituteId: "INST-1" },
    }, res);
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ success: false });
  });

  it("denies unknown and trainer roles from finance-only routes", () => {
    for (const role of [undefined, "trainer", "guest"]) {
      const res = responseRecorder();
      let advanced = false;
      requireRole("owner", "accounts")({ role }, res, () => { advanced = true; });
      expect(advanced).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    }
  });

  it("detects direct and indirect financial Copilot requests", () => {
    expect(isFinancialCopilotRequest("Show students with overdue EMIs")).toBe(true);
    expect(isFinancialCopilotRequest("List unpaid instalments", "search")).toBe(true);
    expect(isFinancialCopilotRequest("Show today's attendance")).toBe(false);
  });

  it("writes audit identity only from the verified server context", async () => {
    const writes = [];
    const client = {
      from(table) {
        return {
          async insert(row) {
            writes.push({ table, row });
            return { error: null };
          },
        };
      },
    };
    const audit = createAuditWriter(client, {
      idFactory: () => "AUDIT-TEST-1",
      clock: () => new Date("2026-10-17T12:00:00.000Z"),
    });

    await audit({
      authContext: {
        authUserId: "verified-auth-uuid",
        userId: "PROFILE-VERIFIED",
        instituteId: "INST-A",
        role: "owner",
      },
      body: {
        user_id: "ATTACKER-PROFILE",
        institute_id: "INST-B",
        role: "owner",
        at: "1900-01-01T00:00:00Z",
      },
    }, "approval.request_attempt", { kind: "fee_action" });

    expect(writes).toHaveLength(1);
    expect(writes[0].table).toBe("audit_log");
    expect(writes[0].row).toMatchObject({
      id: "AUDIT-TEST-1",
      at: "2026-10-17T12:00:00.000Z",
      user_id: "PROFILE-VERIFIED",
      role: "owner",
      institute_id: "INST-A",
      event: "approval.request_attempt",
      detail: JSON.stringify({ kind: "fee_action" }),
    });
  });

  it("fails closed when the audit client or verified membership context is missing", async () => {
    const audit = createAuditWriter(null);
    await expect(audit({ authContext: { role: "owner" } }, "student.delete_attempt")).rejects.toThrow("Audit write unavailable.");
  });

  it("fails closed when the append-only audit insert fails", async () => {
    const audit = createAuditWriter({
      from: () => ({ insert: async () => ({ error: new Error("database denied") }) }),
    });
    await expect(audit({ authContext: {
      authUserId: "auth-uuid",
      userId: "PROFILE-1",
      instituteId: "INST-A",
      role: "counselor",
    } }, "data.export_attempt")).rejects.toThrow("Audit write unavailable.");
  });

  it("audits an approval preview before inserting it with verified tenant identity", async () => {
    const operations = [];
    const client = {
      from: (table) => ({
        insert: (row) => {
          operations.push({ type: "insert", table, row });
          return { select: () => ({ single: async () => ({ data: { id: row.id, kind: row.kind, status: row.status, created_at: "2026-10-17T12:00:00Z" }, error: null }) }) };
        },
      }),
    };
    const audit = async (req, event, detail) => { operations.push({ type: "audit", event, detail }); };
    const createApproval = createCopilotApprovalWriter(client, audit, () => "FIXED-ID");
    const req = { authContext: { userId: "PROFILE-1", instituteId: "INST-1", role: "owner" } };
    const result = await createApproval(req, { kind: "whatsapp_reminders", actionKind: "whatsapp_reminders", payload: { recipients: [] }, preview: "Fictional reminder preview" });
    expect(result.id).toBe("COP-FIXED-ID");
    expect(operations.map((item) => item.type)).toEqual(["audit", "insert"]);
    expect(operations[0].event).toBe("approval.request_attempt");
    expect(operations[0].detail.previewHash).toMatch(/^[a-f0-9]{64}$/);
    expect(operations[1].row).toMatchObject({ institute_id: "INST-1", requested_by: "PROFILE-1", status: "pending" });
  });

  it("does not create an approval if its required audit write fails", async () => {
    const insert = vi.fn();
    const client = { from: () => ({ insert }) };
    const createApproval = createCopilotApprovalWriter(client, async () => { throw new Error("audit unavailable"); }, () => "FIXED-ID");
    await expect(createApproval({ authContext: { userId: "PROFILE-1", instituteId: "INST-1", role: "owner" } }, {
      kind: "whatsapp_reminders", payload: {}, preview: "preview", actionKind: "whatsapp_reminders",
    })).rejects.toThrow("audit unavailable");
    expect(insert).not.toHaveBeenCalled();
  });

  it("restricts the student delete route to owners", () => {
    const counselorResponse = responseRecorder();
    let counselorAdvanced = false;
    studentDeleteRoleGuard({ role: "counselor" }, counselorResponse, () => { counselorAdvanced = true; });
    expect(counselorAdvanced).toBe(false);
    expect(counselorResponse.statusCode).toBe(403);

    const ownerResponse = responseRecorder();
    let ownerAdvanced = false;
    studentDeleteRoleGuard({ role: "owner" }, ownerResponse, () => { ownerAdvanced = true; });
    expect(ownerAdvanced).toBe(true);
  });
});
