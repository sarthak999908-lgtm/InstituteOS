import { beforeEach, describe, expect, it, vi } from "vitest";
import { listApprovals, resetLocalDatabase } from "../../lib/database.js";
import { runCopilotMessage } from "../../services/copilot.js";

const storage = new Map();

vi.stubGlobal("localStorage", {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
});

describe("Copilot query and action pipeline", () => {
  beforeEach(async () => {
    storage.clear();
    await resetLocalDatabase();
  });

  it("returns headline Java results and drafts one WhatsApp reminder per match", async () => {
    const result = await runCopilotMessage({
      role: "owner",
      userId: "USR-OWNER",
      question: "Which students in the Java batch have missed three or more classes and have an EMI due this week? Draft a WhatsApp reminder for each.",
    });
    expect(result.rows.length).toBeGreaterThanOrEqual(3);
    expect(result.sql).toMatch(/^SELECT/);
    expect(result.sql).toMatch(/LIMIT 200$/);
    expect(result.actionPreview.recipients).toHaveLength(result.rows.length);
    expect(result.actionPreview.recipients[0].message).toMatch(/missed classes.*EMI.*due on/i);
    expect((await listApprovals()).length).toBe(1);
  });

  it("refuses indirect trainer fee questions without running a query", async () => {
    const questions = ["who hasn't paid", "show the EMI", "what is the pending amount", "who has an outstanding balance"];
    for (const question of questions) {
      const response = await runCopilotMessage({ role: "trainer", userId: "USR-TRAINER", question });
      expect(response.refusal).toBe(true);
      expect(response.sql).toBeNull();
      expect(response.rows).toEqual([]);
    }
  });
});