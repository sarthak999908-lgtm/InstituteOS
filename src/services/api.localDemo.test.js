import { afterEach, describe, expect, it, vi } from "vitest";

const { getSession, localDemoApiResponse } = vi.hoisted(() => ({
  getSession: vi.fn(),
  localDemoApiResponse: vi.fn(() => ({ source: "fictional-local-demo" })),
}));
vi.mock("./supabase.js", () => ({ getSession, supabaseEnabled: false }));
vi.mock("../lib/localDemo.js", () => ({ localDemoMode: true }));
vi.mock("./localDemoApi.js", () => ({ localDemoApiResponse }));

import { getDashboard } from "./api.js";

describe("API client in local demo mode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getSession.mockReset();
    localDemoApiResponse.mockClear();
  });

  it("returns local fixtures without session restore or network fetch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(getDashboard()).resolves.toEqual({ source: "fictional-local-demo" });
    expect(localDemoApiResponse).toHaveBeenCalledWith("/dashboard", {});
    expect(getSession).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
