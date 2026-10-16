import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dataSeed, students } from "../../data/mockData.js";
import { parseStatementCsv, reconcileStatement } from "./reconcile.js";

describe("CSV reconciliation", () => {
  it("matches the sample statement and leaves unmatched rows visible", async () => {
    const csv = readFileSync(new URL("../../../public/sample-statement.csv", import.meta.url), "utf8");
    const parsed = parseStatementCsv(csv);
    const names = new Map(students.map((student) => [student.id, student.name]));
    const candidates = dataSeed.payments.map((payment) => ({ ...payment, student_name: names.get(payment.student_id) }));
    const result = reconcileStatement(parsed, candidates);
    expect(result.filter((row) => row.status === "matched")).toHaveLength(1);
    expect(result.filter((row) => row.status === "unmatched")).toHaveLength(2);
    expect(result.find((row) => row.status === "matched").payment.utr).toBe("UTR100000");
  });

  it("never assigns one payment to two statement rows", () => {
    const payment = { id: "PAY-1", utr: "REF-1", amount: 12000, student_name: "Aarav Sharma", received_on: "2026-10-10" };
    const row = { rowNumber: 2, utr: "REF-1", amount: 12000, name: "Aarav Sharma", date: "2026-10-10" };
    const results = reconcileStatement([row, { ...row, rowNumber: 3 }], [payment]);
    expect(results.map((result) => result.status)).toEqual(["matched", "unmatched"]);
  });
});