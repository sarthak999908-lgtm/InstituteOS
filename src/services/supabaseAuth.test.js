import { describe, expect, it, vi } from "vitest";
import { createSupabaseAuth } from "./supabaseAuth.js";
import { routeAuthorizedInstituteSession } from "../features/auth/authFlow.js";

const demoUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "trainer@example.invalid",
  user_metadata: { name: "Demo Trainer" },
};

describe("Supabase Auth gateway with a mocked Supabase client", () => {
  it("uses password auth and routes a verified membership to its database role", async () => {
    const context = { user_id: "USR-TRAINER", institute_id: "INST-DEMO", role: "trainer" };
    const client = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ data: { user: demoUser, session: { user: demoUser } }, error: null }),
      },
      rpc: vi.fn().mockResolvedValue({ data: [context], error: null }),
    };
    const auth = createSupabaseAuth(client);
    const signedIn = await auth.signInWithEmail(demoUser.email, "example-password");
    const membership = await auth.getAuthenticatedInstituteContext();
    const onRoleChange = vi.fn();
    const onLogin = vi.fn();

    const authorization = routeAuthorizedInstituteSession(signedIn.user, membership, { onRoleChange, onLogin });

    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: demoUser.email, password: "example-password" });
    expect(client.rpc).toHaveBeenCalledWith("current_user_context");
    expect(authorization.role).toBe("trainer");
    expect(onRoleChange).toHaveBeenCalledWith("trainer", expect.objectContaining({ instituteUserId: "USR-TRAINER" }));
    expect(onLogin).toHaveBeenCalledWith(expect.objectContaining({ instituteUserId: "USR-TRAINER" }), "trainer", context);
  });

  it("uses signInWithOtp for existing users and does not implicitly create an Auth user", async () => {
    const client = { auth: { signInWithOtp: vi.fn().mockResolvedValue({ error: null }) } };
    const auth = createSupabaseAuth(client);
    await auth.sendMagicLink(demoUser.email);
    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({
      email: demoUser.email,
      options: { shouldCreateUser: false },
    });
  });

  it("uses verifyOtp for email codes", async () => {
    const client = { auth: { verifyOtp: vi.fn().mockResolvedValue({ data: { user: demoUser, session: null }, error: null }) } };
    const auth = createSupabaseAuth(client);
    const result = await auth.verifyEmailOtp(demoUser.email, "123456");
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({ email: demoUser.email, token: "123456", type: "email" });
    expect(result.user).toEqual(demoUser);
  });

  it("registration assigns only display-name metadata and no institute role", async () => {
    const client = { auth: { signUp: vi.fn().mockResolvedValue({ data: { user: demoUser, session: null }, error: null }) } };
    const auth = createSupabaseAuth(client);
    await auth.signUpWithEmail(demoUser.email, "example-password", "Demo Trainer");
    const payload = client.auth.signUp.mock.calls[0][0];
    expect(payload).toEqual({
      email: demoUser.email,
      password: "example-password",
      options: { data: { name: "Demo Trainer" } },
    });
    expect(payload.options.data).not.toHaveProperty("role");
    expect(payload.options.data).not.toHaveProperty("institute_id");
  });

  it("returns no authorization for an absent membership or invalid role", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [], error: null }) };
    const auth = createSupabaseAuth(client);
    expect(await auth.getAuthenticatedInstituteContext()).toBeNull();
    expect(routeAuthorizedInstituteSession(demoUser, null)).toBeNull();
    expect(routeAuthorizedInstituteSession(demoUser, { user_id: "USR-X", institute_id: "INST-X", role: "admin" })).toBeNull();
  });
});
