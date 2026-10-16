import { useEffect } from "react";
import DotGrid from "./DotGrid.jsx";
import Starfield from "./Starfield.jsx";
import { useTheme } from "../../app/providers.jsx";

export default function MeshBackground() {
  const { resolvedTheme, calmMode } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Global mouse position update for cursor spotlight
  useEffect(() => {
    const handleMouseMove = (e) => {
      document.documentElement.style.setProperty("--mx", `${e.clientX}px`);
      document.documentElement.style.setProperty("--my", `${e.clientY}px`);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const meshOpacity = isDark ? 0.24 : 0.12;

  return (
    <div
      className="living-background"
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
        backgroundColor: "var(--bg-0)",
      }}
      aria-hidden="true"
    >
      {/* Layer 2: Soft Mesh Gradient - 3 blurred blobs drifting on 40-60s unrepeating loops */}
      {!calmMode && (
        <div
          className="mesh-blobs-layer"
          style={{
            position: "absolute",
            inset: 0,
            filter: "blur(90px)",
            opacity: meshOpacity,
            transition: "opacity 0.4s ease",
          }}
        >
          {/* Blob 1: Primary Accent (Blue/Teal) */}
          <div
            className="mesh-blob"
            style={{
              position: "absolute",
              top: "-10%",
              left: "10%",
              width: "60vw",
              height: "55vh",
              borderRadius: "50%",
              background: "var(--accent-primary)",
              animation: "mesh-drift-1 42s ease-in-out infinite",
              willChange: "transform",
            }}
          />

          {/* Blob 2: Secondary Accent (Teal/Sky) */}
          <div
            className="mesh-blob"
            style={{
              position: "absolute",
              top: "25%",
              right: "-5%",
              width: "55vw",
              height: "50vh",
              borderRadius: "50%",
              background: "var(--accent-secondary)",
              animation: "mesh-drift-2 50s ease-in-out infinite",
              willChange: "transform",
            }}
          />

          {/* Blob 3: Highlight Accent (Coral/Amber) */}
          <div
            className="mesh-blob"
            style={{
              position: "absolute",
              bottom: "-5%",
              left: "20%",
              width: "50vw",
              height: "45vh",
              borderRadius: "50%",
              background: "var(--accent-highlight)",
              animation: "mesh-drift-3 58s ease-in-out infinite",
              willChange: "transform",
            }}
          />
        </div>
      )}

      {/* Layer 3: Dotted grid with radial edge mask and subtle 8px parallax */}
      <DotGrid calmMode={calmMode} />

      {/* Layer 4: Starfield (Dark theme only, ~80 stars, light theme has none) */}
      <Starfield calmMode={calmMode} isDark={isDark} />

      {/* Layer 5: Paper grain (SVG noise filter at 3% opacity to kill banding) */}
      <svg
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.03,
          pointerEvents: "none",
          zIndex: 4,
        }}
        aria-hidden="true"
      >
        <filter id="paper-grain-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#paper-grain-noise)" />
      </svg>
    </div>
  );
}
