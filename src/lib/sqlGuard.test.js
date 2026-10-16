import { describe, expect, it } from "vitest";
import { guardSql } from "./sqlGuard.js";

describe("guardSql", () => {
  it("allows scoped selects and caps results", () => {
    expect(guardSql("SELECT s.id, s.name FROM students s", "owner").sql).toMatch(/LIMIT 200$/);
    expect(guardSql("SELECT i.amount FROM instalments i LIMIT 20", "accounts").sql).toMatch(/LIMIT 20$/);
  });

  it("rejects hostile statements and scoped-out data", () => {
    const hostile = [
      "INSERT INTO students VALUES (1)", "UPDATE students SET name = 'x'", "DELETE FROM students",
      "DROP TABLE students", "ALTER TABLE students ADD x", "ATTACH DATABASE 'x' AS y",
      "PRAGMA table_info(students)", "SELECT * FROM students; DROP TABLE students",
      "SELECT * FROM students;", "SELECT * FROM students -- leak", "SELECT * FROM students /* leak */",
      "WITH x AS (DELETE FROM students) SELECT * FROM x", "SELECT * FROM students LIMIT 201",
      "SELECT * FROM payments", "SELECT * FROM fee_plans", "SELECT s.email FROM students s",
      "SELECT s.phone FROM students s", "SELECT x.secret FROM students x", "SELECT password FROM users",
      "SELECT * FROM sqlite_master", "SELECT * FROM students JOIN secrets ON 1=1",
      "SELECT s.nonexistent FROM students s", "SELECT * FROM students UNION SELECT * FROM payments",
      "SELECT load_extension('x') FROM students", "SELECT * FROM students LIMIT 999999",
    ];
    for (const query of hostile) expect(() => guardSql(query, "trainer")).toThrow();
  });

  it("does not expose finance tables or contact columns to trainers", () => {
    expect(() => guardSql("SELECT i.amount FROM instalments i", "trainer")).toThrow(/not available/);
    expect(() => guardSql("SELECT s.email FROM students s", "trainer")).toThrow(/not available/);
  });
});