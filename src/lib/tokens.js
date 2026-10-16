/**
 * Clear Sky Design Tokens for Institute Copilot
 * Mirror of CSS variables in index.css (Light-First with Dark Theme)
 */

export const TOKENS = {
  light: {
    bg0: "#F6F8FC",
    surface: "#FFFFFF",
    surface2: "#F0F3FA",
    surface3: "#E7ECF6",
    border: "rgba(15, 23, 42, 0.08)",
    borderHover: "rgba(15, 23, 42, 0.16)",
    text: {
      primary: "#0F172A",
      secondary: "#475569",
      muted: "#8A94A8",
    },
    shadows: {
      card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -8px rgba(15, 23, 42, 0.10)",
      cardHover: "0 12px 32px -8px rgba(15, 23, 42, 0.14), 0 24px 48px -24px rgba(37, 99, 235, 0.18)",
      glass: "0 8px 30px rgba(15, 23, 42, 0.08)",
      glow: "0 0 25px rgba(37, 99, 235, 0.15)",
    },
  },
  dark: {
    bg0: "#0A0F1C",
    surface: "#111827",
    surface2: "#172033",
    surface3: "#1F2A40",
    border: "rgba(255, 255, 255, 0.08)",
    borderHover: "rgba(255, 255, 255, 0.16)",
    text: {
      primary: "#EAF0FB",
      secondary: "#A3AEC4",
      muted: "#6B778F",
    },
    shadows: {
      card: "0 1px 3px rgba(0, 0, 0, 0.4), 0 8px 24px -8px rgba(0, 0, 0, 0.6)",
      cardHover: "0 12px 32px -8px rgba(0, 0, 0, 0.8), 0 0 25px rgba(96, 165, 250, 0.2)",
      glass: "0 8px 30px rgba(0, 0, 0, 0.6)",
      glow: "0 0 30px rgba(96, 165, 250, 0.25)",
    },
  },
  accents: {
    ocean: {
      name: "Ocean",
      light: {
        primary: "#2563EB",
        secondary: "#0D9488",
        highlight: "#F97316",
        gradient: "linear-gradient(120deg, #2563EB, #0EA5A4)",
        glow: "rgba(37, 99, 235, 0.22)",
      },
      dark: {
        primary: "#60A5FA",
        secondary: "#2DD4BF",
        highlight: "#FB923C",
        gradient: "linear-gradient(120deg, #3B82F6, #14B8A6)",
        glow: "rgba(96, 165, 250, 0.35)",
      },
    },
    emerald: {
      name: "Emerald",
      light: {
        primary: "#059669",
        secondary: "#0284C7",
        highlight: "#F59E0B",
        gradient: "linear-gradient(120deg, #059669, #0284C7)",
        glow: "rgba(5, 150, 105, 0.22)",
      },
      dark: {
        primary: "#34D399",
        secondary: "#38BDF8",
        highlight: "#FBBF24",
        gradient: "linear-gradient(120deg, #10B981, #0284C7)",
        glow: "rgba(52, 211, 153, 0.35)",
      },
    },
    sunset: {
      name: "Sunset",
      light: {
        primary: "#EA580C",
        secondary: "#0F766E",
        highlight: "#2563EB",
        gradient: "linear-gradient(120deg, #EA580C, #0F766E)",
        glow: "rgba(234, 88, 12, 0.22)",
      },
      dark: {
        primary: "#FB923C",
        secondary: "#2DD4BF",
        highlight: "#60A5FA",
        gradient: "linear-gradient(120deg, #F97316, #0D9488)",
        glow: "rgba(251, 146, 60, 0.35)",
      },
    },
  },
  semantic: {
    success: "#16A34A",
    warning: "#D97706",
    danger: "#DC2626",
    info: "#0284C7",
  },
  typography: {
    fontDisplay: "'Space Grotesk', -apple-system, sans-serif",
    fontUi: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    fontMono: "'JetBrains Mono', monospace",
  },
  radius: {
    sm: "10px",
    md: "14px",
    lg: "20px",
    full: "9999px",
  },
  motion: {
    durations: {
      instant: 120,
      fast: 220,
      normal: 380,
      slow: 600,
    },
    easings: {
      entrance: [0.22, 1, 0.36, 1],
      movement: [0.65, 0, 0.35, 1],
      spring: { stiffness: 260, damping: 24 },
    },
  },
};
