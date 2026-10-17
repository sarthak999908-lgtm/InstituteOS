import { describe, expect, it } from "vitest";
import { appStorageKey, shouldEnableLocalDemo } from "./localDemo.js";

describe("local-only demo gate", () => {
  it("requires both a development build and the explicit demo query", () => {
    expect(shouldEnableLocalDemo({ development: true, search: "?demo=local" })).toBe(true);
    expect(shouldEnableLocalDemo({ development: false, search: "?demo=local" })).toBe(false);
    expect(shouldEnableLocalDemo({ development: true, search: "" })).toBe(false);
    expect(shouldEnableLocalDemo({ development: true, search: "?demo=other" })).toBe(false);
  });

  it("keeps local demo records separate from normal browser records", () => {
    expect(appStorageKey("instituteos_students", true)).toBe("instituteos_local_demo:instituteos_students");
    expect(appStorageKey("instituteos_students", false)).toBe("instituteos_students");
  });
});
