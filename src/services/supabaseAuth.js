const STAFF_ROLES = new Set(["owner", "counselor", "trainer", "accounts"]);

export function createSupabaseAuth(client) {
  const unavailable = () => ({ error: Object.assign(new Error("Supabase Auth is not configured."), { code: "supabase_not_configured" }) });

  return {
    async signInWithEmail(email, password) {
      if (!client) return { user: null, session: null, error: unavailable().error };
      try {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        return { user: data?.user || null, session: data?.session || null, error };
      } catch (error) {
        return { user: null, session: null, error };
      }
    },

    async sendMagicLink(email) {
      if (!client) return unavailable();
      try {
        const emailRedirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
        const { error } = await client.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
            ...(emailRedirectTo ? { emailRedirectTo } : {}),
          },
        });
        return { error };
      } catch (error) {
        return { error };
      }
    },

    async verifyEmailOtp(email, token) {
      if (!client) return { user: null, session: null, error: unavailable().error };
      try {
        const { data, error } = await client.auth.verifyOtp({ email, token, type: "email" });
        return { user: data?.user || null, session: data?.session || null, error };
      } catch (error) {
        return { user: null, session: null, error };
      }
    },

    async signUpWithEmail(email, password, name = "") {
      if (!client) return { user: null, session: null, error: unavailable().error };
      try {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { data: { name: name || email.split("@")[0] } },
        });
        return { user: data?.user || null, session: data?.session || null, error };
      } catch (error) {
        return { user: null, session: null, error };
      }
    },

    async getAuthenticatedInstituteContext() {
      if (!client) return null;
      const { data, error } = await client.rpc("current_user_context");
      if (error) throw new Error("The InstituteOS membership lookup failed.");
      const context = Array.isArray(data) ? data[0] : data;
      if (!context || !STAFF_ROLES.has(context.role) || !context.user_id || !context.institute_id) return null;
      return context;
    },
  };
}
