import { describe, expect, it, vi } from "vitest";
import {
  getAuthErrorMessage,
  getMembershipLookupErrorMessage,
  getRegistrationErrorMessage,
  getRegistrationSuccessMessage,
  getSignInErrorMessage,
  runSingleFlight,
  validateEmailAddress,
  validatePassword,
} from "./authErrors.js";

describe("Supabase authentication messages", () => {
  it("uses the requested message for invalid credentials without exposing a provider payload", () => {
    expect(getSignInErrorMessage({ code: "invalid_credentials", message: "Invalid login credentials" }))
      .toBe("Wrong email or password, or this account does not exist yet.");
  });

  it("asks unconfirmed users to check their inbox", () => {
    expect(getSignInErrorMessage({ code: "email_not_confirmed" }))
      .toBe("Please confirm your email first. Check your inbox.");
  });

  it.each([
    [{ status: 429 }, "Too many attempts. Please wait a few minutes."],
    [{ code: "over_email_send_rate_limit" }, "Too many attempts. Please wait a few minutes."],
  ])("maps rate limiting to a safe wait message", (error, expected) => {
    expect(getAuthErrorMessage(error)).toBe(expected);
  });

  it("maps network failures separately", () => {
    expect(getAuthErrorMessage(Object.assign(new TypeError("Failed to fetch"), { code: "fetch_error" })))
      .toBe("Cannot reach the server. Check your connection.");
  });

  it.each([401, 404])("maps Auth endpoint HTTP %s to a configuration message and logs only safe diagnostics", (status) => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = { status, code: "provider_error", message: "URL and key must never be shown" };
    expect(getAuthErrorMessage(error)).toBe("App configuration problem. Contact the administrator.");
    expect(warning).toHaveBeenCalledWith("Supabase Auth configuration failure.", { status, code: "provider_error" });
    expect(JSON.stringify(warning.mock.calls)).not.toContain("URL and key");
    warning.mockRestore();
  });

  it("keeps ambiguous errors generic", () => {
    expect(getAuthErrorMessage({ message: "private provider internals" })).toBe("Unable to sign in. Please try again.");
  });

  it("uses the same rate-limit message for registration and OTP sends", () => {
    expect(getRegistrationErrorMessage({ code: "over_email_send_rate_limit" }))
      .toBe("Too many attempts. Please wait a few minutes.");
  });

  it("does not promise an institute role after registration", () => {
    expect(getRegistrationSuccessMessage(null)).toContain("Check your inbox to confirm");
    expect(getRegistrationSuccessMessage(null)).toContain("administrator to link your account");
    expect(getRegistrationSuccessMessage({ access_token: "opaque" })).toContain("administrator to link your account");
  });

  it("validates email and password inline without a network request", () => {
    expect(validateEmailAddress("")).toMatch(/email address/i);
    expect(validateEmailAddress("not-an-email")).toMatch(/valid email/i);
    expect(validateEmailAddress("person@example.invalid")).toBe("");
    expect(validatePassword(" ")).toMatch(/password/i);
    expect(validatePassword("valid-password")).toBe("");
  });

  it("provides a safe membership lookup failure message", () => {
    expect(getMembershipLookupErrorMessage()).toMatch(/couldn’t verify your institute membership/i);
  });

  it("allows only one registration action while a request is pending", async () => {
    const lock = { current: false };
    let finishRequest;
    const signUp = vi.fn(() => new Promise((resolve) => { finishRequest = resolve; }));
    const first = runSingleFlight(lock, signUp);
    const duplicate = runSingleFlight(lock, signUp);
    expect(await duplicate).toBe(false);
    expect(signUp).toHaveBeenCalledTimes(1);
    finishRequest();
    expect(await first).toBe(true);
    expect(lock.current).toBe(false);
  });
});
