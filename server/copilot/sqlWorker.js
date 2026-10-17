import { parentPort, workerData } from "node:worker_threads";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const numberColumns = new Set([
  "fee_total", "duration_weeks", "weekly_hours_max", "weekday", "capacity",
  "online_seat_limit", "student_count", "score", "duration_min", "total",
  "amount", "paid_amount", "instalment_count", "amount_due",
]);

function quoteIdentifier(identifier) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) throw new Error("Invalid SQL identifier.");
  return `"${identifier}"`;
}

function normalizeValue(value) {
  if (value && typeof value === "object") return JSON.stringify(value);
  return value ?? null;
}

try {
  const require = createRequire(import.meta.url);
  const wasmPath = join(dirname(require.resolve("sql.js")), "sql-wasm.wasm");
  const wasmBinary = await readFile(wasmPath);
  const initSqlJs = (await import("sql.js")).default;
  const SQL = await initSqlJs({ wasmBinary });
  const db = new SQL.Database();
  try {
    for (const [relation, columns] of Object.entries(workerData.schema)) {
      const columnDefinitions = columns.map((column) => `${quoteIdentifier(column)} ${numberColumns.has(column) ? "NUMERIC" : "TEXT"}`);
      db.run(`CREATE TABLE ${quoteIdentifier(relation)} (${columnDefinitions.join(", ")})`);
      const rows = workerData.sourceRows[relation] || [];
      if (!rows.length) continue;
      const columnList = columns.map(quoteIdentifier).join(", ");
      const placeholders = columns.map(() => "?").join(", ");
      const statement = db.prepare(`INSERT INTO ${quoteIdentifier(relation)} (${columnList}) VALUES (${placeholders})`);
      try {
        for (const row of rows) statement.run(columns.map((column) => normalizeValue(row[column])));
      } finally {
        statement.free();
      }
    }
    const statement = db.prepare(workerData.sql);
    const rows = [];
    const columns = statement.getColumnNames?.() || [];
    try {
      if (workerData.params.length) statement.bind(workerData.params);
      while (statement.step() && rows.length < 200) rows.push(statement.getAsObject());
    } finally {
      statement.free();
    }
    parentPort.postMessage({ rows, columns, rowCount: rows.length, truncated: rows.length >= 200, source: "supabase-rls-snapshot" });
  } finally {
    db.close();
  }
} catch {
  parentPort.postMessage({ error: "The scoped SQL query could not be completed." });
}
