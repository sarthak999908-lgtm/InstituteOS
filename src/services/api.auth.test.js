import { afterEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("./supabase.js", () => ({ getSession }));

import { getDashboard } from "./api.js";

describe("authenticated API client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getSession.mockReset();
  });

  it("sends the current Supabase access token as a bearer token", async () => {
    getSession.mockResolvedValue({ access_token: "test-access-token" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      JSON.stringify({ success: true, data: { totalStudents: 42 } }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));

    await expect(getDashboard()).resolves.toEqual({ totalStudents: 42 });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/dashboard$/),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-access-token" }),
      })
    );
  });
});