import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { inspectSupabaseConfig } from "./supabaseConfig.js";
import { SupabaseConfigurationScreen, UnlinkedInstituteScreen } from "../features/auth/AuthStateScreens.jsx";

describe("Supabase startup guard", () => {
  it("reports missing variable names without returning config values", () => {
    const result = inspectSupabaseConfig({ url: "", anonKey: "" });
    expect(result.configured).toBe(false);
    expect(result.issues).toEqual(["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]);
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("rejects a malformed URL and accepts a local Supabase URL", () => {
    expect(inspectSupabaseConfig({ url: "not a url", anonKey: "public-key" }).issues)
      .toEqual(["VITE_SUPABASE_URL"]);
    expect(inspectSupabaseConfig({ url: "http://127.0.0.1:54321", anonKey: "public-key" }).configured).toBe(true);
  });

  it("renders the configuration guard with names only", () => {
    const html = renderToStaticMarkup(createElement(SupabaseConfigurationScreen, {
      variables: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"],
    }));
    expect(html).toContain("Supabase is not configured");
    expect(html).toContain("VITE_SUPABASE_URL");
    expect(html).toContain("VITE_SUPABASE_ANON_KEY");
    expect(html).not.toContain("public-key");
  });
});

describe("unlinked institute screen", () => {
  it("shows the authenticated email, Auth UUID, copy action and sign out", () => {
    const html = renderToStaticMarkup(createElement(UnlinkedInstituteScreen, {
      email: "staff@example.invalid",
      userId: "00000000-0000-4000-8000-000000000001",
      onSignOut: () => {},
    }));
    expect(html).toContain("Your account is not linked to an institute yet");
    expect(html).toContain("staff@example.invalid");
    expect(html).toContain("00000000-0000-4000-8000-000000000001");
    expect(html).toContain("Copy my user ID");
    expect(html).toContain("Sign out");
  });
});
