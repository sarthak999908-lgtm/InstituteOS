import { create } from "zustand";
import { users } from "../data/mockData.js";

function savedRole() {
  try {
    const role = localStorage.getItem("instituteos_demo_role");
    return users.some((user) => user.role === role) ? role : "owner";
  } catch {
    return "owner";
  }
}

export const useSessionStore = create((set) => {
  const role = savedRole();
  const user = users.find((item) => item.role === role) || users[0];
  return {
    role: user.role,
    userId: user.id,
    userName: user.name,
    setRole: (nextRole) => {
      const nextUser = users.find((item) => item.role === nextRole);
      if (!nextUser) return;
      try {
        localStorage.setItem("instituteos_demo_role", nextRole);
      } catch (error) {
        console.error("Could not save demo role:", error);
      }
      set({ role: nextUser.role, userId: nextUser.id, userName: nextUser.name });
    },
  };
});