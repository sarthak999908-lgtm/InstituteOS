import { describe, expect, it, vi } from "vitest";
import { createCopilotService } from "../service.js";

const liveEnabled = process.env.COPILOT_LIVE_EVAL === "1" && Boolean(process.env.ANTHROPIC_API_KEY);

describe("optional live Anthropic smoke evaluation", () => {
  it.skipIf(!liveEnabled)("answers a scoped schema question through the configured provider", async () => {
    const service = createCopilotService({
      audit: vi.fn().mockResolvedValue({}),
      providerEnv: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        COPILOT_PROVIDER: process.env.COPILOT_PROVIDER || "anthropic",
        COPILOT_MODEL: process.env.COPILOT_MODEL,
        COPILOT_ENABLED: "true",
        COPILOT_DAILY_TOKEN_CAP_PER_INSTITUTE: "10000",
      },
      instituteResolver: async () => "Fictional Institute",
      userNameResolver: async () => "Fictional Operator",
    });
    const req = {
      authContext: { authUserId: "live-eval-auth", userId: "live-eval-user", instituteId: "live-eval-institute", role: "owner" },
      jwtClaims: { sub: "live-eval-auth", role: "authenticated" },
      user: { user_metadata: { name: "Fictional Operator" } },
    };

    const result = await service.run(req, "Briefly explain what kinds of information an owner can ask about.");

    expect(result.mode).toBe("ai");
    expect(result.answer.length).toBeGreaterThan(0);
  }, 30000);
});
