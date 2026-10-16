import React from "react";

export default function PerspectiveGrid({ calmMode = false }) {
  if (calmMode) return null;

  return (
    <div
      className="perspective-grid-floor"
      style={{
        position: "fixed",
        bottom: 0,
        left: "-20%",
        width: "140%",
        height: "45vh",
        pointerEvents: "none",
        zIndex: 2,
        perspective: "550px",
        overflow: "hidden",
        maskImage: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)",
      }}
      aria-hidden="true"
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: "rotateX(72deg) translateZ(0)",
          transformOrigin: "bottom center",
          backgroundImage: `
            linear-gradient(to right, rgba(34, 211, 238, 0.14) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(34, 211, 238, 0.14) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          animation: "perspective-scroll 8s linear infinite",
        }}
      />
      {/* Horizon glow line */}
      <div
        style={{
          position: "absolute",
          top: "12%",
          left: "20%",
          width: "60%",
          height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.4), rgba(139, 92, 246, 0.5), rgba(244, 114, 182, 0.4), transparent)",
          filter: "blur(1px)",
        }}
      />
    </div>
  );
}
