import { create } from "zustand";
export const useSessionStore = create((set) => ({
  role: null,
  userId: null,
  userName: "",
  setRole: (nextRole, user = null) => {
    if (!["owner", "counselor", "trainer", "accounts"].includes(nextRole)) return;
    set({
      role: nextRole,
      userId: user?.instituteUserId || user?.id || null,
      userName: user?.user_metadata?.name || user?.email || "",
    });
  },
  clearSession: () => set({ role: null, userId: null, userName: "" }),
}));
