import { describe, expect, it } from "vitest";
import { dataSeed } from "../data/mockData.js";
import { localDemoApiResponse } from "./localDemoApi.js";

describe("local demo API adapter", () => {
  it("serves fictional dashboard and student fixtures", () => {
    expect(localDemoApiResponse("/dashboard").source).toBe("fictional-local-demo");
    expect(localDemoApiResponse("/students")).toHaveLength(dataSeed.students.length);
  });

  it("handles demo mutations locally without requiring fetch", () => {
    const result = localDemoApiResponse("/approvals", {
      method: "POST",
      body: JSON.stringify({ kind: "fee_reconciliation" }),
    });
    expect(result).toMatchObject({ kind: "fee_reconciliation", status: "pending", source: "fictional-local-demo" });
    expect(result.id).toMatch(/^LOCAL-APPROVAL-/);
  });
});
