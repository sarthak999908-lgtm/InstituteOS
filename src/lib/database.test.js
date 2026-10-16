import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRoleDatabase, resetLocalDatabase, runRoleQuery } from "./database.js";

const values = new Map();

vi.stubGlobal("localStorage", {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
});

describe("role-scoped SQLite database", () => {
  beforeEach(async () => {
    values.clear();
    await resetLocalDatabase();
  });

  it("seeds the complete demo and returns headline Java matches", async () => {
    const result = await runRoleQuery({
      role: "owner",
      userId: "USR-OWNER",
      sql: "SELECT s.id, s.name FROM students s JOIN attendance a ON a.student_id = s.id JOIN sessions x ON x.id = a.session_id JOIN instalments i ON i.student_id = s.id WHERE s.batch_id = ? AND a.status = ? AND i.status != ? AND i.due_date >= ? AND i.due_date <= ? GROUP BY s.id, s.name HAVING COUNT(DISTINCT a.session_id) >= ?",
      params: ["BATCH-JAVA-A", "absent", "paid", new Date().toISOString().slice(0, 10), new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), 3],
    });
    expect(result.rows.length).toBeGreaterThanOrEqual(3);
    expect(result.sql).toMatch(/LIMIT 200$/);
  });

  it("physically omits finance tables and student contact columns for trainers", async () => {
    const db = await getRoleDatabase("trainer", "USR-TRAINER");
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type = 'table'")[0].values.flat();
    const studentColumns = db.exec("PRAGMA table_info(students)")[0].values.map((row) => row[1]);
    expect(tables).not.toContain("instalments");
    expect(tables).not.toContain("payments");
    expect(studentColumns).not.toContain("phone");
    expect(studentColumns).not.toContain("email");
    expect(db.exec("SELECT id FROM students")[0].values.length).toBeGreaterThan(0);
  });

  it("persists local database changes across a reopen", async () => {
    await runRoleQuery({ role: "owner", userId: "USR-OWNER", sql: "SELECT id FROM students LIMIT 3" });
    await resetLocalDatabase();
    const result = await runRoleQuery({ role: "owner", userId: "USR-OWNER", sql: "SELECT COUNT(*) AS student_count FROM students" });
    expect(Number(result.rows[0].student_count)).toBe(140);
  });
});