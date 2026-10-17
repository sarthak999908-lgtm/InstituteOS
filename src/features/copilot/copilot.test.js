import { afterEach, describe, expect, it, vi } from "vitest";
import { runCopilotMessage } from "../../services/copilot.js";

describe("Copilot query boundary", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the question to the authenticated SSE backend and returns the streamed answer", async () => {
    const fetchMock = vi.fn(async () => new Response(
      `event: stage\ndata: {"stage":"Understanding"}\n\nevent: complete\ndata: {"mode":"ai","answer":"Attendance is ready.","answerId":"answer-test"}\n\n`,
      { status: 200, headers: { "Content-Type": "text/event-stream" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(runCopilotMessage({ question: "Show today's attendance", role: "owner", userId: "local-user" }))
      .resolves.toMatchObject({ mode: "ai", answer: "Attendance is ready.", answerId: "answer-test" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/copilot/chat");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ question: "Show today's attendance" });
  });
});
