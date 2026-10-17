import { describe, expect, it, vi } from "vitest";
import { createScopedQueryExecutor, readScheduleSnapshot } from "./queryExecutor.js";

function makeRequest(role = "owner") {
  return {
    authContext: { authUserId: "AUTH-1", userId: "PROFILE-1", instituteId: "INST-1", role },
    jwtClaims: { sub: "AUTH-1", role: "authenticated", app_metadata: { institute_id: "INST-1" } },
    supabase: { from: vi.fn() },
  };
}

describe("requester-scoped RLS snapshot SQL execution", () => {
  it("fetches only requested allow-listed relations with the verified user's Supabase client", async () => {
    const req = makeRequest("counselor");
    const relationReader = vi.fn(async (request, relation, columns) => {
      expect(request).toBe(req);
      expect(request.supabase).toBeDefined();
      expect(relation).toBe("student_profiles");
      expect(columns).not.toContain("phone");
      expect(columns).not.toContain("email");
      return [
        { id: "STUDENT-IN-INSTITUTE", name: "Fictional Student", batch_id: "BATCH-A", status: "Active" },
        { id: "SHOULD-NOT-LEAK", name: "A record hidden by the simulated RLS response", batch_id: "BATCH-B", status: "Active" },
      ];
    });
    const execute = createScopedQueryExecutor({ relationReader });

    const result = await execute(req, "SELECT s.name FROM student_profiles s WHERE s.id = ? LIMIT 200", ["STUDENT-IN-INSTITUTE"], { tables: ["student_profiles"] });
    expect(result).toMatchObject({
      rows: [{ name: "Fictional Student" }],
      columns: ["name"],
      rowCount: 1,
      source: "supabase-rls-snapshot",
    });
    expect(relationReader).toHaveBeenCalledTimes(1);
  });

  it("rejects database execution without verified context or a requester Supabase client", async () => {
    const relationReader = vi.fn();
    const execute = createScopedQueryExecutor({ relationReader });
    await expect(execute({}, "SELECT 1", [], { tables: ["students"] })).rejects.toThrow("Verified requester context is unavailable.");
    expect(relationReader).not.toHaveBeenCalled();
  });

  it("aborts sibling requester-scoped reads if a relation load fails", async () => {
    const req = makeRequest();
    let capturedSignal;
    const relationReader = vi.fn(async (_request, _relation, _columns, signal) => {
      capturedSignal = signal;
      throw new Error("simulated RLS denial");
    });
    const execute = createScopedQueryExecutor({ relationReader });

    await expect(execute(req, "SELECT name FROM trainers LIMIT 200")).rejects.toThrow("simulated RLS denial");
    expect(capturedSignal.controller.signal.aborted).toBe(true);
  });

  it("refuses a trainer query requesting a relation outside their schema", async () => {
    const relationReader = vi.fn();
    const execute = createScopedQueryExecutor({ relationReader });
    await expect(execute(makeRequest("trainer"), "SELECT amount FROM instalments", [], { tables: ["instalments"] }))
      .rejects.toThrow('Table "instalments" is not available to this role.');
    expect(relationReader).not.toHaveBeenCalled();
  });
});

describe("bounded timetable snapshots", () => {
  it("rejects an incomplete snapshot instead of planning from a silently truncated schedule", async () => {
    const req = makeRequest("owner");
    const oversized = Array.from({ length: 201 }, (_, index) => ({ id: `BATCH-${index}` }));
    req.supabase.from = vi.fn((table) => ({
      select: () => ({
        limit: async () => ({ data: table === "batches" ? oversized : [], error: null }),
      }),
    }));

    await expect(readScheduleSnapshot(req)).rejects.toThrow("complete schedule exceeds its safe row bound");
  });
});
