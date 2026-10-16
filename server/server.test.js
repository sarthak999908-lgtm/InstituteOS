import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "./index.js";

let server;
let baseUrl;

beforeAll(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });
});

afterAll(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

describe("Backend Express API Server", () => {
  it("GET /api/health returns 200 and healthy status", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe("healthy");
    expect(body).toHaveProperty("timestamp");
  });

  it("GET /api/dashboard returns telemetry data", async () => {
    const res = await fetch(`${baseUrl}/dashboard`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty("totalStudents");
    expect(body.data).toHaveProperty("activeBatches");
  });

  it("GET /api/students returns students collection", async () => {
    const res = await fetch(`${baseUrl}/students`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /api/batches returns batches collection", async () => {
    const res = await fetch(`${baseUrl}/batches`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /api/fees returns fee instalment records", async () => {
    const res = await fetch(`${baseUrl}/fees`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /api/attendance returns attendance list", async () => {
    const res = await fetch(`${baseUrl}/attendance`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /api/trainers returns trainers list", async () => {
    const res = await fetch(`${baseUrl}/trainers`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /api/courses returns courses list", async () => {
    const res = await fetch(`${baseUrl}/courses`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /api/rooms returns room capacity information", async () => {
    const res = await fetch(`${baseUrl}/rooms`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /api/sessions returns timetable sessions", async () => {
    const res = await fetch(`${baseUrl}/sessions`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /api/profile returns profile in demo fallback mode", async () => {
    const res = await fetch(`${baseUrl}/profile`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty("role");
  });

  it("GET /api/assignments returns assignments list", async () => {
    const res = await fetch(`${baseUrl}/assignments`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /api/submissions returns submissions list", async () => {
    const res = await fetch(`${baseUrl}/submissions`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /api/recordings returns recordings list", async () => {
    const res = await fetch(`${baseUrl}/recordings`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("GET /api/approvals returns approvals list", async () => {
    const res = await fetch(`${baseUrl}/approvals`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("POST /api/audit-log records an audit event", async () => {
    const res = await fetch(`${baseUrl}/audit-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "test_verification",
        table_name: "test",
        record_id: "T1",
        details: { verified: true },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body).toHaveProperty("id");
  });

  it("POST /api/copilot/query processes query through security pipeline", async () => {
    const res = await fetch(`${baseUrl}/copilot/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Show batch roster for Java Morning",
        intent: "roster_check",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("verified");
  });

  it("POST /api/auth/magic-link issues OTP code", async () => {
    const res = await fetch(`${baseUrl}/auth/magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@instituteos.app" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body).toHaveProperty("otp");
  });

  it("POST /api/auth/verify-otp authenticates admin user and returns token", async () => {
    const res = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@instituteos.app", token: "123456" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.role).toBe("owner");
    expect(body.session).toHaveProperty("access_token");
  });

  it("POST /api/auth/signin authenticates user with password", async () => {
    const res = await fetch(`${baseUrl}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@instituteos.app", password: "password123" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.role).toBe("owner");
    expect(body.user.email).toBe("admin@instituteos.app");
  });

  it("POST /api/auth/register creates new account with role", async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "newtrainer@institute.app", password: "secret", role: "trainer", name: "Jane Doe" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.role).toBe("trainer");
  });
});


