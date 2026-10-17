import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultAnthropicCall } from "./service.js";

afterEach(() => vi.unstubAllGlobals());

function sseEvent(type, payload = {}) {
  return `event: ${type}\ndata: ${JSON.stringify({ type, ...payload })}\n\n`;
}

describe("Anthropic SSE adapter", () => {
  it("reconstructs tool arguments and streams only redacted text", async () => {
    const source = [
      sseEvent("message_start", { message: { usage: { input_tokens: 17 } } }),
      sseEvent("content_block_start", { index: 0, content_block: { type: "text", text: "" } }),
      sseEvent("content_block_delta", { index: 0, delta: { type: "text_delta", text: "Contact me at learner@example.invalid and 9876543210. What next?" } }),
      sseEvent("content_block_stop", { index: 0 }),
      sseEvent("content_block_start", { index: 1, content_block: { type: "tool_use", id: "tool-1", name: "run_readonly_query", input: {} } }),
      sseEvent("content_block_delta", { index: 1, delta: { type: "input_json_delta", partial_json: '{"sql":"SELECT id FROM trainers LIMIT 200","purpose":"Find a trainer","params":[]}' } }),
      sseEvent("content_block_stop", { index: 1 }),
      sseEvent("message_delta", { usage: { output_tokens: 23 } }),
      sseEvent("message_stop"),
    ].join("");
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        for (let offset = 0; offset < source.length; offset += 13) {
          controller.enqueue(encoder.encode(source.slice(offset, offset + 13)));
        }
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, body });
    vi.stubGlobal("fetch", fetchMock);
    const streamed = [];

    const result = await defaultAnthropicCall({
      apiKey: "mock-provider-key",
      model: "mock-model",
      system: "Scoped test prompt",
      messages: [{ role: "user", content: "Fictional request" }],
      tools: [],
      onText: (text) => streamed.push(text),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).stream).toBe(true);
    expect(result.usage).toEqual({ input_tokens: 17, output_tokens: 23 });
    expect(result.content[1]).toMatchObject({
      type: "tool_use",
      id: "tool-1",
      name: "run_readonly_query",
      input: { sql: "SELECT id FROM trainers LIMIT 200", purpose: "Find a trainer", params: [] },
    });
    expect(streamed.join("")).toContain("[email redacted]");
    expect(streamed.join("")).toContain("[phone redacted]");
    expect(streamed.join("")).not.toContain("learner@example.invalid");
    expect(streamed.join("")).not.toContain("9876543210");
  });
});
