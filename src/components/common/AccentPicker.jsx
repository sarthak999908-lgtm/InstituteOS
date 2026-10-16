import { motion } from "framer-motion";
import { useTheme } from "../../app/providers.jsx";
import { sound } from "../../lib/sound.js";

const PRESETS = [
  { id: "ocean", name: "Ocean", color: "#2563EB", secondary: "#0D9488" },
  { id: "emerald", name: "Emerald", color: "#059669", secondary: "#0284C7" },
  { id: "sunset", name: "Sunset", color: "#EA580C", secondary: "#0F766E" },
];

export default function AccentPicker({ showLabels = false }) {
  const { accent, setAccent } = useTheme();

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-full)",
        padding: "3px 6px",
      }}
      aria-label="Choose accent preset"
    >
      {PRESETS.map((p) => {
        const isSelected = accent === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              sound.tick();
              setAccent(p.id);
            }}
            title={`Accent: ${p.name}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: showLabels ? "3px 8px" : "3px",
              borderRadius: "var(--radius-full)",
              border: isSelected ? "1.5px solid var(--accent-primary)" : "1.5px solid transparent",
              background: isSelected ? "var(--surface)" : "transparent",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${p.color}, ${p.secondary})`,
                boxShadow: isSelected ? `0 0 8px ${p.color}66` : "none",
                display: "block",
              }}
            />
            {showLabels && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: isSelected ? 600 : 500,
                  color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                {p.name}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
