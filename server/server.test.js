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
});
