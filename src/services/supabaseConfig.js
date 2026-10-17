const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const processEnv = typeof process !== "undefined" ? process.env || {} : {};

export const supabaseEnvironmentConfig = Object.freeze({
  url: String(env.VITE_SUPABASE_URL || processEnv.VITE_SUPABASE_URL || "").trim(),
  anonKey: String(env.VITE_SUPABASE_ANON_KEY || processEnv.VITE_SUPABASE_ANON_KEY || "").trim(),
});

export function inspectSupabaseConfig({ url, anonKey } = {}) {
  const missingVariables = [];
  const invalidVariables = [];

  if (!String(url || "").trim()) {
    missingVariables.push("VITE_SUPABASE_URL");
  } else {
    try {
      const parsed = new URL(String(url).trim());
      if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
        invalidVariables.push("VITE_SUPABASE_URL");
      }
    } catch {
      invalidVariables.push("VITE_SUPABASE_URL");
    }
  }

  if (!String(anonKey || "").trim()) missingVariables.push("VITE_SUPABASE_ANON_KEY");

  const issues = [...new Set([...missingVariables, ...invalidVariables])];
  return Object.freeze({
    configured: issues.length === 0,
    missingVariables: Object.freeze(missingVariables),
    invalidVariables: Object.freeze(invalidVariables),
    issues: Object.freeze(issues),
  });
}

export const supabaseConfigStatus = inspectSupabaseConfig(supabaseEnvironmentConfig);
