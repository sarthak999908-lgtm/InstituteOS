import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { appStorageKey } from "../lib/localDemo.js";

const ThemeContext = createContext({
  theme: "light",
  resolvedTheme: "light",
  setTheme: () => {},
  accent: "ocean",
  setAccent: () => {},
  calmMode: false,
  setCalmMode: () => {},
});

export function ThemeProvider({ children }) {
  // Theme state: 'light' | 'dark' | 'system' (Default is light)
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem(appStorageKey("instituteos_theme")) || "light";
    } catch {
      return "light";
    }
  });

  const [resolvedTheme, setResolvedTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem(appStorageKey("instituteos_theme")) || "light";
    if (saved === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return saved;
  });

  // Accent preset: 'ocean' (default) | 'emerald' | 'sunset'
  const [accent, setAccentState] = useState(() => {
    try {
      return localStorage.getItem(appStorageKey("instituteos_accent")) || "ocean";
    } catch {
      return "ocean";
    }
  });

  // Calm mode (no parallax, no loops, fades only)
  const [calmMode, setCalmModeState] = useState(() => {
    try {
      return localStorage.getItem(appStorageKey("instituteos_calm_mode")) === "true";
    } catch {
      return false;
    }
  });

  // Listen to system dark/light changes if theme === 'system'
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      if (theme === "system") {
        const nextResolved = e.matches ? "dark" : "light";
        setResolvedTheme(nextResolved);
        applyTheme(nextResolved);
      }
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [theme]);

  const applyTheme = useCallback((targetTheme) => {
    document.documentElement.setAttribute("data-theme", targetTheme);
    document.documentElement.style.colorScheme = targetTheme;
    const meta = document.getElementById("theme-color-meta");
    if (meta) {
      meta.setAttribute("content", targetTheme === "dark" ? "#0A0F1C" : "#F6F8FC");
    }
  }, []);

  const setTheme = useCallback(
    (newTheme, event) => {
      let nextResolved = newTheme;
      if (newTheme === "system") {
        nextResolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }

      setThemeState(newTheme);
      setResolvedTheme(nextResolved);
      try {
        localStorage.setItem(appStorageKey("instituteos_theme"), newTheme);
      } catch {}

      // Circular Reveal with View Transitions API (450ms)
      if (document.startViewTransition && event && !calmMode) {
        const x = event.clientX;
        const y = event.clientY;
        const endRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        );

        const transition = document.startViewTransition(() => {
          applyTheme(nextResolved);
        });

        transition.ready.then(() => {
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 450,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              pseudoElement: "::view-transition-new(root)",
            }
          );
        });
      } else {
        applyTheme(nextResolved);
      }
    },
    [applyTheme, calmMode]
  );

  const setAccent = useCallback((newAccent) => {
    setAccentState(newAccent);
    try {
      localStorage.setItem(appStorageKey("instituteos_accent"), newAccent);
    } catch {}
    document.documentElement.setAttribute("data-accent", newAccent);
  }, []);

  const setCalmMode = useCallback((boolVal) => {
    setCalmModeState(boolVal);
    try {
      localStorage.setItem(appStorageKey("instituteos_calm_mode"), String(boolVal));
    } catch {}
    document.documentElement.setAttribute("data-calm-mode", String(boolVal));
  }, []);

  // Sync on initial mount
  useEffect(() => {
    applyTheme(resolvedTheme);
    document.documentElement.setAttribute("data-accent", accent);
    document.documentElement.setAttribute("data-calm-mode", String(calmMode));
  }, [resolvedTheme, accent, calmMode, applyTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        accent,
        setAccent,
        calmMode,
        setCalmMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
